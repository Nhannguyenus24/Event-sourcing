export interface Command {
  readonly commandId: string;
  readonly commandType: string;
}

export class CreateAccountCommand implements Command {
  readonly commandType = 'CreateAccount';
  
  constructor(
    public readonly commandId: string,
    public readonly accountId: string,
    public readonly accountNumber: string,
    public readonly ownerName: string,
    public readonly initialBalance: number = 0
  ) {}
}

export class DepositMoneyCommand implements Command {
  readonly commandType = 'DepositMoney';
  
  constructor(
    public readonly commandId: string,
    public readonly accountId: string,
    public readonly amount: number,
    public readonly description?: string
  ) {}
}

export class WithdrawMoneyCommand implements Command {
  readonly commandType = 'WithdrawMoney';
  
  constructor(
    public readonly commandId: string,
    public readonly accountId: string,
    public readonly amount: number,
    public readonly description?: string
  ) {}
}

export class TransferMoneyCommand implements Command {
  readonly commandType = 'TransferMoney';
  
  constructor(
    public readonly commandId: string,
    public readonly fromAccountId: string,
    public readonly toAccountId: string,
    public readonly amount: number,
    public readonly description?: string
  ) {}
}

export class RollbackTransactionCommand implements Command {
  readonly commandType = 'RollbackTransaction';
  
  constructor(
    public readonly commandId: string,
    public readonly accountId: string,
    public readonly originalTransactionId: string,
    public readonly rollbackReason: string,
    public readonly amount: number,
    public readonly transactionType: string
  ) {}
}

export class BlockAccountCommand implements Command {
  readonly commandType = 'BlockAccount';
  
  constructor(
    public readonly commandId: string,
    public readonly accountId: string,
    public readonly reason: string
  ) {}
}
