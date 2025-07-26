import { Injectable, Inject } from '@nestjs/common';
import { Pool, Client } from 'pg';
import { DomainEvent } from '../domain/aggregate-root';
import { AccountAggregate } from '../domain/account.aggregate';

export interface EventStore {
  saveEvents(streamId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(streamId: string): Promise<DomainEvent[]>;
  getEventsFromVersion(streamId: string, fromVersion: number): Promise<DomainEvent[]>;
}

@Injectable()
export class PostgreSQLEventStore implements EventStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/event_store'
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
          'INSERT INTO events (stream_id, event_type, event_data, metadata, version, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [
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

    return result.rows.map(row => ({
      eventId: row.id,
      aggregateId: row.stream_id,
      eventType: row.event_type,
      eventData: row.event_data,
      version: row.version,
      occurredOn: row.created_at,
      metadata: row.metadata
    }));
  }

  async getEventsFromVersion(streamId: string, fromVersion: number): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE stream_id = $1 AND version > $2 ORDER BY version ASC',
      [streamId, fromVersion]
    );

    return result.rows.map(row => ({
      eventId: row.id,
      aggregateId: row.stream_id,
      eventType: row.event_type,
      eventData: row.event_data,
      version: row.version,
      occurredOn: row.created_at,
      metadata: row.metadata
    }));
  }
}

@Injectable()
export class AccountRepository {
  constructor(
    private eventStore: PostgreSQLEventStore
  ) {}

  async save(account: AccountAggregate): Promise<void> {
    const events = account.getUncommittedEvents();
    if (events.length === 0) {
      return;
    }

    const expectedVersion = account.getVersion() - events.length;
    await this.eventStore.saveEvents(account.getId(), events, expectedVersion);
    account.markEventsAsCommitted();
  }

  async getById(id: string): Promise<AccountAggregate | null> {
    const events = await this.eventStore.getEvents(id);
    
    if (events.length === 0) {
      return null;
    }

    const account = new AccountAggregate(id);
    account.loadFromHistory(events);
    return account;
  }
}
