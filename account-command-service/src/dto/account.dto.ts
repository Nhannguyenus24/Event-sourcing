import { IsString, IsNumber, IsOptional, IsUUID, IsPositive, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ 
    description: 'Unique identifier for the account',
    example: '550e8400-e29b-41d4-a716-446655440003',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ 
    description: 'Account number',
    example: 'ACC003',
    maxLength: 50
  })
  @IsString()
  accountNumber: string;

  @ApiProperty({ 
    description: 'Name of the account owner',
    example: 'John Doe',
    maxLength: 255
  })
  @IsString()
  ownerName: string;

  @ApiPropertyOptional({ 
    description: 'Initial balance for the account',
    example: 1000,
    minimum: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number = 0;
}

export class DepositMoneyDto {
  @ApiProperty({ 
    description: 'Account ID to deposit money to',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ 
    description: 'Amount to deposit',
    example: 500,
    minimum: 0.01
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ 
    description: 'Description of the deposit',
    example: 'Salary deposit'
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class WithdrawMoneyDto {
  @ApiProperty({ 
    description: 'Account ID to withdraw money from',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ 
    description: 'Amount to withdraw',
    example: 200,
    minimum: 0.01
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ 
    description: 'Description of the withdrawal',
    example: 'ATM withdrawal'
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class TransferMoneyDto {
  @ApiProperty({ 
    description: 'Source account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  fromAccountId: string;

  @ApiProperty({ 
    description: 'Destination account ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid'
  })
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ 
    description: 'Amount to transfer',
    example: 300,
    minimum: 0.01
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ 
    description: 'Description of the transfer',
    example: 'Transfer to friend'
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class RollbackTransactionDto {
  @ApiProperty({ 
    description: 'Account ID for the rollback',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ 
    description: 'Original transaction ID to rollback',
    example: 'TXN-1234567890-abc123'
  })
  @IsString()
  originalTransactionId: string;

  @ApiProperty({ 
    description: 'Reason for the rollback',
    example: 'Fraud detection'
  })
  @IsString()
  rollbackReason: string;

  @ApiProperty({ 
    description: 'Amount of the original transaction',
    example: 200,
    minimum: 0.01
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ 
    description: 'Type of the original transaction',
    example: 'WITHDRAWAL',
    enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_IN']
  })
  @IsString()
  transactionType: string;
}

export class BlockAccountDto {
  @ApiProperty({ 
    description: 'Account ID to block',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({ 
    description: 'Reason for blocking the account',
    example: 'Suspicious activity detected'
  })
  @IsString()
  reason: string;
}

export class GetAccountBalanceDto {
  @ApiProperty({ 
    description: 'Account ID to get balance for',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;
}
