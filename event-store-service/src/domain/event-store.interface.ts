export interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventData: any;
  readonly version: number;
  readonly occurredOn: Date;
  readonly metadata?: Record<string, any>;
}

export interface EventDescriptor {
  eventId: string;
  aggregateId: string;
  eventType: string;
  eventData: any;
  version: number;
  occurredOn: Date;
  metadata: Record<string, any>;
}

export interface EventStoreRepository {
  saveEvents(streamId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(streamId: string): Promise<DomainEvent[]>;
  getEventsFromVersion(streamId: string, fromVersion: number): Promise<DomainEvent[]>;
  getAllEvents(limit?: number, offset?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, limit?: number, offset?: number): Promise<DomainEvent[]>;
  saveSnapshot(streamId: string, snapshot: any, version: number): Promise<void>;
  getSnapshot(streamId: string): Promise<{ data: any; version: number } | null>;
  getStreamIds(): Promise<string[]>;
  getEventCount(): Promise<number>;
  getEventCountByStream(streamId: string): Promise<number>;
}
