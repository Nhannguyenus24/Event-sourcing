import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { TransferProcessorService } from '../services/transfer-processor.service';
import { TransferRequestedEvent } from '../dto/transfer-events.dto';

@Injectable()
export class TransferEventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransferEventConsumer.name);
  private connection: any = null;
  private channel: any = null;
  private readonly exchangeName = 'event-sourcing-exchange';
  private readonly queueName = 'transfer.processing.queue';

  constructor(
    private readonly configService: ConfigService,
    private readonly transferProcessor: TransferProcessorService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.startConsuming();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL') || 'amqp://rabbitmq:password@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true
      });

      // Declare queue for transfer processing
      await this.channel.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${this.exchangeName}.dlx`,
          'x-dead-letter-routing-key': 'transfer.failed',
          'x-message-ttl': 300000, // 5 minutes TTL
        }
      });

      // Bind queue to exchange for transfer events
      await this.channel.bindQueue(
        this.queueName,
        this.exchangeName,
        'account.TransferRequested'
      );

      // Set prefetch for fair dispatch
      await this.channel.prefetch(1);

      this.logger.log('Transfer event consumer connected and configured');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  private async startConsuming(): Promise<void> {
    try {
      await this.channel.consume(
        this.queueName,
        async (message: any) => {
          if (message) {
            await this.handleMessage(message);
          }
        },
        {
          noAck: false, // Manual acknowledgment for reliability
        }
      );

      this.logger.log(`Started consuming transfer events from queue: ${this.queueName}`);
    } catch (error) {
      this.logger.error('Failed to start consuming messages:', error);
      throw error;
    }
  }

  private async handleMessage(message: any): Promise<void> {
    const messageId = message.properties?.messageId || 'unknown';
    
    try {
      // Parse message content
      const content = JSON.parse(message.content.toString());
      this.logger.debug(`Received transfer event: ${messageId}`, { eventType: content.eventType });

      // Validate message structure
      if (!this.isValidTransferRequestedEvent(content)) {
        throw new Error(`Invalid transfer event structure: ${JSON.stringify(content)}`);
      }

      // Convert to typed event
      const transferEvent: TransferRequestedEvent = {
        eventId: content.eventId,
        eventType: content.eventType,
        aggregateId: content.aggregateId,
        eventData: content.eventData,
        version: content.version,
        occurredOn: new Date(content.occurredOn),
        metadata: content.metadata,
      };

      // Process the transfer
      const result = await this.transferProcessor.processTransfer(transferEvent);
      
      if (result.success) {
        this.logger.log(`Transfer processed successfully: ${result.transferRequestId}`);
      } else {
        this.logger.warn(`Transfer processing failed: ${result.transferRequestId} - ${result.error}`);
      }

      // Acknowledge message processing
      this.channel.ack(message);

    } catch (error) {
      this.logger.error(`Failed to process transfer event ${messageId}:`, error);
      
      // Check retry count
      const retryCount = message.properties.headers?.['x-retry-count'] || 0;
      
      if (retryCount < 3) {
        // Retry with delay
        await this.retryMessage(message, retryCount + 1);
      } else {
        // Dead letter after max retries
        this.logger.error(`Max retries exceeded for message ${messageId}, sending to DLQ`);
        this.channel.nack(message, false, false);
      }
    }
  }

  private isValidTransferRequestedEvent(content: any): boolean {
    return (
      content &&
      content.eventType === 'TransferRequested' &&
      content.eventData &&
      content.eventData.transferRequestId &&
      content.eventData.fromAccountId &&
      content.eventData.toAccountId &&
      typeof content.eventData.amount === 'number' &&
      content.eventData.amount > 0
    );
  }

  private async retryMessage(message: any, retryCount: number): Promise<void> {
    try {
      // Add retry headers
      const headers = {
        ...message.properties.headers,
        'x-retry-count': retryCount,
      };

      // Republish with delay
      setTimeout(async () => {
        await this.channel.publish(
          this.exchangeName,
          'account.TransferRequested',
          message.content,
          {
            ...message.properties,
            headers,
          }
        );
        
        this.channel.ack(message);
        this.logger.debug(`Retrying message (attempt ${retryCount})`);
      }, 1000 * retryCount); // Exponential backoff

    } catch (error) {
      this.logger.error('Failed to retry message:', error);
      this.channel.nack(message, false, false);
    }
  }

  private async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('Transfer event consumer disconnected');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error);
    }
  }
} 