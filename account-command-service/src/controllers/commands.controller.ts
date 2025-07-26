import { Controller, Post, Get, Body, Param, ValidationPipe, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AccountCommandService } from '../services/account-command.service';
import {
  CreateAccountDto,
  DepositMoneyDto,
  WithdrawMoneyDto,
  TransferMoneyDto,
  RollbackTransactionDto,
  BlockAccountDto
} from '../dto/account.dto';
import {
  CreateAccountCommand,
  DepositMoneyCommand,
  WithdrawMoneyCommand,
  TransferMoneyCommand,
  RollbackTransactionCommand,
  BlockAccountCommand
} from '../commands/commands';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Account Commands')
@Controller('commands')
export class CommandsController {
  constructor(private readonly accountCommandService: AccountCommandService) {}

  @Post('create-account')
  @ApiOperation({ 
    summary: 'Create a new account',
    description: 'Creates a new bank account with the specified details and initial balance'
  })
  @ApiBody({ type: CreateAccountDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Account created successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Account created successfully',
        data: {
          accountId: '550e8400-e29b-41d4-a716-446655440003',
          accountNumber: 'ACC003',
          balance: 1000
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Account already exists or invalid data' })
  async createAccount(@Body(ValidationPipe) dto: CreateAccountDto) {
    const command = new CreateAccountCommand(
      uuidv4(),
      dto.accountId,
      dto.accountNumber,
      dto.ownerName,
      dto.initialBalance
    );

    const result = await this.accountCommandService.createAccount(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Post('deposit')
  @ApiOperation({ 
    summary: 'Deposit money to account',
    description: 'Adds money to the specified account and creates a transaction record'
  })
  @ApiBody({ type: DepositMoneyDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Money deposited successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Money deposited successfully',
        data: {
          transactionId: 'TXN-1640995200-abc123',
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          amount: 500,
          newBalance: 1500
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Account not found or invalid amount' })
  async depositMoney(@Body(ValidationPipe) dto: DepositMoneyDto) {
    const command = new DepositMoneyCommand(
      uuidv4(),
      dto.accountId,
      dto.amount,
      dto.description
    );

    const result = await this.accountCommandService.depositMoney(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Post('withdraw')
  @ApiOperation({ 
    summary: 'Withdraw money from account',
    description: 'Withdraws money from the specified account if sufficient balance is available'
  })
  @ApiBody({ type: WithdrawMoneyDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Money withdrawn successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Money withdrawn successfully',
        data: {
          transactionId: 'TXN-1640995300-def456',
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          amount: 200,
          newBalance: 1300
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Insufficient funds or account not found' })
  async withdrawMoney(@Body(ValidationPipe) dto: WithdrawMoneyDto) {
    const command = new WithdrawMoneyCommand(
      uuidv4(),
      dto.accountId,
      dto.amount,
      dto.description
    );

    const result = await this.accountCommandService.withdrawMoney(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Post('transfer')
  @ApiOperation({ 
    summary: 'Transfer money between accounts',
    description: 'Transfers money from one account to another if sufficient balance is available'
  })
  @ApiBody({ type: TransferMoneyDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Money transferred successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Money transferred successfully',
        data: {
          transactionId: 'TXN-1640995400-ghi789',
          fromAccountId: '550e8400-e29b-41d4-a716-446655440001',
          toAccountId: '550e8400-e29b-41d4-a716-446655440002',
          amount: 300,
          fromAccountBalance: 1000,
          toAccountBalance: 2300
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Insufficient funds or account not found' })
  async transferMoney(@Body(ValidationPipe) dto: TransferMoneyDto) {
    const command = new TransferMoneyCommand(
      uuidv4(),
      dto.fromAccountId,
      dto.toAccountId,
      dto.amount,
      dto.description
    );

    const result = await this.accountCommandService.transferMoney(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Post('rollback')
  @ApiOperation({ 
    summary: 'Rollback a transaction',
    description: 'Rolls back a transaction due to error or fraud detection'
  })
  @ApiBody({ type: RollbackTransactionDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction rolled back successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Transaction rolled back successfully',
        data: {
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          originalTransactionId: 'TXN-1234567890-abc123',
          newBalance: 1200
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Account or transaction not found' })
  async rollbackTransaction(@Body(ValidationPipe) dto: RollbackTransactionDto) {
    const command = new RollbackTransactionCommand(
      uuidv4(),
      dto.accountId,
      dto.originalTransactionId,
      dto.rollbackReason,
      dto.amount,
      dto.transactionType
    );

    const result = await this.accountCommandService.rollbackTransaction(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Post('block-account')
  @ApiOperation({ 
    summary: 'Block an account',
    description: 'Blocks an account to prevent further transactions'
  })
  @ApiBody({ type: BlockAccountDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Account blocked successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Account blocked successfully',
        data: {
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          reason: 'Suspicious activity detected'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Account not found' })
  async blockAccount(@Body(ValidationPipe) dto: BlockAccountDto) {
    const command = new BlockAccountCommand(
      uuidv4(),
      dto.accountId,
      dto.reason
    );

    const result = await this.accountCommandService.blockAccount(command);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }

  @Get('account/:accountId/balance')
  @ApiOperation({ 
    summary: 'Get account balance',
    description: 'Retrieves the current balance and details of the specified account'
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
        message: 'Account balance retrieved successfully',
        data: {
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          accountNumber: 'ACC001',
          ownerName: 'John Doe',
          balance: 1000,
          status: 'ACTIVE',
          createdAt: '2025-01-15T10:30:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountBalance(@Param('accountId') accountId: string) {
    const result = await this.accountCommandService.getAccountBalance(accountId);
    
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.NOT_FOUND);
    }

    return {
      status: 'success',
      message: result.message,
      data: result.data
    };
  }
}
