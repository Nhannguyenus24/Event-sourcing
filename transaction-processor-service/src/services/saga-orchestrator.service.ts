/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { SagaDatabaseClient } from '../clients/saga-database.client';
import { EventStoreClient } from '../clients/event-store.client';
import { RabbitMQPublisher } from '../infrastructure/rabbitmq-publisher';
import {
  SagaInstance,
  SagaStep,
  //SagaStepDefinition,
  SagaStatus,
  SagaStepStatus,
  SagaStepType,
  SagaType,
  MoneyTransferSteps,
  CompensationSteps,
  MoneyTransferSagaPayload,
  SagaStepContext,
  SagaStepResult,
  //CompensationContext,
  SagaStartedEvent,
  SagaStepCompletedEvent,
  SagaCompletedEvent,
  SagaFailedEvent,
  CompensationStartedEvent,
  CompensationCompletedEvent,
} from '../dto/saga.dto';
//import { AccountBalance } from '../dto/transfer-events.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SagaOrchestratorService {
  private readonly logger = new Logger(SagaOrchestratorService.name);

  constructor(
    private readonly sagaDb: SagaDatabaseClient,
    private readonly eventStoreClient: EventStoreClient,
    private readonly eventPublisher: RabbitMQPublisher,
  ) {}

  // ============================================================================
  // SAGA LIFECYCLE MANAGEMENT
  // ============================================================================

  async startMoneyTransferSaga(
    payload: MoneyTransferSagaPayload,
  ): Promise<SagaInstance> {
    this.logger.log(
      `Starting money transfer saga for request: ${payload.transferRequestId}`,
    );

    try {
      // Create saga instance
      const saga = await this.sagaDb.createSagaInstance({
        sagaType: SagaType.MONEY_TRANSFER,
        correlationId: payload.transferRequestId,
        payload,
        totalSteps: 4, // VALIDATE, WITHDRAW, DEPOSIT, FINALIZE
        timeoutMinutes: 10,
        createdBy: 'transaction-processor',
        metadata: {
          source: 'transfer-request',
          amount: payload.amount,
          fromAccount: payload.fromAccountId,
          toAccount: payload.toAccountId,
        },
      });

      // Get step definitions for this saga type
      const stepDefinitions = await this.sagaDb.getSagaStepDefinitions(
        SagaType.MONEY_TRANSFER,
      );

      // Create forward steps
      for (const stepDef of stepDefinitions) {
        await this.sagaDb.createSagaStep({
          sagaId: saga.saga_id,
          stepNumber: stepDef.step_number,
          stepName: stepDef.step_name,
          stepType: SagaStepType.FORWARD,
          inputData: this.prepareStepInputData(stepDef.step_name, payload),
        });
      }

      // Publish saga started event
      await this.publishSagaStartedEvent(saga);

      // Start executing first step
      await this.executeNextStep(saga.saga_id);

      return saga;
    } catch (error) {
      this.logger.error(
        `Failed to start money transfer saga: ${error.message}`,
      );
      throw error;
    }
  }

  async executeNextStep(sagaId: string): Promise<void> {
    try {
      const saga = await this.sagaDb.getSagaInstance(sagaId);
      if (!saga) {
        throw new Error(`Saga ${sagaId} not found`);
      }

      if (saga.status !== SagaStatus.STARTED) {
        this.logger.warn(
          `Saga ${sagaId} is not in STARTED status, current: ${saga.status}`,
        );
        return;
      }

      // Get next step to execute
      const nextStepNumber = saga.current_step + 1;
      const steps = await this.sagaDb.getSagaSteps(
        sagaId,
        SagaStepType.FORWARD,
      );
      const nextStep = steps.find((s) => s.step_number === nextStepNumber);

      if (!nextStep) {
        // All steps completed, mark saga as completed
        await this.completeSaga(sagaId);
        return;
      }

      // Execute the step
      await this.executeStep(saga, nextStep);
    } catch (error) {
      this.logger.error(
        `Failed to execute next step for saga ${sagaId}: ${error.message}`,
      );
      await this.handleSagaFailure(
        sagaId,
        error.message,
        'STEP_EXECUTION_ERROR',
      );
    }
  }

  async executeStep(saga: SagaInstance, step: SagaStep): Promise<void> {
    this.logger.debug(
      `Executing step ${step.step_number}: ${step.step_name} for saga ${saga.saga_id}`,
    );

    try {
      // Update step status to executing
      await this.sagaDb.updateSagaStepStatus(
        step.step_id,
        SagaStepStatus.EXECUTING,
      );

      // Update saga current step
      await this.sagaDb.updateSagaStatus(
        saga.saga_id,
        SagaStatus.STARTED,
        step.step_number,
      );

      // Prepare step context
      const context: SagaStepContext = {
        sagaId: saga.saga_id,
        stepNumber: step.step_number,
        stepName: step.step_name,
        inputData: step.input_data,
        sagaPayload: saga.payload,
        metadata: saga.metadata,
      };

      // Execute step based on step name
      const result = await this.executeStepByName(step.step_name, context);

      if (result.success) {
        // Mark step as completed
        await this.sagaDb.updateSagaStepStatus(
          step.step_id,
          SagaStepStatus.COMPLETED,
          result.outputData,
          result.eventIds,
        );

        // Publish step completed event
        await this.publishSagaStepCompletedEvent(
          saga.saga_id,
          step,
          result.outputData,
        );

        // Execute next step
        await this.executeNextStep(saga.saga_id);
      } else {
        // Step failed, handle failure
        await this.handleStepFailure(
          saga,
          step,
          result.error || 'Unknown error',
        );
      }
    } catch (error) {
      await this.handleStepFailure(saga, step, error.message);
    }
  }

  async executeStepByName(
    stepName: string,
    context: SagaStepContext,
  ): Promise<SagaStepResult> {
    switch (stepName) {
      case MoneyTransferSteps.VALIDATE_TRANSFER:
        return await this.executeValidateTransferStep(context);

      case MoneyTransferSteps.WITHDRAW_FROM_SOURCE:
        return await this.executeWithdrawStep(context);

      case MoneyTransferSteps.DEPOSIT_TO_TARGET:
        return await this.executeDepositStep(context);

      case MoneyTransferSteps.FINALIZE_TRANSFER:
        return await this.executeFinalizeStep(context);

      default:
        throw new Error(`Unknown step name: ${stepName}`);
    }
  }

  // ============================================================================
  // STEP IMPLEMENTATIONS
  // ============================================================================

  private async executeValidateTransferStep(
    context: SagaStepContext,
  ): Promise<SagaStepResult> {
    try {
      const payload = context.sagaPayload as MoneyTransferSagaPayload;

      // Validate transfer request
      if (!payload.fromAccountId || !payload.toAccountId) {
        return {
          success: false,
          error: 'From and To account IDs are required',
        };
      }

      if (payload.fromAccountId === payload.toAccountId) {
        return { success: false, error: 'Cannot transfer to the same account' };
      }

      if (payload.amount <= 0) {
        return { success: false, error: 'Transfer amount must be positive' };
      }

      if (payload.amount > 1000000) {
        return {
          success: false,
          error: 'Transfer amount exceeds maximum limit',
        };
      }

      // Get and validate account balances
      const [fromAccount, toAccount] = await Promise.all([
        this.eventStoreClient.calculateAccountBalance(payload.fromAccountId),
        this.eventStoreClient.calculateAccountBalance(payload.toAccountId),
      ]);

      // Validate accounts
      if (fromAccount.status !== 'ACTIVE') {
        return {
          success: false,
          error: `From account is ${fromAccount.status} - cannot transfer`,
        };
      }

      if (fromAccount.balance < payload.amount) {
        return {
          success: false,
          error: `Insufficient funds. Available: ${fromAccount.balance}, Required: ${payload.amount}`,
        };
      }

      if (toAccount.status === 'BLOCKED') {
        return {
          success: false,
          error: 'Destination account is blocked - cannot receive transfer',
        };
      }

      return {
        success: true,
        outputData: {
          fromAccount,
          toAccount,
          validatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: `Validation failed: ${error.message}` };
    }
  }

  private async executeWithdrawStep(
    context: SagaStepContext,
  ): Promise<SagaStepResult> {
    try {
      const payload = context.sagaPayload as MoneyTransferSagaPayload;

      // Fetch fresh account data to get current version
      const fromAccount = await this.eventStoreClient.calculateAccountBalance(
        payload.fromAccountId,
      );

      const transactionId = `TXN-WITHDRAW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create withdraw event
      const withdrawEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyTransferred',
        aggregateId: payload.fromAccountId,
        eventData: {
          amount: payload.amount,
          toAccountId: payload.toAccountId,
          description:
            payload.description || `Saga transfer to ${payload.toAccountId}`,
          transactionId,
          sagaId: context.sagaId,
          transferRequestId: payload.transferRequestId,
        },
        version: fromAccount.version + 1,
        occurredOn: new Date(),
        metadata: {
          source: 'saga-orchestrator',
          sagaId: context.sagaId,
          stepName: context.stepName,
        },
      };

      // Append event to event store
      await this.eventStoreClient.appendEvents(
        payload.fromAccountId,
        [withdrawEvent],
        fromAccount.version,
      );

      return {
        success: true,
        outputData: {
          transactionId,
          withdrawnAmount: payload.amount,
          fromAccountId: payload.fromAccountId,
          newBalance: fromAccount.balance - payload.amount,
        },
        eventIds: [withdrawEvent.eventId],
      };
    } catch (error) {
      return {
        success: false,
        error: `Withdraw failed: ${error.message}`,
        shouldCompensate: false,
      };
    }
  }

  private async executeDepositStep(
    context: SagaStepContext,
  ): Promise<SagaStepResult> {
    try {
      const payload = context.sagaPayload as MoneyTransferSagaPayload;
      const withdrawData = context.inputData;

      const transactionId = withdrawData.transactionId;

      // Get fresh account data to get current version
      const toAccount = await this.eventStoreClient.calculateAccountBalance(
        payload.toAccountId,
      );

      // Create deposit event
      const depositEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyReceived',
        aggregateId: payload.toAccountId,
        eventData: {
          amount: payload.amount,
          fromAccountId: payload.fromAccountId,
          description:
            payload.description ||
            `Saga transfer from ${payload.fromAccountId}`,
          transactionId,
          sagaId: context.sagaId,
          transferRequestId: payload.transferRequestId,
        },
        version: toAccount.version + 1,
        occurredOn: new Date(),
        metadata: {
          source: 'saga-orchestrator',
          sagaId: context.sagaId,
          stepName: context.stepName,
        },
      };

      // Append event to event store
      await this.eventStoreClient.appendEvents(
        payload.toAccountId,
        [depositEvent],
        toAccount.version,
      );

      return {
        success: true,
        outputData: {
          transactionId,
          depositedAmount: payload.amount,
          toAccountId: payload.toAccountId,
          newBalance: toAccount.balance + payload.amount,
        },
        eventIds: [depositEvent.eventId],
      };
    } catch (error) {
      return {
        success: false,
        error: `Deposit failed: ${error.message}`,
        shouldCompensate: true,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async executeFinalizeStep(
    context: SagaStepContext,
  ): Promise<SagaStepResult> {
    try {
      const payload = context.sagaPayload as MoneyTransferSagaPayload;

      // Mark transfer as finalized in metadata
      const finalizationData = {
        transferRequestId: payload.transferRequestId,
        sagaId: context.sagaId,
        finalizedAt: new Date().toISOString(),
        status: 'COMPLETED',
      };

      return {
        success: true,
        outputData: finalizationData,
      };
    } catch (error) {
      return { success: false, error: `Finalization failed: ${error.message}` };
    }
  }

  // ============================================================================
  // COMPENSATION LOGIC
  // ============================================================================

  async startCompensation(sagaId: string, reason: string): Promise<void> {
    this.logger.log(
      `Starting compensation for saga ${sagaId}, reason: ${reason}`,
    );

    try {
      // Update saga status to compensating
      await this.sagaDb.updateSagaStatus(
        sagaId,
        SagaStatus.COMPENSATING,
        undefined,
        reason,
      );

      // Get completed forward steps that need compensation
      const completedSteps = await this.sagaDb.getSagaSteps(
        sagaId,
        SagaStepType.FORWARD,
      );
      const stepsToCompensate = completedSteps.filter(
        (s) => s.status === SagaStepStatus.COMPLETED,
      );

      if (stepsToCompensate.length === 0) {
        // No steps to compensate, mark as compensated
        await this.sagaDb.updateSagaStatus(sagaId, SagaStatus.COMPENSATED);
        return;
      }

      // Create compensation steps (in reverse order)
      const stepDefinitions = await this.sagaDb.getSagaStepDefinitions(
        SagaType.MONEY_TRANSFER,
      );
      for (let i = stepsToCompensate.length - 1; i >= 0; i--) {
        const step = stepsToCompensate[i];
        const stepDef = stepDefinitions.find(
          (d) => d.step_name === step.step_name,
        );

        if (stepDef?.is_compensatable && stepDef.compensation_step_name) {
          await this.sagaDb.createSagaStep({
            sagaId,
            stepNumber: 100 + (stepsToCompensate.length - i), // Start from 101, 102, etc.
            stepName: stepDef.compensation_step_name,
            stepType: SagaStepType.COMPENSATION,
            inputData: step.output_data,
            compensationStepId: step.step_id,
          });
        }
      }

      // Publish compensation started event
      await this.publishCompensationStartedEvent(
        sagaId,
        reason,
        stepsToCompensate.map((s) => s.step_name),
      );

      // Start executing compensation steps
      await this.executeNextCompensationStep(sagaId);
    } catch (error) {
      this.logger.error(
        `Failed to start compensation for saga ${sagaId}: ${error.message}`,
      );
      await this.sagaDb.updateSagaStatus(
        sagaId,
        SagaStatus.FAILED,
        undefined,
        `Compensation failed: ${error.message}`,
      );
    }
  }

  async executeNextCompensationStep(sagaId: string): Promise<void> {
    try {
      const compensationSteps = await this.sagaDb.getSagaSteps(
        sagaId,
        SagaStepType.COMPENSATION,
      );
      const pendingStep = compensationSteps.find(
        (s) => s.status === SagaStepStatus.PENDING,
      );

      if (!pendingStep) {
        // All compensation steps completed
        await this.sagaDb.updateSagaStatus(sagaId, SagaStatus.COMPENSATED);

        // Publish compensation completed event
        await this.publishCompensationCompletedEvent(
          sagaId,
          compensationSteps.map((s) => s.step_name),
        );
        return;
      }

      // Execute compensation step
      await this.executeCompensationStep(sagaId, pendingStep);
    } catch (error) {
      this.logger.error(
        `Failed to execute compensation step for saga ${sagaId}: ${error.message}`,
      );
      await this.sagaDb.updateSagaStatus(
        sagaId,
        SagaStatus.FAILED,
        undefined,
        `Compensation execution failed: ${error.message}`,
      );
    }
  }

  async executeCompensationStep(sagaId: string, step: SagaStep): Promise<void> {
    this.logger.debug(
      `Executing compensation step: ${step.step_name} for saga ${sagaId}`,
    );

    try {
      // Update step status to executing
      await this.sagaDb.updateSagaStepStatus(
        step.step_id,
        SagaStepStatus.EXECUTING,
      );

      // Execute compensation logic based on step name
      const result = await this.executeCompensationByName(
        step.step_name,
        sagaId,
        step.input_data,
      );

      if (result.success) {
        await this.sagaDb.updateSagaStepStatus(
          step.step_id,
          SagaStepStatus.COMPENSATED,
          result.outputData,
          result.eventIds,
        );

        // Execute next compensation step
        await this.executeNextCompensationStep(sagaId);
      } else {
        await this.sagaDb.updateSagaStepStatus(
          step.step_id,
          SagaStepStatus.FAILED,
          undefined,
          undefined,
          result.error,
        );
        await this.sagaDb.updateSagaStatus(
          sagaId,
          SagaStatus.FAILED,
          undefined,
          `Compensation failed: ${result.error}`,
        );
      }
    } catch (error) {
      await this.sagaDb.updateSagaStepStatus(
        step.step_id,
        SagaStepStatus.FAILED,
        undefined,
        undefined,
        error.message,
      );
      await this.sagaDb.updateSagaStatus(
        sagaId,
        SagaStatus.FAILED,
        undefined,
        `Compensation error: ${error.message}`,
      );
    }
  }

  async executeCompensationByName(
    stepName: string,
    sagaId: string,
    inputData: any,
  ): Promise<SagaStepResult> {
    switch (stepName) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case CompensationSteps.COMPENSATE_WITHDRAW:
        return await this.compensateWithdraw(sagaId, inputData);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case CompensationSteps.COMPENSATE_DEPOSIT:
        return await this.compensateDeposit(sagaId, inputData);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case CompensationSteps.REVERSE_FINALIZATION:
        return await this.reverseFinalization(sagaId, inputData);

      default:
        throw new Error(`Unknown compensation step: ${stepName}`);
    }
  }

  private async compensateWithdraw(
    sagaId: string,
    withdrawData: any,
  ): Promise<SagaStepResult> {
    // Compensation for withdraw = deposit back the amount
    try {
      const compensationEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyReceived',
        aggregateId: withdrawData.fromAccountId,
        eventData: {
          amount: withdrawData.withdrawnAmount,
          fromAccountId: 'COMPENSATION_SYSTEM',
          description: `Compensation for saga ${sagaId} - deposit back withdrawn amount`,
          transactionId: `COMP-${withdrawData.transactionId}`,
          sagaId,
        },
        version: 1, // Will be updated by event store
        occurredOn: new Date(),
        metadata: {
          source: 'saga-compensator',
          compensationType: 'WITHDRAW_COMPENSATION',
          originalTransactionId: withdrawData.transactionId,
        },
      };

      // Get current account for version
      const account = await this.eventStoreClient.calculateAccountBalance(
        withdrawData.fromAccountId,
      );

      await this.eventStoreClient.appendEvents(
        withdrawData.fromAccountId,
        [compensationEvent],
        account.version,
      );

      return {
        success: true,
        outputData: { compensatedAmount: withdrawData.withdrawnAmount },
        eventIds: [compensationEvent.eventId],
      };
    } catch (error) {
      return {
        success: false,
        error: `Withdraw compensation failed: ${error.message}`,
      };
    }
  }

  private async compensateDeposit(
    sagaId: string,
    depositData: any,
  ): Promise<SagaStepResult> {
    // Compensation for deposit = withdraw back the amount
    try {
      const compensationEvent = {
        eventId: uuidv4(),
        eventType: 'MoneyTransferred',
        aggregateId: depositData.toAccountId,
        eventData: {
          amount: depositData.depositedAmount,
          toAccountId: 'COMPENSATION_SYSTEM',
          description: `Compensation for saga ${sagaId} - withdraw back deposited amount`,
          transactionId: `COMP-${depositData.transactionId}`,
          sagaId,
        },
        version: 1, // Will be updated by event store
        occurredOn: new Date(),
        metadata: {
          source: 'saga-compensator',
          compensationType: 'DEPOSIT_COMPENSATION',
          originalTransactionId: depositData.transactionId,
        },
      };

      // Get current account for version
      const account = await this.eventStoreClient.calculateAccountBalance(
        depositData.toAccountId,
      );

      await this.eventStoreClient.appendEvents(
        depositData.toAccountId,
        [compensationEvent],
        account.version,
      );

      return {
        success: true,
        outputData: { compensatedAmount: depositData.depositedAmount },
        eventIds: [compensationEvent.eventId],
      };
    } catch (error) {
      return {
        success: false,
        error: `Deposit compensation failed: ${error.message}`,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async reverseFinalization(
    sagaId: string,
    finalizationData: any,
  ): Promise<SagaStepResult> {
    // Reverse finalization is just marking as reversed, no events needed
    return {
      success: true,
      outputData: {
        reversedAt: new Date().toISOString(),
        originalFinalization: finalizationData,
      },
    };
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  async handleStepFailure(
    saga: SagaInstance,
    step: SagaStep,
    error: string,
  ): Promise<void> {
    this.logger.error(
      `Step ${step.step_name} failed for saga ${saga.saga_id}: ${error}`,
    );

    // Mark step as failed
    await this.sagaDb.updateSagaStepStatus(
      step.step_id,
      SagaStepStatus.FAILED,
      undefined,
      undefined,
      error,
    );

    // Check if we should compensate
    const stepDefinitions = await this.sagaDb.getSagaStepDefinitions(
      saga.saga_type,
    );
    const stepDef = stepDefinitions.find((d) => d.step_name === step.step_name);

    if (stepDef?.is_compensatable) {
      // Start compensation
      await this.startCompensation(
        saga.saga_id,
        `Step ${step.step_name} failed: ${error}`,
      );
    } else {
      // Mark saga as failed
      await this.handleSagaFailure(saga.saga_id, error, step.step_name);
    }
  }

  async handleSagaFailure(
    sagaId: string,
    error: string,
    failedStep?: string,
  ): Promise<void> {
    this.logger.error(`Saga ${sagaId} failed: ${error}`);

    // Update saga status
    await this.sagaDb.updateSagaStatus(
      sagaId,
      SagaStatus.FAILED,
      undefined,
      error,
    );

    // Publish saga failed event
    await this.publishSagaFailedEvent(sagaId, error, failedStep);
  }

  async completeSaga(sagaId: string): Promise<void> {
    this.logger.log(`Completing saga ${sagaId}`);

    try {
      // Update saga status
      await this.sagaDb.updateSagaStatus(sagaId, SagaStatus.COMPLETED);

      // Get saga instance for final result
      const saga = await this.sagaDb.getSagaInstance(sagaId);
      if (!saga) {
        throw new Error(`Saga ${sagaId} not found during completion`);
      }

      // Publish saga completed event
      await this.publishSagaCompletedEvent(
        sagaId,
        saga.correlation_id,
        saga.payload,
      );
    } catch (error) {
      this.logger.error(`Failed to complete saga ${sagaId}: ${error.message}`);
      await this.handleSagaFailure(
        sagaId,
        `Completion failed: ${error.message}`,
        'COMPLETION',
      );
    }
  }

  // ============================================================================
  // EVENT PUBLISHING
  // ============================================================================

  private async publishSagaStartedEvent(saga: SagaInstance): Promise<void> {
    const event: SagaStartedEvent = {
      eventId: uuidv4(),
      eventType: 'SagaStarted',
      sagaId: saga.saga_id,
      sagaType: saga.saga_type,
      correlationId: saga.correlation_id,
      payload: saga.payload,
      occurredOn: new Date(),
      metadata: saga.metadata,
    };

    await this.eventPublisher.publishEvent(event);
  }

  private async publishSagaStepCompletedEvent(
    sagaId: string,
    step: SagaStep,
    outputData: any,
  ): Promise<void> {
    const event: SagaStepCompletedEvent = {
      eventId: uuidv4(),
      eventType: 'SagaStepCompleted',
      sagaId,
      stepNumber: step.step_number,
      stepName: step.step_name,
      outputData,
      occurredOn: new Date(),
      metadata: { stepId: step.step_id },
    };

    await this.eventPublisher.publishEvent(event);
  }

  private async publishSagaCompletedEvent(
    sagaId: string,
    correlationId: string,
    finalResult: any,
  ): Promise<void> {
    const event: SagaCompletedEvent = {
      eventId: uuidv4(),
      eventType: 'SagaCompleted',
      sagaId,
      correlationId,
      finalResult,
      occurredOn: new Date(),
      metadata: { source: 'saga-orchestrator' },
    };

    await this.eventPublisher.publishEvent(event);
  }

  private async publishSagaFailedEvent(
    sagaId: string,
    errorMessage: string,
    failedStep?: string,
  ): Promise<void> {
    const saga = await this.sagaDb.getSagaInstance(sagaId);
    if (!saga) {
      this.logger.error(
        `Cannot publish failed event: Saga ${sagaId} not found`,
      );
      return;
    }

    const event: SagaFailedEvent = {
      eventId: uuidv4(),
      eventType: 'SagaFailed',
      sagaId,
      correlationId: saga.correlation_id,
      errorMessage,
      failedStep: failedStep || 'UNKNOWN',
      occurredOn: new Date(),
      metadata: { source: 'saga-orchestrator' },
    };

    await this.eventPublisher.publishEvent(event);
  }

  private async publishCompensationStartedEvent(
    sagaId: string,
    reason: string,
    compensationSteps: string[],
  ): Promise<void> {
    const event: CompensationStartedEvent = {
      eventId: uuidv4(),
      eventType: 'CompensationStarted',
      sagaId,
      reason,
      compensationSteps,
      occurredOn: new Date(),
      metadata: { source: 'saga-orchestrator' },
    };

    await this.eventPublisher.publishEvent(event);
  }

  private async publishCompensationCompletedEvent(
    sagaId: string,
    compensatedSteps: string[],
  ): Promise<void> {
    const event: CompensationCompletedEvent = {
      eventId: uuidv4(),
      eventType: 'CompensationCompleted',
      sagaId,
      compensatedSteps,
      occurredOn: new Date(),
      metadata: { source: 'saga-orchestrator' },
    };

    await this.eventPublisher.publishEvent(event);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private prepareStepInputData(
    stepName: string,
    payload: MoneyTransferSagaPayload,
  ): any {
    switch (stepName) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case MoneyTransferSteps.VALIDATE_TRANSFER:
        return {
          transferRequest: payload,
          validationRules: {
            maxAmount: 1000000,
            minAmount: 0.01,
          },
        };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case MoneyTransferSteps.WITHDRAW_FROM_SOURCE:
        return {
          accountId: payload.fromAccountId,
          amount: payload.amount,
          description: payload.description,
        };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case MoneyTransferSteps.DEPOSIT_TO_TARGET:
        return {
          accountId: payload.toAccountId,
          amount: payload.amount,
          description: payload.description,
        };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case MoneyTransferSteps.FINALIZE_TRANSFER:
        return {
          transferRequestId: payload.transferRequestId,
          fromAccountId: payload.fromAccountId,
          toAccountId: payload.toAccountId,
          amount: payload.amount,
        };

      default:
        return {};
    }
  }
}
