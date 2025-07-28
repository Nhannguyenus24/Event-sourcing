import axios from 'axios';
import { 
  Account, 
  Transaction, 
  DomainEvent, 
  ApiResponse,
  CreateAccountDto,
  DepositMoneyDto,
  WithdrawMoneyDto,
  TransferMoneyDto,
  RollbackTransactionDto,
  BlockAccountDto,
  TransactionFilterDto,
  AccountStatementDto
} from '../types';

// API base URLs
const COMMAND_SERVICE_URL = 'http://localhost:3001/api';
const EVENT_STORE_URL = 'http://localhost:3002/api';
const QUERY_SERVICE_URL = 'http://localhost:3003/api';

// Create axios instances
const commandApi = axios.create({ baseURL: COMMAND_SERVICE_URL });
const eventStoreApi = axios.create({ baseURL: EVENT_STORE_URL });
const queryApi = axios.create({ baseURL: QUERY_SERVICE_URL });

// Command Service APIs
export const commandService = {
  // Account Commands
  createAccount: async (data: CreateAccountDto): Promise<ApiResponse> => {
    console.log('Creating account with data:', data);
    const response = await commandApi.post('/commands/create-account', data);
    console.log('Create account response:', response.data);
    return response.data;
  },

  depositMoney: async (data: DepositMoneyDto): Promise<ApiResponse> => {
    const response = await commandApi.post('/commands/deposit', data);
    return response.data;
  },

  withdrawMoney: async (data: WithdrawMoneyDto): Promise<ApiResponse> => {
    const response = await commandApi.post('/commands/withdraw', data);
    return response.data;
  },

  transferMoney: async (data: TransferMoneyDto): Promise<ApiResponse> => {
    const response = await commandApi.post('/commands/transfer', data);
    return response.data;
  },

  rollbackTransaction: async (data: RollbackTransactionDto): Promise<ApiResponse> => {
    const response = await commandApi.post('/commands/rollback', data);
    return response.data;
  },

  blockAccount: async (data: BlockAccountDto): Promise<ApiResponse> => {
    const response = await commandApi.post('/commands/block-account', data);
    return response.data;
  },

  getAccountBalance: async (accountId: string): Promise<ApiResponse> => {
    const response = await commandApi.get(`/commands/account/${accountId}/balance`);
    return response.data;
  },
};

// Event Store APIs
export const eventStoreService = {
  getStreamEvents: async (streamId: string, fromVersion?: number): Promise<DomainEvent[]> => {
    const params = fromVersion ? { fromVersion } : {};
    const response = await eventStoreApi.get(`/event-store/stream/${streamId}`, { params });
    return response.data.events || [];
  },

  getAllEvents: async (limit = 100, offset = 0): Promise<DomainEvent[]> => {
    const response = await eventStoreApi.get('/event-store/events', {
      params: { limit, offset }
    });
    return response.data.events || [];
  },

  getEventsByType: async (eventType: string, limit = 100, offset = 0): Promise<DomainEvent[]> => {
    const response = await eventStoreApi.get(`/event-store/events/type/${eventType}`, {
      params: { limit, offset }
    });
    return response.data.events || [];
  },

  saveSnapshot: async (streamId: string, snapshot: any, version: number): Promise<any> => {
    const response = await eventStoreApi.post('/event-store/snapshot', {
      streamId,
      snapshot,
      version
    });
    return response.data;
  },

  getSnapshot: async (streamId: string): Promise<any> => {
    const response = await eventStoreApi.get(`/event-store/snapshot/${streamId}`);
    return response.data;
  },

  getStreams: async (): Promise<string[]> => {
    const response = await eventStoreApi.get('/event-store/streams');
    return response.data.streams || [];
  },

  getStreamStatistics: async (streamId: string): Promise<any> => {
    const response = await eventStoreApi.get(`/event-store/streams/${streamId}/statistics`);
    return response.data;
  },
};

// Query Service APIs
export const queryService = {
  getAllAccounts: async (): Promise<Account[]> => {
    console.log('Fetching accounts from:', QUERY_SERVICE_URL);
    const response = await queryApi.get('/query/accounts');
    console.log('Accounts response:', response.data);
    return response.data.data?.accounts || [];
  },

  getAccountBalance: async (accountId: string): Promise<Account> => {
    const response = await queryApi.get(`/query/accounts/${accountId}/balance`);
    return response.data.data;
  },

  getTransactionHistory: async (filters: TransactionFilterDto): Promise<{
    transactions: Transaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await queryApi.get(`/query/transactions?${params.toString()}`);
    return response.data.data;
  },

  getRecentTransactions: async (accountId: string, limit = 10): Promise<Transaction[]> => {
    const response = await queryApi.get(`/query/accounts/${accountId}/transactions/recent`, {
      params: { limit }
    });
    return response.data.data?.transactions || [];
  },

  getAccountTransactionSummary: async (accountId: string): Promise<any> => {
    const response = await queryApi.get(`/query/accounts/${accountId}/summary`);
    return response.data.data?.summary;
  },

  getAccountStatement: async (data: AccountStatementDto): Promise<any> => {
    const response = await queryApi.post('/query/accounts/statement', data);
    return response.data.data;
  },

  getTransactionsByDateRange: async (
    accountId: string, 
    fromDate: string, 
    toDate: string
  ): Promise<Transaction[]> => {
    const response = await queryApi.get(`/query/accounts/${accountId}/transactions/range`, {
      params: { fromDate, toDate }
    });
    return response.data.data?.transactions || [];
  },

  getDailyTransactionStats: async (days = 30): Promise<any> => {
    const response = await queryApi.get('/query/analytics/daily-stats', {
      params: { days }
    });
    return response.data.data?.statistics;
  },
};

// Error handling utility
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}; 