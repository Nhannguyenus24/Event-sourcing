import { Injectable } from '@nestjs/common';
import { ReadModelRepository } from '../infrastructure/read-model-repository';
import { TransactionFilter } from '../domain/read-models';

@Injectable()
export class QueryService {
  constructor(private readModelRepository: ReadModelRepository) {}

  async getAccountBalance(accountId: string) {
    const account = await this.readModelRepository.getAccountBalance(accountId);
    
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    return account;
  }

  async getAllAccountBalances() {
    return await this.readModelRepository.getAllAccountBalances();
  }

  async getTransactionHistory(filter: TransactionFilter) {
    return await this.readModelRepository.getTransactionHistory(filter);
  }

  async getAccountTransactionSummary(accountId: string) {
    return await this.readModelRepository.getAccountTransactionSummary(accountId);
  }

  async getRecentTransactions(accountId: string, limit: number = 10) {
    return await this.readModelRepository.getRecentTransactions(accountId, limit);
  }

  async getTransactionsByDateRange(accountId: string, fromDate: Date, toDate: Date) {
    return await this.readModelRepository.getTransactionsByDateRange(accountId, fromDate, toDate);
  }

  async getDailyTransactionStats(days: number = 30) {
    return await this.readModelRepository.getDailyTransactionStats(days);
  }

  async getAccountStatement(accountId: string, fromDate: Date, toDate: Date) {
    // Get account info
    const account = await this.getAccountBalance(accountId);
    
    // Get transactions in date range
    const transactions = await this.getTransactionsByDateRange(accountId, fromDate, toDate);
    
    // Calculate summary
    const summary = transactions.reduce((acc, transaction) => {
      switch (transaction.transactionType) {
        case 'DEPOSIT':
        case 'TRANSFER_IN':
          acc.totalCredits += transaction.amount;
          acc.creditCount++;
          break;
        case 'WITHDRAWAL':
        case 'TRANSFER_OUT':
          acc.totalDebits += transaction.amount;
          acc.debitCount++;
          break;
      }
      return acc;
    }, {
      totalCredits: 0,
      totalDebits: 0,
      creditCount: 0,
      debitCount: 0
    });

    return {
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        ownerName: account.ownerName,
        currentBalance: account.balance,
        status: account.status
      },
      period: {
        fromDate,
        toDate
      },
      summary: {
        ...summary,
        netAmount: summary.totalCredits - summary.totalDebits,
        totalTransactions: transactions.length
      },
      transactions
    };
  }
}
