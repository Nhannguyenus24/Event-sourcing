import { Controller, Get, Post, Body, Param, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { EventStoreService } from '../services/event-store.service';
import { IsString, IsOptional, IsNumber, IsArray, Min } from 'class-validator';

class AppendEventsDto {
  @IsString()
  streamId: string;

  @IsArray()
  events: any[];

  @IsNumber()
  @Min(0)
  expectedVersion: number;
}

class SaveSnapshotDto {
  @IsString()
  streamId: string;

  snapshot: any;

  @IsNumber()
  @Min(0)
  version: number;
}

@ApiTags('Event Store')
@Controller('event-store')
export class EventStoreController {
  constructor(private readonly eventStoreService: EventStoreService) {}

  @Post('append')
  async appendEvents(@Body(ValidationPipe) dto: AppendEventsDto) {
    return await this.eventStoreService.appendEvents(
      dto.streamId,
      dto.events,
      dto.expectedVersion
    );
  }

  @Get('stream/:streamId')
  async getStreamEvents(
    @Param('streamId') streamId: string,
    @Query('fromVersion') fromVersion?: string
  ) {
    const version = fromVersion ? parseInt(fromVersion) : undefined;
    return await this.eventStoreService.getStreamEvents(streamId, version);
  }

  @Get('events')
  async getAllEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 100;
    const offsetNum = offset ? parseInt(offset) : 0;
    return await this.eventStoreService.getAllEvents(limitNum, offsetNum);
  }

  @Get('events/type/:eventType')
  async getEventsByType(
    @Param('eventType') eventType: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 100;
    const offsetNum = offset ? parseInt(offset) : 0;
    return await this.eventStoreService.getEventsByType(eventType, limitNum, offsetNum);
  }

  @Post('snapshot')
  async saveSnapshot(@Body(ValidationPipe) dto: SaveSnapshotDto) {
    return await this.eventStoreService.saveSnapshot(
      dto.streamId,
      dto.snapshot,
      dto.version
    );
  }

  @Get('snapshot/:streamId')
  async getSnapshot(@Param('streamId') streamId: string) {
    return await this.eventStoreService.getSnapshot(streamId);
  }

  @Get('streams')
  async getStreams() {
    return await this.eventStoreService.getStreams();
  }

  @Get('streams/:streamId/statistics')
  async getStreamStatistics(@Param('streamId') streamId: string) {
    return await this.eventStoreService.getStreamStatistics(streamId);
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      service: 'event-store-service',
      timestamp: new Date().toISOString()
    };
  }
}
