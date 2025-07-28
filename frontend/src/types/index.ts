// Account types
export interface Account {
  accountId: string;
  accountNumber: string;
  ownerName: string;
  balance: number;
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  createdAt: string;
  lastUpdated?: string;
  version?: number;
}

// Transaction types
export interface Transaction {
  id: string;
  accountId: string;
  transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ROLLBACK';
  amount: number;
  description?: string;
  fromAccountId?: string;
  toAccountId?: string;
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  createdAt: string;
  metadata?: Record<string, any>;
}

// Event types
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  eventData: any;
  version: number;
  occurredOn: string;
  metadata?: Record<string, any>;
}

// API Response types
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errorCode?: string;
  timestamp?: string;
}

// Command DTOs
export interface CreateAccountDto {
  accountNumber: string;
  ownerName: string;
  initialBalance?: number;
}

export interface DepositMoneyDto {
  accountId: string;
  amount: number;
  description?: string;
}

export interface WithdrawMoneyDto {
  accountId: string;
  amount: number;
  description?: string;
}

export interface TransferMoneyDto {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
}

export interface RollbackTransactionDto {
  accountId: string;
  originalTransactionId: string;
  rollbackReason: string;
  amount: number;
  transactionType: string;
}

export interface BlockAccountDto {
  accountId: string;
  reason: string;
}

// Query DTOs
export interface TransactionFilterDto {
  accountId?: string;
  transactionType?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AccountStatementDto {
  accountId: string;
  fromDate: string;
  toDate: string;
}

// Event Store types
export interface EventFilterDto {
  aggregateId?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
  fromVersion?: number;
  toVersion?: number;
}

export interface SaveEventsDto {
  events: any[];
}

export interface CreateSnapshotDto {
  aggregateId: string;
  data: any;
}

export interface RollbackEventDto {
  originalEventId: string;
  reason: string;
  compensatingData: any;
}

// Navigation
export interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType;
}

// Dashboard stats
export interface DashboardStats {
  totalAccounts: number;
  totalBalance: number;
  totalTransactions: number;
  recentTransactions: Transaction[];
}

// Chart data
export interface ChartData {
  name: string;
  value: number;
  date?: string;
} 