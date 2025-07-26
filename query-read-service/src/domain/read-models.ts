export interface AccountBalance {
  id: string;
  accountNumber: string;
  ownerName: string;
  balance: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface TransactionHistory {
  id: string;
  accountId: string;
  transactionType: string;
  amount: number;
  description?: string;
  fromAccountId?: string;
  toAccountId?: string;
  transactionId: string;
  status: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface TransactionFilter {
  accountId?: string;
  transactionType?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  status?: string;
  page?: number;
  limit?: number;
}
