import { UniqueId } from "./id";

export interface DomainEvent {
  readonly occurredAt: Date;
  readonly aggregateId: UniqueId;
  readonly eventName: string;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(public readonly aggregateId: UniqueId) {
    this.occurredAt = new Date();
  }

  abstract readonly eventName: string;
}