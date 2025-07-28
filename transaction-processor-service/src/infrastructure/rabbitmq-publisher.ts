import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);
  private connection: any = null;
  private channel: any = null;
  private readonly exchangeName = 'event-sourcing-exchange';

  constructor(private readonly configService: ConfigService) {}

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL') || 'amqp://rabbitmq:password@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true
      });

      this.logger.log('RabbitMQ publisher connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishEvent(event: any): Promise<void> {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const routingKey = `transaction.${event.eventType}`;
      const message = {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        eventData: event.eventData,
        version: event.version,
        occurredOn: event.occurredOn.toISOString(),
        metadata: event.metadata || {}
      };

      const buffer = Buffer.from(JSON.stringify(message));
      
      await this.channel.publish(
        this.exchangeName,
        routingKey,
        buffer,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: event.eventId
        }
      );

      this.logger.debug(`Event published: ${event.eventType} for aggregate ${event.aggregateId}`);
    } catch (error) {
      this.logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error);
    }
  }
} 