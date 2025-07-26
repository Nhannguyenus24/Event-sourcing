import { Controller, Get, Param, Query, ValidationPipe, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { QueryService } from '../services/query.service';
import { TransactionFilterDto, AccountStatementDto, RecentTransactionsDto } from '../dto/query.dto';

@ApiTags('Accounts')
@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get('accounts')
  @ApiOperation({ 
    summary: 'Get all account balances',
    description: 'Retrieves current balances for all accounts in the system'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Account balances retrieved successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          accounts: [
            {
              accountId: '550e8400-e29b-41d4-a716-446655440001',
              accountNumber: 'ACC001',
              ownerName: 'John Doe',
              balance: 1500,
              status: 'ACTIVE',
              lastUpdated: '2025-01-15T10:30:00Z'
            }
          ],
          count: 1
        }
      }
    }
  })
  async getAllAccountBalances() {
    const accounts = await this.queryService.getAllAccountBalances();
    
    return {
      status: 'success',
      data: {
        accounts,
        count: accounts.length
      }
    };
  }

  @Get('accounts/:accountId/balance')
  @ApiOperation({ 
    summary: 'Get account balance',
    description: 'Retrieves the current balance and details for a specific account'
  })
  @ApiParam({ 
    name: 'accountId', 
    description: 'Account ID to get balance for',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Account balance retrieved successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          accountNumber: 'ACC001',
          ownerName: 'John Doe',
          balance: 1500,
          status: 'ACTIVE',
          createdAt: '2025-01-10T08:00:00Z',
          lastUpdated: '2025-01-15T10:30:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountBalance(@Param('accountId') accountId: string) {
    try {
      const account = await this.queryService.getAccountBalance(accountId);
      
      return {
        status: 'success',
        data: account
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  @Get('transactions')
  async getTransactionHistory(@Query(ValidationPipe) filter: TransactionFilterDto) {
    const result = await this.queryService.getTransactionHistory({
      accountId: filter.accountId,
      transactionType: filter.transactionType,
      fromDate: filter.fromDate ? new Date(filter.fromDate) : undefined,
      toDate: filter.toDate ? new Date(filter.toDate) : undefined,
      minAmount: filter.minAmount,
      maxAmount: filter.maxAmount,
      status: filter.status,
      page: filter.page || 1,
      limit: filter.limit || 20
    });

    return {
      status: 'success',
      data: result
    };
  }

  @Get('accounts/:accountId/transactions/recent')
  async getRecentTransactions(
    @Param('accountId') accountId: string,
    @Query('limit') limit?: number
  ) {
    const transactions = await this.queryService.getRecentTransactions(
      accountId, 
      limit || 10
    );

    return {
      status: 'success',
      data: {
        accountId,
        transactions,
        count: transactions.length
      }
    };
  }

  @Get('accounts/:accountId/summary')
  async getAccountTransactionSummary(@Param('accountId') accountId: string) {
    const summary = await this.queryService.getAccountTransactionSummary(accountId);

    return {
      status: 'success',
      data: {
        accountId,
        summary
      }
    };
  }

  @Post('accounts/statement')
  async getAccountStatement(@Body(ValidationPipe) dto: AccountStatementDto) {
    const statement = await this.queryService.getAccountStatement(
      dto.accountId,
      new Date(dto.fromDate),
      new Date(dto.toDate)
    );

    return {
      status: 'success',
      data: statement
    };
  }

  @Get('accounts/:accountId/transactions/range')
  async getTransactionsByDateRange(
    @Param('accountId') accountId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string
  ) {
    const transactions = await this.queryService.getTransactionsByDateRange(
      accountId,
      new Date(fromDate),
      new Date(toDate)
    );

    return {
      status: 'success',
      data: {
        accountId,
        period: {
          fromDate,
          toDate
        },
        transactions,
        count: transactions.length
      }
    };
  }

  @Get('analytics/daily-stats')
  async getDailyTransactionStats(@Query('days') days?: number) {
    const stats = await this.queryService.getDailyTransactionStats(days || 30);

    return {
      status: 'success',
      data: {
        period: `Last ${days || 30} days`,
        statistics: stats
      }
    };
  }
}
