import { Injectable, Inject } from '@nestjs/common';
import { EventStoreRepository } from '../domain/event-store.interface';

@Injectable()
export class EventStoreService {
  constructor(
    @Inject('EventStoreRepository') 
    private eventStore: EventStoreRepository
  ) {}

  async appendEvents(streamId: string, events: any[], expectedVersion: number) {
    try {
      await this.eventStore.saveEvents(streamId, events, expectedVersion);
      return {
        success: true,
        message: 'Events appended successfully',
        streamId,
        eventsCount: events.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to append events: ${error.message}`,
        error: error.message
      };
    }
  }

  async getStreamEvents(streamId: string, fromVersion?: number) {
    try {
      const events = fromVersion !== undefined 
        ? await this.eventStore.getEventsFromVersion(streamId, fromVersion)
        : await this.eventStore.getEvents(streamId);

      return {
        success: true,
        streamId,
        events,
        eventsCount: events.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get stream events: ${error.message}`,
        error: error.message
      };
    }
  }

  async getAllEvents(limit: number = 100, offset: number = 0) {
    try {
      const events = await this.eventStore.getAllEvents(limit, offset);
      const totalCount = await this.eventStore.getEventCount();

      return {
        success: true,
        events,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get all events: ${error.message}`,
        error: error.message
      };
    }
  }

  async getEventsByType(eventType: string, limit: number = 100, offset: number = 0) {
    try {
      const events = await this.eventStore.getEventsByType(eventType, limit, offset);

      return {
        success: true,
        eventType,
        events,
        eventsCount: events.length,
        pagination: {
          limit,
          offset
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get events by type: ${error.message}`,
        error: error.message
      };
    }
  }

  async saveSnapshot(streamId: string, snapshot: any, version: number) {
    try {
      await this.eventStore.saveSnapshot(streamId, snapshot, version);
      return {
        success: true,
        message: 'Snapshot saved successfully',
        streamId,
        version
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save snapshot: ${error.message}`,
        error: error.message
      };
    }
  }

  async getSnapshot(streamId: string) {
    try {
      const snapshot = await this.eventStore.getSnapshot(streamId);
      
      if (!snapshot) {
        return {
          success: false,
          message: 'Snapshot not found',
          streamId
        };
      }

      return {
        success: true,
        streamId,
        snapshot: snapshot.data,
        version: snapshot.version
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get snapshot: ${error.message}`,
        error: error.message
      };
    }
  }

  async getStreams() {
    try {
      const streamIds = await this.eventStore.getStreamIds();
      
      return {
        success: true,
        streams: streamIds,
        streamsCount: streamIds.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get streams: ${error.message}`,
        error: error.message
      };
    }
  }

  async getStreamStatistics(streamId: string) {
    try {
      const eventCount = await this.eventStore.getEventCountByStream(streamId);
      const snapshot = await this.eventStore.getSnapshot(streamId);
      
      return {
        success: true,
        streamId,
        statistics: {
          eventCount,
          hasSnapshot: !!snapshot,
          snapshotVersion: snapshot?.version || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get stream statistics: ${error.message}`,
        error: error.message
      };
    }
  }
}
