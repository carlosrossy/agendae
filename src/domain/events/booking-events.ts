import { BaseDomainEvent } from "@/shared/utils/domain-event";
import { UniqueId } from "@/shared/utils/id";

export class BookingCreated extends BaseDomainEvent {
  readonly eventName = "booking.created";

  constructor(
    aggregateId: UniqueId,
    public readonly tenantId: UniqueId,
    public readonly customerId: UniqueId,
    public readonly professionalId: UniqueId,
    public readonly serviceId: UniqueId,
  ) {
    super(aggregateId);
  }
}

export class BookingCancelled extends BaseDomainEvent {
  readonly eventName = "booking.cancelled";

  constructor(
    aggregateId: UniqueId,
    public readonly tenantId: UniqueId,
    public readonly reason: string | null,
  ) {
    super(aggregateId);
  }
}

export class BookingRescheduled extends BaseDomainEvent {
  readonly eventName = "booking.rescheduled";

  constructor(
    aggregateId: UniqueId,
    public readonly tenantId: UniqueId,
    public readonly previousStart: Date,
    public readonly newStart: Date,
  ) {
    super(aggregateId);
  }
}

export class BookingCompleted extends BaseDomainEvent {
  readonly eventName = "booking.completed";

  constructor(
    aggregateId: UniqueId,
    public readonly tenantId: UniqueId,
  ) {
    super(aggregateId);
  }
}

export class BookingNoShow extends BaseDomainEvent {
  readonly eventName = "booking.no_show";

  constructor(
    aggregateId: UniqueId,
    public readonly tenantId: UniqueId,
  ) {
    super(aggregateId);
  }
}