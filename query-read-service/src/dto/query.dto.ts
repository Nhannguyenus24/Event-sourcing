import { IsOptional, IsString, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionFilterDto {
  @ApiPropertyOptional({
    description: 'Filter transactions by account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions by type',
    example: 'DEPOSIT',
    enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ROLLBACK']
  })
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions from this date (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions to this date (ISO string)',
    example: '2025-12-31T23:59:59.999Z',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions with minimum amount',
    example: 100,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter transactions with maximum amount',
    example: 10000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter transactions by status',
    example: 'COMPLETED',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'ROLLED_BACK']
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (1-based)',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class AccountStatementDto {
  @ApiProperty({
    description: 'Account ID to generate statement for',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    description: 'Statement start date (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({
    description: 'Statement end date (ISO string)',
    example: '2025-01-31T23:59:59.999Z',
    format: 'date-time'
  })
  @IsDateString()
  toDate: string;
}

export class RecentTransactionsDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
