import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventFilterDto {
  @ApiPropertyOptional({
    description: 'Filter events by aggregate ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @ApiPropertyOptional({
    description: 'Filter events by event type',
    example: 'AccountCreated',
    enum: ['AccountCreated', 'MoneyDeposited', 'MoneyWithdrawn', 'MoneyTransferred', 'TransactionRolledBack', 'AccountBlocked']
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filter events from this date (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter events to this date (ISO string)',
    example: '2025-12-31T23:59:59.999Z',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter events from this version number',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  fromVersion?: number;

  @ApiPropertyOptional({
    description: 'Filter events to this version number',
    example: 10,
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  toVersion?: number;
}

export class SaveEventsDto {
  @ApiProperty({
    description: 'Array of events to save to the event store',
    example: [
      {
        aggregateId: '550e8400-e29b-41d4-a716-446655440001',
        eventType: 'MoneyDeposited',
        eventData: {
          amount: 500,
          transactionId: 'TXN-1640995200-abc123',
          description: 'Monthly salary deposit'
        },
        version: 2
      }
    ],
    type: 'array',
    items: {
      type: 'object',
      properties: {
        aggregateId: { type: 'string', format: 'uuid' },
        eventType: { type: 'string' },
        eventData: { type: 'object' },
        version: { type: 'number' }
      }
    }
  })
  @IsArray()
  events: any[];
}

export class CreateSnapshotDto {
  @ApiProperty({
    description: 'Aggregate ID to create snapshot for',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  aggregateId: string;

  @ApiProperty({
    description: 'Snapshot data containing the current state of the aggregate',
    example: {
      accountId: '550e8400-e29b-41d4-a716-446655440001',
      accountNumber: 'ACC001',
      ownerName: 'John Doe',
      balance: 1500,
      status: 'ACTIVE',
      version: 5
    }
  })
  data: any;
}

export class RollbackEventDto {
  @ApiProperty({
    description: 'ID of the original event to rollback',
    example: '660e8400-e29b-41d4-a716-446655440001',
    format: 'uuid'
  })
  @IsUUID()
  originalEventId: string;

  @ApiProperty({
    description: 'Reason for rolling back the event',
    example: 'Fraud detected - suspicious transaction pattern',
    maxLength: 500
  })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Compensating data to reverse the effects of the original event',
    example: {
      amount: 500,
      originalTransactionId: 'TXN-1640995200-abc123',
      rollbackTransactionId: 'ROLLBACK-1640995300-def456'
    }
  })
  compensatingData: any;
}

export class ReplayEventsDto {
  @IsUUID()
  aggregateId: string;

  @IsOptional()
  @IsNumber()
  fromVersion?: number;
}
