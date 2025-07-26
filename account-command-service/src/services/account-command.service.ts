import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../infrastructure/event-store';
import { RabbitMQEventPublisher } from '../infrastructure/rabbitmq-event-publisher';
import { AccountAggregate } from '../domain/account.aggregate';
import {
  CreateAccountCommand,
  DepositMoneyCommand,
  WithdrawMoneyCommand,
  TransferMoneyCommand,
  RollbackTransactionCommand,
  BlockAccountCommand
} from '../commands/commands';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class AccountCommandService {
  constructor(
    private accountRepository: AccountRepository,
    private eventPublisher: RabbitMQEventPublisher
  ) {}

  async createAccount(command: CreateAccountCommand): Promise<CommandResult> {
    try {
      // Check if account already exists
      const existingAccount = await this.accountRepository.getById(command.accountId);
      if (existingAccount) {
        return {
          success: false,
          message: 'Account already exists'
        };
      }

      // Create new account aggregate
      const account = AccountAggregate.create(
        command.accountId,
        command.accountNumber,
        command.ownerName,
        command.initialBalance
      );

      // Save to event store
      await this.accountRepository.save(account);

      // Publish events to RabbitMQ
      const events = account.getUncommittedEvents();
      await this.eventPublisher.publishEvents(events);

      return {
        success: true,
        message: 'Account created successfully',
        data: {
          accountId: command.accountId,
          accountNumber: command.accountNumber,
          balance: command.initialBalance
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create account: ${error.message}`
      };
    }
  }

  async depositMoney(command: DepositMoneyCommand): Promise<CommandResult> {
    try {
      // Load account from event store
      const account = await this.accountRepository.getById(command.accountId);
      if (!account) {
        return {
          success: false,
          message: 'Account not found'
        };
      }

      // Execute deposit
      const transactionId = account.deposit(command.amount, command.description);

      // Save to event store
      await this.accountRepository.save(account);

      // Publish events to RabbitMQ
      const events = account.getUncommittedEvents();
      await this.eventPublisher.publishEvents(events);

      return {
        success: true,
        message: 'Money deposited successfully',
        data: {
          transactionId,
          accountId: command.accountId,
          amount: command.amount,
          newBalance: account.getBalance()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to deposit money: ${error.message}`
      };
    }
  }

  async withdrawMoney(command: WithdrawMoneyCommand): Promise<CommandResult> {
    try {
      // Load account from event store
      const account = await this.accountRepository.getById(command.accountId);
      if (!account) {
        return {
          success: false,
          message: 'Account not found'
        };
      }

      // Execute withdrawal
      const transactionId = account.withdraw(command.amount, command.description);

      // Save to event store
      await this.accountRepository.save(account);

      // Publish events to RabbitMQ
      const events = account.getUncommittedEvents();
      await this.eventPublisher.publishEvents(events);

      return {
        success: true,
        message: 'Money withdrawn successfully',
        data: {
          transactionId,
          accountId: command.accountId,
          amount: command.amount,
          newBalance: account.getBalance()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to withdraw money: ${error.message}`
      };
    }
  }

  async transferMoney(command: TransferMoneyCommand): Promise<CommandResult> {
    try {
      // Load source account
      const fromAccount = await this.accountRepository.getById(command.fromAccountId);
      if (!fromAccount) {
        return {
          success: false,
          message: 'Source account not found'
        };
      }

      // Load destination account
      const toAccount = await this.accountRepository.getById(command.toAccountId);
      if (!toAccount) {
        return {
          success: false,
          message: 'Destination account not found'
        };
      }

      // Execute transfer from source account
      const transactionId = fromAccount.transfer(
        command.amount,
        command.toAccountId,
        command.description
      );

      // Execute receive transfer on destination account
      toAccount.receiveTransfer(
        command.amount,
        command.fromAccountId,
        transactionId,
        command.description
      );

      // Save both accounts
      await this.accountRepository.save(fromAccount);
      await this.accountRepository.save(toAccount);

      // Publish events from both accounts
      const fromEvents = fromAccount.getUncommittedEvents();
      const toEvents = toAccount.getUncommittedEvents();
      
      await this.eventPublisher.publishEvents(fromEvents);
      await this.eventPublisher.publishEvents(toEvents);

      return {
        success: true,
        message: 'Money transferred successfully',
        data: {
          transactionId,
          fromAccountId: command.fromAccountId,
          toAccountId: command.toAccountId,
          amount: command.amount,
          fromAccountBalance: fromAccount.getBalance(),
          toAccountBalance: toAccount.getBalance()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to transfer money: ${error.message}`
      };
    }
  }

  async rollbackTransaction(command: RollbackTransactionCommand): Promise<CommandResult> {
    try {
      // Load account from event store
      const account = await this.accountRepository.getById(command.accountId);
      if (!account) {
        return {
          success: false,
          message: 'Account not found'
        };
      }

      // Execute rollback
      account.rollbackTransaction(
        command.originalTransactionId,
        command.rollbackReason,
        command.amount,
        command.transactionType
      );

      // Save to event store
      await this.accountRepository.save(account);

      // Publish events to RabbitMQ
      const events = account.getUncommittedEvents();
      await this.eventPublisher.publishEvents(events);

      return {
        success: true,
        message: 'Transaction rolled back successfully',
        data: {
          accountId: command.accountId,
          originalTransactionId: command.originalTransactionId,
          newBalance: account.getBalance()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to rollback transaction: ${error.message}`
      };
    }
  }

  async blockAccount(command: BlockAccountCommand): Promise<CommandResult> {
    try {
      // Load account from event store
      const account = await this.accountRepository.getById(command.accountId);
      if (!account) {
        return {
          success: false,
          message: 'Account not found'
        };
      }

      // Execute block
      account.blockAccount(command.reason);

      // Save to event store
      await this.accountRepository.save(account);

      // Publish events to RabbitMQ
      const events = account.getUncommittedEvents();
      await this.eventPublisher.publishEvents(events);

      return {
        success: true,
        message: 'Account blocked successfully',
        data: {
          accountId: command.accountId,
          reason: command.reason
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to block account: ${error.message}`
      };
    }
  }

  async getAccountBalance(accountId: string): Promise<CommandResult> {
    try {
      // Load account from event store
      const account = await this.accountRepository.getById(accountId);
      if (!account) {
        return {
          success: false,
          message: 'Account not found'
        };
      }

      return {
        success: true,
        message: 'Account balance retrieved successfully',
        data: {
          accountId,
          accountNumber: account.getAccountNumber(),
          ownerName: account.getOwnerName(),
          balance: account.getBalance(),
          status: account.getStatus(),
          createdAt: account.getCreatedAt()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get account balance: ${error.message}`
      };
    }
  }
}
