export interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventData: any;
  readonly version: number;
  readonly occurredOn: Date;
  readonly metadata?: Record<string, any>;
}

export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  public getId(): string {
    return this.id;
  }

  public getVersion(): number {
    return this.version;
  }

  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  public markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  protected addEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
    this.version++;
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event);
      this.version = event.version;
    });
  }

  protected abstract applyEvent(event: DomainEvent): void;
}
