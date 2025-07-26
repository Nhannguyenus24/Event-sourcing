import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AccountBalance, TransactionHistory, TransactionFilter } from '../domain/read-models';

@Injectable()
export class ReadModelRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/event_store'
    });
  }

  // Account Balance operations
  async upsertAccountBalance(account: Partial<AccountBalance>): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (id, account_number, owner_name, balance, status, created_at, updated_at, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
       account_number = EXCLUDED.account_number,
       owner_name = EXCLUDED.owner_name,
       balance = EXCLUDED.balance,
       status = EXCLUDED.status,
       updated_at = EXCLUDED.updated_at,
       version = EXCLUDED.version`,
      [
        account.id,
        account.accountNumber,
        account.ownerName,
        account.balance,
        account.status,
        account.createdAt || new Date(),
        new Date(),
        account.version
      ]
    );
  }

  async getAccountBalance(accountId: string): Promise<AccountBalance | null> {
    const result = await this.pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAccountBalance(result.rows[0]);
  }

  async getAllAccountBalances(): Promise<AccountBalance[]> {
    const result = await this.pool.query(
      'SELECT * FROM accounts ORDER BY created_at DESC'
    );

    return result.rows.map(this.mapRowToAccountBalance);
  }

  // Transaction History operations
  async insertTransaction(transaction: Partial<TransactionHistory>): Promise<void> {
    await this.pool.query(
      `INSERT INTO transactions (id, account_id, transaction_type, amount, description, 
       from_account_id, to_account_id, transaction_id, status, created_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        transaction.id,
        transaction.accountId,
        transaction.transactionType,
        transaction.amount,
        transaction.description,
        transaction.fromAccountId,
        transaction.toAccountId,
        transaction.transactionId,
        transaction.status,
        transaction.createdAt || new Date(),
        JSON.stringify(transaction.metadata || {})
      ]
    );
  }

  async getTransactionHistory(filter: TransactionFilter): Promise<{
    transactions: TransactionHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.accountId) {
      whereClause += ` AND account_id = $${paramIndex}`;
      params.push(filter.accountId);
      paramIndex++;
    }

    if (filter.transactionType) {
      whereClause += ` AND transaction_type = $${paramIndex}`;
      params.push(filter.transactionType);
      paramIndex++;
    }

    if (filter.fromDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filter.fromDate);
      paramIndex++;
    }

    if (filter.toDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filter.toDate);
      paramIndex++;
    }

    if (filter.minAmount !== undefined) {
      whereClause += ` AND amount >= $${paramIndex}`;
      params.push(filter.minAmount);
      paramIndex++;
    }

    if (filter.maxAmount !== undefined) {
      whereClause += ` AND amount <= $${paramIndex}`;
      params.push(filter.maxAmount);
      paramIndex++;
    }

    if (filter.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM transactions ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT * FROM transactions ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const dataResult = await this.pool.query(dataQuery, params);
    const transactions = dataResult.rows.map(this.mapRowToTransaction);

    return {
      transactions,
      total,
      page,
      limit
    };
  }

  async getAccountTransactionSummary(accountId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount,
        MIN(amount) as min_amount
       FROM transactions 
       WHERE account_id = $1 
       GROUP BY transaction_type
       ORDER BY transaction_type`,
      [accountId]
    );

    return result.rows.map(row => ({
      transactionType: row.transaction_type,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount),
      avgAmount: parseFloat(row.avg_amount),
      maxAmount: parseFloat(row.max_amount),
      minAmount: parseFloat(row.min_amount)
    }));
  }

  async getRecentTransactions(accountId: string, limit: number = 10): Promise<TransactionHistory[]> {
    const result = await this.pool.query(
      'SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2',
      [accountId, limit]
    );

    return result.rows.map(this.mapRowToTransaction);
  }

  async getTransactionsByDateRange(
    accountId: string, 
    fromDate: Date, 
    toDate: Date
  ): Promise<TransactionHistory[]> {
    const result = await this.pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND created_at >= $2 
       AND created_at <= $3 
       ORDER BY created_at DESC`,
      [accountId, fromDate, toDate]
    );

    return result.rows.map(this.mapRowToTransaction);
  }

  async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
    await this.pool.query(
      'UPDATE transactions SET status = $1 WHERE transaction_id = $2',
      [status, transactionId]
    );
  }

  // Analytics methods
  async getDailyTransactionStats(days: number = 30): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        DATE(created_at) as date,
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
       FROM transactions
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at), transaction_type
       ORDER BY date DESC, transaction_type`,
    );

    return result.rows.map(row => ({
      date: row.date,
      transactionType: row.transaction_type,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount)
    }));
  }

  private mapRowToAccountBalance(row: any): AccountBalance {
    return {
      id: row.id,
      accountNumber: row.account_number,
      ownerName: row.owner_name,
      balance: parseFloat(row.balance),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version
    };
  }

  private mapRowToTransaction(row: any): TransactionHistory {
    return {
      id: row.id,
      accountId: row.account_id,
      transactionType: row.transaction_type,
      amount: parseFloat(row.amount),
      description: row.description,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      transactionId: row.transaction_id,
      status: row.status,
      createdAt: row.created_at,
      metadata: row.metadata
    };
  }
}
