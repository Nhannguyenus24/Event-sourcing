import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import { DomainEvent } from '../domain/aggregate-root';

@Injectable()
export class RabbitMQEventPublisher {
  private connection: any = null;
  private channel: any = null;
  private readonly exchangeName = 'event-sourcing-exchange';

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:password@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true
      });

      // Declare queues for different services
      const queues = [
        'account.events',
        'transaction.events',
        'query.events',
        'notification.events'
      ];

      for (const queueName of queues) {
        await this.channel.assertQueue(queueName, { durable: true });
        
        // Bind queues to exchange with routing patterns
        const routingKey = queueName.replace('.events', '.*');
        await this.channel.bindQueue(queueName, this.exchangeName, routingKey);
      }

      console.log('RabbitMQ connection established');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const routingKey = `account.${event.eventType}`;
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

      console.log(`Event published: ${event.eventType} for aggregate ${event.aggregateId}`);
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEvent(event);
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
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}
