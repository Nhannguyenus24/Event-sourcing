export interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventData: any;
  readonly version: number;
  readonly occurredOn: Date;
  readonly metadata?: Record<string, any>;
}

export interface EventFilter {
  aggregateId?: string;
  eventType?: string;
  fromDate?: Date;
  toDate?: Date;
  fromVersion?: number;
  toVersion?: number;
}

export interface EventSnapshot {
  id: string;
  aggregateId: string;
  data: any;
  version: number;
  createdAt: Date;
}
