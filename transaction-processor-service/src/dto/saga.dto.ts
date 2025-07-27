export interface SagaInstance {
  saga_id: string;
  saga_type: string;
  status: SagaStatus;
  correlation_id: string;
  payload: any;
  current_step: number;
  total_steps: number;
  started_at: Date;
  completed_at?: Date;
  timeout_at?: Date;
  error_message?: string;
  retry_count: number;
  created_by?: string;
  metadata: any;
}

export interface SagaStep {
  step_id: string;
  saga_id: string;
  step_number: number;
  step_name: string;
  step_type: SagaStepType;
  status: SagaStepStatus;
  input_data?: any;
  output_data?: any;
  event_ids?: string[];
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
  compensation_step_id?: string;
}

export interface SagaStepDefinition {
  definition_id: string;
  saga_type: string;
  step_number: number;
  step_name: string;
  step_description?: string;
  compensation_step_name?: string;
  is_compensatable: boolean;
  timeout_seconds: number;
  max_retries: number;
}

export interface SagaEvent {
  event_id: string;
  saga_id: string;
  event_type: string;
  event_data: any;
  created_at: Date;
}

export enum SagaStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
}

export enum SagaStepStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
}

export enum SagaStepType {
  FORWARD = 'FORWARD',
  COMPENSATION = 'COMPENSATION',
}

export enum SagaType {
  MONEY_TRANSFER = 'MONEY_TRANSFER',
}

export enum MoneyTransferSteps {
  VALIDATE_TRANSFER = 'VALIDATE_TRANSFER',
  WITHDRAW_FROM_SOURCE = 'WITHDRAW_FROM_SOURCE',
  DEPOSIT_TO_TARGET = 'DEPOSIT_TO_TARGET',
  FINALIZE_TRANSFER = 'FINALIZE_TRANSFER',
}

export enum CompensationSteps {
  COMPENSATE_WITHDRAW = 'COMPENSATE_WITHDRAW',
  COMPENSATE_DEPOSIT = 'COMPENSATE_DEPOSIT',
  REVERSE_FINALIZATION = 'REVERSE_FINALIZATION',
}

// Saga Events
export interface SagaStartedEvent {
  eventId: string;
  eventType: 'SagaStarted';
  sagaId: string;
  sagaType: string;
  correlationId: string;
  payload: any;
  occurredOn: Date;
  metadata: any;
}

export interface SagaStepCompletedEvent {
  eventId: string;
  eventType: 'SagaStepCompleted';
  sagaId: string;
  stepNumber: number;
  stepName: string;
  outputData: any;
  occurredOn: Date;
  metadata: any;
}

export interface SagaCompletedEvent {
  eventId: string;
  eventType: 'SagaCompleted';
  sagaId: string;
  correlationId: string;
  finalResult: any;
  occurredOn: Date;
  metadata: any;
}

export interface SagaFailedEvent {
  eventId: string;
  eventType: 'SagaFailed';
  sagaId: string;
  correlationId: string;
  errorMessage: string;
  failedStep: string;
  occurredOn: Date;
  metadata: any;
}

export interface CompensationStartedEvent {
  eventId: string;
  eventType: 'CompensationStarted';
  sagaId: string;
  reason: string;
  compensationSteps: string[];
  occurredOn: Date;
  metadata: any;
}

export interface CompensationCompletedEvent {
  eventId: string;
  eventType: 'CompensationCompleted';
  sagaId: string;
  compensatedSteps: string[];
  occurredOn: Date;
  metadata: any;
}

// Transfer-specific saga payload
export interface MoneyTransferSagaPayload {
  transferRequestId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  requestedAt: string;
}

// Step execution context
export interface SagaStepContext {
  sagaId: string;
  stepNumber: number;
  stepName: string;
  inputData: any;
  sagaPayload: any;
  metadata: any;
}

// Step execution result
export interface SagaStepResult {
  success: boolean;
  outputData?: any;
  eventIds?: string[];
  error?: string;
  shouldCompensate?: boolean;
}

// Compensation context
export interface CompensationContext {
  sagaId: string;
  originalStepName: string;
  compensationStepName: string;
  originalOutputData: any;
  reason: string;
  metadata: any;
} 