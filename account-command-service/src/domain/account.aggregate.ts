import { AggregateRoot, DomainEvent } from './aggregate-root';
import {
  AccountCreatedEvent,
  MoneyDepositedEvent,
  MoneyWithdrawnEvent,
  MoneyTransferredEvent,
  MoneyReceivedEvent,
  TransactionRolledBackEvent,
  AccountBlockedEvent
} from './events';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  CLOSED = 'CLOSED'
}

export class AccountAggregate extends AggregateRoot {
  private accountNumber: string;
  private ownerName: string;
  private balance: number;
  private status: AccountStatus;
  private createdAt: Date;

  constructor(id: string) {
    super(id);
    this.balance = 0;
    this.status = AccountStatus.ACTIVE;
  }

  // Factory method for creating new account
  public static create(
    id: string,
    accountNumber: string,
    ownerName: string,
    initialBalance: number = 0
  ): AccountAggregate {
    const account = new AccountAggregate(id);
    
    const event = new AccountCreatedEvent(
      id,
      1,
      {
        accountNumber,
        ownerName,
        initialBalance
      }
    );

    account.addEvent(event);
    account.applyEvent(event);
    
    return account;
  }

  public deposit(amount: number, description?: string): string {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new Error('Cannot deposit to inactive account');
    }

    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const transactionId = this.generateTransactionId();
    const event = new MoneyDepositedEvent(
      this.id,
      this.version + 1,
      {
        amount,
        description,
        transactionId
      }
    );

    this.addEvent(event);
    this.applyEvent(event);
    
    return transactionId;
  }

  public withdraw(amount: number, description?: string): string {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new Error('Cannot withdraw from inactive account');
    }

    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const transactionId = this.generateTransactionId();
    const event = new MoneyWithdrawnEvent(
      this.id,
      this.version + 1,
      {
        amount,
        description,
        transactionId
      }
    );

    this.addEvent(event);
    this.applyEvent(event);
    
    return transactionId;
  }

  public transfer(amount: number, toAccountId: string, description?: string): string {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new Error('Cannot transfer from inactive account');
    }

    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds for transfer');
    }

    if (toAccountId === this.id) {
      throw new Error('Cannot transfer to the same account');
    }

    const transactionId = this.generateTransactionId();
    const event = new MoneyTransferredEvent(
      this.id,
      this.version + 1,
      {
        amount,
        toAccountId,
        description,
        transactionId
      }
    );

    this.addEvent(event);
    this.applyEvent(event);
    
    return transactionId;
  }

  public receiveTransfer(amount: number, fromAccountId: string, transactionId: string, description?: string): void {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new Error('Cannot receive transfer to inactive account');
    }

    const event = new MoneyReceivedEvent(
      this.id,
      this.version + 1,
      {
        amount,
        fromAccountId,
        description,
        transactionId
      }
    );

    this.addEvent(event);
    this.applyEvent(event);
  }

  public rollbackTransaction(
    originalTransactionId: string,
    rollbackReason: string,
    amount: number,
    transactionType: string
  ): void {
    const event = new TransactionRolledBackEvent(
      this.id,
      this.version + 1,
      {
        originalTransactionId,
        rollbackReason,
        amount,
        transactionType
      }
    );

    this.addEvent(event);
    this.applyEvent(event);
  }

  public blockAccount(reason: string): void {
    if (this.status === AccountStatus.BLOCKED) {
      throw new Error('Account is already blocked');
    }

    const event = new AccountBlockedEvent(
      this.id,
      this.version + 1,
      { reason }
    );

    this.addEvent(event);
    this.applyEvent(event);
  }

  protected applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'AccountCreated':
        this.onAccountCreated(event as AccountCreatedEvent);
        break;
      case 'MoneyDeposited':
        this.onMoneyDeposited(event as MoneyDepositedEvent);
        break;
      case 'MoneyWithdrawn':
        this.onMoneyWithdrawn(event as MoneyWithdrawnEvent);
        break;
      case 'MoneyTransferred':
        this.onMoneyTransferred(event as MoneyTransferredEvent);
        break;
      case 'MoneyReceived':
        this.onMoneyReceived(event as MoneyReceivedEvent);
        break;
      case 'TransactionRolledBack':
        this.onTransactionRolledBack(event as TransactionRolledBackEvent);
        break;
      case 'AccountBlocked':
        this.onAccountBlocked(event as AccountBlockedEvent);
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  private onAccountCreated(event: AccountCreatedEvent): void {
    this.accountNumber = event.eventData.accountNumber;
    this.ownerName = event.eventData.ownerName;
    this.balance = event.eventData.initialBalance;
    this.status = AccountStatus.ACTIVE;
    this.createdAt = event.occurredOn;
  }

  private onMoneyDeposited(event: MoneyDepositedEvent): void {
    this.balance += event.eventData.amount;
  }

  private onMoneyWithdrawn(event: MoneyWithdrawnEvent): void {
    this.balance -= event.eventData.amount;
  }

  private onMoneyTransferred(event: MoneyTransferredEvent): void {
    this.balance -= event.eventData.amount;
  }

  private onMoneyReceived(event: MoneyReceivedEvent): void {
    this.balance += event.eventData.amount;
  }

  private onTransactionRolledBack(event: TransactionRolledBackEvent): void {
    // Adjust balance based on transaction type
    switch (event.eventData.transactionType) {
      case 'DEPOSIT':
        this.balance -= event.eventData.amount; // Reverse deposit
        break;
      case 'WITHDRAWAL':
        this.balance += event.eventData.amount; // Reverse withdrawal
        break;
      case 'TRANSFER_OUT':
        this.balance += event.eventData.amount; // Reverse transfer out
        break;
      case 'TRANSFER_IN':
        this.balance -= event.eventData.amount; // Reverse transfer in
        break;
    }
  }

  private onAccountBlocked(event: AccountBlockedEvent): void {
    this.status = AccountStatus.BLOCKED;
  }

  private generateTransactionId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  public getAccountNumber(): string {
    return this.accountNumber;
  }

  public getOwnerName(): string {
    return this.ownerName;
  }

  public getBalance(): number {
    return this.balance;
  }

  public getStatus(): AccountStatus {
    return this.status;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
