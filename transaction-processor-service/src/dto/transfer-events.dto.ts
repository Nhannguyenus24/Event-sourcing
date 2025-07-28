export interface TransferRequestedEvent {
  eventId: string;
  eventType: 'TransferRequested';
  aggregateId: string;
  eventData: {
    transferRequestId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    requestedAt: string;
  };
  version: number;
  occurredOn: Date;
  metadata: {
    source: string;
    requestOrigin: string;
  };
}

export interface AccountBalance {
  accountId: string;
  accountNumber: string;
  ownerName: string;
  balance: number;
  status: string;
  version: number;
}

export interface TransferResult {
  success: boolean;
  transferRequestId: string;
  transactionId?: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  error?: string;
  processedAt: string;
}

export interface TransferCompletedEvent {
  eventId: string;
  eventType: 'TransferCompleted';
  aggregateId: string;
  eventData: {
    transferRequestId: string;
    transactionId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    fromAccountBalance: number;
    toAccountBalance: number;
    processedAt: string;
  };
  version: number;
  occurredOn: Date;
  metadata: {
    source: string;
    processor: string;
  };
}

export interface TransferFailedEvent {
  eventId: string;
  eventType: 'TransferFailed';
  aggregateId: string;
  eventData: {
    transferRequestId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    error: string;
    reason: string;
    processedAt: string;
  };
  version: number;
  occurredOn: Date;
  metadata: {
    source: string;
    processor: string;
  };
}
