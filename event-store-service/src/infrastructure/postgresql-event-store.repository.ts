import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, Client } from 'pg';
import { DomainEvent, EventStoreRepository } from '../domain/event-store.interface';

@Injectable()
export class PostgreSQLEventStoreRepository implements EventStoreRepository {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL') || 'postgresql://postgres:password@localhost:5432/event_store',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async saveEvents(streamId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check for concurrency conflicts
      const currentVersionResult = await client.query(
        'SELECT COALESCE(MAX(version), 0) as current_version FROM events WHERE stream_id = $1',
        [streamId]
      );
      
      const currentVersion = currentVersionResult.rows[0]?.current_version || 0;
      
      if (currentVersion !== expectedVersion) {
        throw new Error(`Concurrency conflict. Expected version ${expectedVersion}, but current version is ${currentVersion}`);
      }

      // Insert events
      for (const event of events) {
        await client.query(
          `INSERT INTO events (id, stream_id, event_type, event_data, metadata, version, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.eventId,
            streamId,
            event.eventType,
            JSON.stringify(event.eventData),
            JSON.stringify(event.metadata || {}),
            event.version,
            event.occurredOn
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(streamId: string): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE stream_id = $1 ORDER BY version ASC',
      [streamId]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async getEventsFromVersion(streamId: string, fromVersion: number): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE stream_id = $1 AND version > $2 ORDER BY version ASC',
      [streamId, fromVersion]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async getAllEvents(limit: number = 100, offset: number = 0): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events ORDER BY created_at ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async getEventsByType(eventType: string, limit: number = 100, offset: number = 0): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE event_type = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3',
      [eventType, limit, offset]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async saveSnapshot(streamId: string, snapshot: any, version: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `INSERT INTO snapshots (stream_id, data, version, created_at) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (stream_id) 
         DO UPDATE SET data = $2, version = $3, created_at = $4`,
        [streamId, JSON.stringify(snapshot), version, new Date()]
      );
    } finally {
      client.release();
    }
  }

  async getSnapshot(streamId: string): Promise<{ data: any; version: number } | null> {
    const result = await this.pool.query(
      'SELECT data, version FROM snapshots WHERE stream_id = $1',
      [streamId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      data: row.data,
      version: row.version
    };
  }

  async getStreamIds(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT stream_id FROM events ORDER BY stream_id'
    );

    return result.rows.map(row => row.stream_id);
  }

  async getEventCount(): Promise<number> {
    const result = await this.pool.query('SELECT COUNT(*) as count FROM events');
    return parseInt(result.rows[0].count);
  }

  async getEventCountByStream(streamId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM events WHERE stream_id = $1',
      [streamId]
    );
    return parseInt(result.rows[0].count);
  }

  private mapRowToEvent(row: any): DomainEvent {
    return {
      eventId: row.id,
      aggregateId: row.stream_id,
      eventType: row.event_type,
      eventData: row.event_data,
      version: row.version,
      occurredOn: row.created_at,
      metadata: row.metadata || {}
    };
  }
}
