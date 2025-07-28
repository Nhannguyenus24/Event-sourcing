import { Injectable, Logger } from '@nestjs/common';
import { EventStoreClient } from '../clients/event-store.client';
import { RabbitMQPublisher } from '../infrastructure/rabbitmq-publisher';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import {
  TransferRequestedEvent,
  TransferResult,
  TransferCompletedEvent,
  TransferFailedEvent,
  AccountBalance,
} from '../dto/transfer-events.dto';
import { MoneyTransferSagaPayload } from '../dto/saga.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TransferProcessorService {
  private readonly logger = new Logger(TransferProcessorService.name);

  constructor(
    private readonly eventStoreClient: EventStoreClient,
    private readonly rabbitmqPublisher: RabbitMQPublisher,
    private readonly sagaOrchestrator: SagaOrchestratorService,
  ) {}

  async processTransfer(
    transferEvent: TransferRequestedEvent,
  ): Promise<TransferResult> {
    const {
      transferRequestId,
      fromAccountId,
      toAccountId,
      amount,
      description,
    } = transferEvent.eventData;

    this.logger.log(
      `Processing transfer request with SAGA pattern: ${transferRequestId}`,
    );

    try {
      // Create saga payload from transfer event
      const sagaPayload: MoneyTransferSagaPayload = {
        transferRequestId,
        fromAccountId,
        toAccountId,
        amount,
        description,
        requestedAt: transferEvent.eventData.requestedAt,
      };

      // Start money transfer saga
      const saga =
        await this.sagaOrchestrator.startMoneyTransferSaga(sagaPayload);

      this.logger.log(
        `Started saga ${saga.saga_id} for transfer request: ${transferRequestId}`,
      );

      // Return saga-based result (PENDING until saga completes)
      return {
        success: true, // Saga started successfully
        transferRequestId,
        transactionId: saga.saga_id, // Use saga ID as transaction reference
        fromAccountId,
        toAccountId,
        amount,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Saga startup failed for transfer ${transferRequestId}:`,
        error,
      );

      // Publish failure event for saga startup failure
      await this.publishTransferFailedEvent(
        transferEvent,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Saga startup failed: ${error.message}`,
      );

      return {
        success: false,
        transferRequestId,
        fromAccountId,
        toAccountId,
        amount,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error: `Saga startup failed: ${error.message}`,
        processedAt: new Date().toISOString(),
      };
    }
  }

  private validateTransferRequest(transferEvent: TransferRequestedEvent): void {
    const { fromAccountId, toAccountId, amount } = transferEvent.eventData;

    if (!fromAccountId || !toAccountId) {
      throw new Error('From and To account IDs are required');
    }

    if (fromAccountId === toAccountId) {
      throw new Error('Cannot transfer to the same account');
    }

    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (amount > 1000000) {
      // Max transfer limit
      throw new Error('Transfer amount exceeds maximum limit');
    }
  }

  private validateAccountsForTransfer(
    fromAccount: AccountBalance,
    toAccount: AccountBalance,
    amount: number,
  ): void {
    // Validate from account
    if (fromAccount.status !== 'ACTIVE') {
      throw new Error(
        `From account is ${fromAccount.status} - cannot transfer`,
      );
    }

    if (fromAccount.balance < amount) {
      throw new Error(
        `Insufficient funds. Available: ${fromAccount.balance}, Required: ${amount}`,
      );
    }

    // Validate to account
    if (toAccount.status === 'BLOCKED') {
      throw new Error(
        'Destination account is blocked - cannot receive transfer',
      );
    }

    // Additional business rules
    if (fromAccount.balance - amount < 0) {
      throw new Error('Transfer would result in negative balance');
    }
  }

  private async executeTransfer(
    transferEvent: TransferRequestedEvent,
    fromAccount: AccountBalance,
    toAccount: AccountBalance,
  ): Promise<TransferResult> {
    const {
      transferRequestId,
      fromAccountId,
      toAccountId,
      amount,
      description,
    } = transferEvent.eventData;
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create transfer events for both accounts
      const transferOutEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyTransferred',
        aggregateId: fromAccountId,
        eventData: {
          amount,
          toAccountId,
          description: description || `Transfer to ${toAccount.ownerName}`,
          transactionId,
          transferRequestId,
        },
        version: fromAccount.version + 1,
        occurredOn: new Date(),
        metadata: {
          source: 'transaction-processor-service',
          transferRequestId,
        },
      };

      const transferInEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyReceived',
        aggregateId: toAccountId,
        eventData: {
          amount,
          fromAccountId,
          description: description || `Transfer from ${fromAccount.ownerName}`,
          transactionId,
          transferRequestId,
        },
        version: toAccount.version + 1,
        occurredOn: new Date(),
        metadata: {
          source: 'transaction-processor-service',
          transferRequestId,
        },
      };

      // Append events to event store
      await Promise.all([
        this.eventStoreClient.appendEvents(
          fromAccountId,
          [transferOutEvent],
          fromAccount.version,
        ),
        this.eventStoreClient.appendEvents(
          toAccountId,
          [transferInEvent],
          toAccount.version,
        ),
      ]);

      this.logger.debug(
        `Transfer events appended to event store: ${transactionId}`,
      );

      return {
        success: true,
        transferRequestId,
        transactionId,
        fromAccountId,
        toAccountId,
        amount,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute transfer: ${transferRequestId}`,
        error,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Transfer execution failed: ${error.message}`);
    }
  }

  private async publishTransferCompletedEvent(
    result: TransferResult,
    fromAccount: AccountBalance,
    toAccount: AccountBalance,
  ): Promise<void> {
    // Ensure we have a transactionId for successful transfers
    if (!result.transactionId) {
      throw new Error('TransactionId is required for completed transfers');
    }

    const completedEvent: TransferCompletedEvent = {
      eventId: uuidv4(),
      eventType: 'TransferCompleted',
      aggregateId: result.fromAccountId,
      eventData: {
        transferRequestId: result.transferRequestId,
        transactionId: result.transactionId,
        fromAccountId: result.fromAccountId,
        toAccountId: result.toAccountId,
        amount: result.amount,
        fromAccountBalance: fromAccount.balance - result.amount,
        toAccountBalance: toAccount.balance + result.amount,
        processedAt: result.processedAt,
      },
      version: 1,
      occurredOn: new Date(),
      metadata: {
        source: 'transaction-processor-service',
        processor: 'transfer-processor',
      },
    };

    await this.rabbitmqPublisher.publishEvent(completedEvent);
  }

  private async publishTransferFailedEvent(
    transferEvent: TransferRequestedEvent,
    errorMessage: string,
  ): Promise<void> {
    const failedEvent: TransferFailedEvent = {
      eventId: uuidv4(),
      eventType: 'TransferFailed',
      aggregateId: transferEvent.eventData.fromAccountId,
      eventData: {
        transferRequestId: transferEvent.eventData.transferRequestId,
        fromAccountId: transferEvent.eventData.fromAccountId,
        toAccountId: transferEvent.eventData.toAccountId,
        amount: transferEvent.eventData.amount,
        error: errorMessage,
        reason: 'PROCESSING_ERROR',
        processedAt: new Date().toISOString(),
      },
      version: 1,
      occurredOn: new Date(),
      metadata: {
        source: 'transaction-processor-service',
        processor: 'transfer-processor',
      },
    };

    await this.rabbitmqPublisher.publishEvent(failedEvent);
  }
}
