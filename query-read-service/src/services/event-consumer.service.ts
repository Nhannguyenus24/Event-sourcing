import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ReadModelRepository } from '../infrastructure/read-model-repository';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventConsumerService {
  private connection: any = null;
  private channel: any = null;

  constructor(private readModelRepository: ReadModelRepository) {}

  async startEventConsumer(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:password@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Consume events from the queue
      await this.channel.consume('query.events', async (message: any) => {
        if (message) {
          const content = JSON.parse(message.content.toString());
          await this.processEvent(content);
          this.channel.ack(message);
        }
      });

      console.log('Event consumer started for query service');
    } catch (error) {
      console.error('Failed to start event consumer:', error);
      throw error;
    }
  }

  private async processEvent(event: any): Promise<void> {
    try {
      console.log(`Processing event: ${event.eventType} for aggregate ${event.aggregateId}`);

      switch (event.eventType) {
        case 'AccountCreated':
          await this.handleAccountCreated(event);
          break;
        case 'MoneyDeposited':
          await this.handleMoneyDeposited(event);
          break;
        case 'MoneyWithdrawn':
          await this.handleMoneyWithdrawn(event);
          break;
        case 'MoneyTransferred':
          await this.handleMoneyTransferred(event);
          break;
        case 'MoneyReceived':
          await this.handleMoneyReceived(event);
          break;
        case 'TransactionRolledBack':
          await this.handleTransactionRolledBack(event);
          break;
        case 'AccountBlocked':
          await this.handleAccountBlocked(event);
          break;
        default:
          console.log(`Unknown event type: ${event.eventType}`);
      }
    } catch (error) {
      console.error(`Error processing event ${event.eventType}:`, error);
    }
  }

  private async handleAccountCreated(event: any): Promise<void> {
    await this.readModelRepository.upsertAccountBalance({
      id: event.aggregateId,
      accountNumber: event.eventData.accountNumber,
      ownerName: event.eventData.ownerName,
      balance: event.eventData.initialBalance || 0,
      status: 'ACTIVE',
      createdAt: new Date(event.occurredOn),
      version: event.version
    });
  }

  private async handleMoneyDeposited(event: any): Promise<void> {
    // Update account balance
    const currentAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (currentAccount) {
      await this.readModelRepository.upsertAccountBalance({
        ...currentAccount,
        balance: currentAccount.balance + event.eventData.amount,
        version: event.version
      });
    }

    // Add transaction record
    await this.readModelRepository.insertTransaction({
      id: uuidv4(),
      accountId: event.aggregateId,
      transactionType: 'DEPOSIT',
      amount: event.eventData.amount,
      description: event.eventData.description,
      transactionId: event.eventData.transactionId,
      status: 'COMPLETED',
      createdAt: new Date(event.occurredOn),
      metadata: event.metadata
    });
  }

  private async handleMoneyWithdrawn(event: any): Promise<void> {
    // Update account balance
    const currentAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (currentAccount) {
      await this.readModelRepository.upsertAccountBalance({
        ...currentAccount,
        balance: currentAccount.balance - event.eventData.amount,
        version: event.version
      });
    }

    // Add transaction record
    await this.readModelRepository.insertTransaction({
      id: uuidv4(),
      accountId: event.aggregateId,
      transactionType: 'WITHDRAWAL',
      amount: event.eventData.amount,
      description: event.eventData.description,
      transactionId: event.eventData.transactionId,
      status: 'COMPLETED',
      createdAt: new Date(event.occurredOn),
      metadata: event.metadata
    });
  }

  private async handleMoneyTransferred(event: any): Promise<void> {
    // Update source account balance
    const sourceAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (sourceAccount) {
      await this.readModelRepository.upsertAccountBalance({
        ...sourceAccount,
        balance: sourceAccount.balance - event.eventData.amount,
        version: event.version
      });
    }

    // Add transaction record for source account
    await this.readModelRepository.insertTransaction({
      id: uuidv4(),
      accountId: event.aggregateId,
      transactionType: 'TRANSFER_OUT',
      amount: event.eventData.amount,
      description: event.eventData.description,
      toAccountId: event.eventData.toAccountId,
      transactionId: event.eventData.transactionId,
      status: 'COMPLETED',
      createdAt: new Date(event.occurredOn),
      metadata: event.metadata
    });
  }

  private async handleMoneyReceived(event: any): Promise<void> {
    // Update destination account balance
    const destAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (destAccount) {
      await this.readModelRepository.upsertAccountBalance({
        ...destAccount,
        balance: destAccount.balance + event.eventData.amount,
        version: event.version
      });
    }

    // Add transaction record for destination account
    await this.readModelRepository.insertTransaction({
      id: uuidv4(),
      accountId: event.aggregateId,
      transactionType: 'TRANSFER_IN',
      amount: event.eventData.amount,
      description: event.eventData.description,
      fromAccountId: event.eventData.fromAccountId,
      transactionId: event.eventData.transactionId,
      status: 'COMPLETED',
      createdAt: new Date(event.occurredOn),
      metadata: event.metadata
    });
  }

  private async handleTransactionRolledBack(event: any): Promise<void> {
    // Update account balance based on rollback
    const currentAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (currentAccount) {
      let newBalance = currentAccount.balance;

      switch (event.eventData.transactionType) {
        case 'DEPOSIT':
          newBalance -= event.eventData.amount; // Reverse deposit
          break;
        case 'WITHDRAWAL':
          newBalance += event.eventData.amount; // Reverse withdrawal
          break;
        case 'TRANSFER_OUT':
          newBalance += event.eventData.amount; // Reverse transfer out
          break;
        case 'TRANSFER_IN':
          newBalance -= event.eventData.amount; // Reverse transfer in
          break;
      }

      await this.readModelRepository.upsertAccountBalance({
        ...currentAccount,
        balance: newBalance,
        version: event.version
      });
    }

    // Add rollback transaction record
    await this.readModelRepository.insertTransaction({
      id: uuidv4(),
      accountId: event.aggregateId,
      transactionType: 'ROLLBACK',
      amount: event.eventData.amount,
      description: `Rollback: ${event.eventData.rollbackReason}`,
      transactionId: event.eventData.originalTransactionId,
      status: 'COMPLETED',
      createdAt: new Date(event.occurredOn),
      metadata: {
        ...event.metadata,
        originalTransactionId: event.eventData.originalTransactionId,
        rollbackReason: event.eventData.rollbackReason
      }
    });

    // Update original transaction status
    await this.readModelRepository.updateTransactionStatus(
      event.eventData.originalTransactionId, 
      'ROLLED_BACK'
    );
  }

  private async handleAccountBlocked(event: any): Promise<void> {
    const currentAccount = await this.readModelRepository.getAccountBalance(event.aggregateId);
    if (currentAccount) {
      await this.readModelRepository.upsertAccountBalance({
        ...currentAccount,
        status: 'BLOCKED',
        version: event.version
      });
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
