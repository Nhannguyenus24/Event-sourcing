import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DomainEvent, EventFilter, EventSnapshot } from '../domain/events';

@Injectable()
export class EventStoreRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/event_store'
    });
  }

  async saveEvents(events: DomainEvent[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO events (id, stream_id, event_type, event_data, metadata, version, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (stream_id, version) DO NOTHING`,
          [
            event.eventId,
            event.aggregateId,
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

  async getEventsByAggregateId(aggregateId: string): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE stream_id = $1 ORDER BY version ASC',
      [aggregateId]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async getEventsWithFilter(filter: EventFilter): Promise<DomainEvent[]> {
    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.aggregateId) {
      query += ` AND stream_id = $${paramIndex}`;
      params.push(filter.aggregateId);
      paramIndex++;
    }

    if (filter.eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(filter.eventType);
      paramIndex++;
    }

    if (filter.fromDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filter.fromDate);
      paramIndex++;
    }

    if (filter.toDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filter.toDate);
      paramIndex++;
    }

    if (filter.fromVersion) {
      query += ` AND version >= $${paramIndex}`;
      params.push(filter.fromVersion);
      paramIndex++;
    }

    if (filter.toVersion) {
      query += ` AND version <= $${paramIndex}`;
      params.push(filter.toVersion);
      paramIndex++;
    }

    query += ' ORDER BY created_at ASC, version ASC';

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToEvent);
  }

  async getEventsFromVersion(aggregateId: string, fromVersion: number): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE stream_id = $1 AND version > $2 ORDER BY version ASC',
      [aggregateId, fromVersion]
    );

    return result.rows.map(this.mapRowToEvent);
  }

  async getCurrentVersion(aggregateId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COALESCE(MAX(version), 0) as current_version FROM events WHERE stream_id = $1',
      [aggregateId]
    );

    return result.rows[0]?.current_version || 0;
  }

  async saveSnapshot(snapshot: EventSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO snapshots (id, stream_id, data, version, created_at) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stream_id) DO UPDATE SET
       data = EXCLUDED.data,
       version = EXCLUDED.version,
       created_at = EXCLUDED.created_at`,
      [
        snapshot.id,
        snapshot.aggregateId,
        JSON.stringify(snapshot.data),
        snapshot.version,
        snapshot.createdAt
      ]
    );
  }

  async getSnapshot(aggregateId: string): Promise<EventSnapshot | null> {
    const result = await this.pool.query(
      'SELECT * FROM snapshots WHERE stream_id = $1',
      [aggregateId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      aggregateId: row.stream_id,
      data: row.data,
      version: row.version,
      createdAt: row.created_at
    };
  }

  async createCompensatingEvent(originalEventId: string, reason: string, compensatingData: any): Promise<DomainEvent> {
    // Get the original event
    const originalEventResult = await this.pool.query(
      'SELECT * FROM events WHERE id = $1',
      [originalEventId]
    );

    if (originalEventResult.rows.length === 0) {
      throw new Error(`Original event with ID ${originalEventId} not found`);
    }

    const originalEvent = this.mapRowToEvent(originalEventResult.rows[0]);

    // Create compensating event
    const compensatingEvent: DomainEvent = {
      eventId: require('uuid').v4(),
      aggregateId: originalEvent.aggregateId,
      eventType: `${originalEvent.eventType}Compensated`,
      eventData: {
        originalEventId,
        originalEventType: originalEvent.eventType,
        originalEventData: originalEvent.eventData,
        compensatingData,
        reason
      },
      version: await this.getCurrentVersion(originalEvent.aggregateId) + 1,
      occurredOn: new Date(),
      metadata: {
        isCompensating: true,
        originalEventId
      }
    };

    await this.saveEvents([compensatingEvent]);
    return compensatingEvent;
  }

  async getAllEventTypes(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT event_type FROM events ORDER BY event_type'
    );

    return result.rows.map(row => row.event_type);
  }

  async getEventStatistics(): Promise<any> {
    const totalEventsResult = await this.pool.query('SELECT COUNT(*) as total FROM events');
    const eventTypeCountResult = await this.pool.query(
      'SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type ORDER BY count DESC'
    );
    const aggregateCountResult = await this.pool.query(
      'SELECT COUNT(DISTINCT stream_id) as count FROM events'
    );

    return {
      totalEvents: parseInt(totalEventsResult.rows[0].total),
      totalAggregates: parseInt(aggregateCountResult.rows[0].count),
      eventTypeDistribution: eventTypeCountResult.rows.map(row => ({
        eventType: row.event_type,
        count: parseInt(row.count)
      }))
    };
  }

  private mapRowToEvent(row: any): DomainEvent {
    return {
      eventId: row.id,
      aggregateId: row.stream_id,
      eventType: row.event_type,
      eventData: row.event_data,
      version: row.version,
      occurredOn: row.created_at,
      metadata: row.metadata
    };
  }
}
