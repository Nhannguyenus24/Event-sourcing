import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from './aggregate-root';

// Domain Events
export class AccountCreatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'AccountCreated';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      accountNumber: string;
      ownerName: string;
      initialBalance: number;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class MoneyDepositedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'MoneyDeposited';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      amount: number;
      description?: string;
      transactionId: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class MoneyWithdrawnEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'MoneyWithdrawn';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      amount: number;
      description?: string;
      transactionId: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class MoneyTransferredEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'MoneyTransferred';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      amount: number;
      toAccountId: string;
      description?: string;
      transactionId: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class MoneyReceivedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'MoneyReceived';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      amount: number;
      fromAccountId: string;
      description?: string;
      transactionId: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class TransactionRolledBackEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'TransactionRolledBack';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      originalTransactionId: string;
      rollbackReason: string;
      amount: number;
      transactionType: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}

export class AccountBlockedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'AccountBlocked';
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly eventData: {
      reason: string;
    },
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = uuidv4();
    this.occurredOn = new Date();
  }
}
