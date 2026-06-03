import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { InvalidBookingError } from "@/domain/errors/invalid-booking.error";
import {
  BookingInThePastError,
  InvalidBookingTransitionError,
} from "@/domain/errors/booking-state.error";
import type { DomainEvent } from "@/shared/utils/domain-event";
import {
  BookingCancelled,
  BookingCompleted,
  BookingCreated,
  BookingNoShow,
  BookingRescheduled,
} from "@/domain/events/booking-events";

export type BookingStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface BookingProps extends EntityProps {
  tenantId: UniqueId;
  customerId: UniqueId;
  professionalId: UniqueId;
  serviceId: UniqueId;
  timeSlot: TimeSlot;
  price: Money;
  status: BookingStatus;
  cancellationReason: string | null;
  notes: string | null;
}

export interface CreateBookingInput {
  tenantId: UniqueId;
  customerId: UniqueId;
  professionalId: UniqueId;
  serviceId: UniqueId;
  timeSlot: TimeSlot;
  price: Money;
  notes?: string | null;
  now?: Date;
}

export class Booking extends Entity<BookingProps> {
  private static readonly MAX_REASON = 500;
  private static readonly MAX_NOTES = 1000;

  private _events: DomainEvent[] = [];

  private constructor(props: BookingProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateBookingInput): Booking {
    if (!(input.timeSlot instanceof TimeSlot)) {
      throw new InvalidBookingError("Booking requires a TimeSlot value object.");
    }
    if (!(input.price instanceof Money)) {
      throw new InvalidBookingError("Booking requires a Money value object for price.");
    }

    const now = input.now ?? new Date();
    if (input.timeSlot.isInThePast(now)) {
      throw new BookingInThePastError();
    }

    const notes = Booking.validateNotes(input.notes);

    const id = UniqueId.generate();
    const created = new Date();

    const booking = new Booking({
      id,
      tenantId: input.tenantId,
      customerId: input.customerId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      timeSlot: input.timeSlot,
      price: input.price,
      status: "SCHEDULED",
      cancellationReason: null,
      notes,
      createdAt: created,
      updatedAt: created,
    });

    booking._events.push(
      new BookingCreated(
        id,
        input.tenantId,
        input.customerId,
        input.professionalId,
        input.serviceId,
      ),
    );

    return booking;
  }

  public static restore(props: BookingProps): Booking {
    return new Booking(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Validators
  // ─────────────────────────────────────────────────────────────

  private static validateNotes(notes: string | null | undefined): string | null {
    if (notes === null || notes === undefined) return null;
    if (typeof notes !== "string") {
      throw new InvalidBookingError("Booking notes must be a string.");
    }
    const trimmed = notes.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > Booking.MAX_NOTES) {
      throw new InvalidBookingError(
        `Booking notes must be at most ${Booking.MAX_NOTES} characters.`,
      );
    }
    return trimmed;
  }

  private static validateReason(reason: string | null | undefined): string | null {
    if (reason === null || reason === undefined) return null;
    if (typeof reason !== "string") {
      throw new InvalidBookingError("Cancellation reason must be a string.");
    }
    const trimmed = reason.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > Booking.MAX_REASON) {
      throw new InvalidBookingError(
        `Cancellation reason must be at most ${Booking.MAX_REASON} characters.`,
      );
    }
    return trimmed;
  }

  // ─────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────

  public get tenantId(): UniqueId {
    return this.props.tenantId;
  }

  public get customerId(): UniqueId {
    return this.props.customerId;
  }

  public get professionalId(): UniqueId {
    return this.props.professionalId;
  }

  public get serviceId(): UniqueId {
    return this.props.serviceId;
  }

  public get timeSlot(): TimeSlot {
    return this.props.timeSlot;
  }

  public get price(): Money {
    return this.props.price;
  }

  public get status(): BookingStatus {
    return this.props.status;
  }

  public get cancellationReason(): string | null {
    return this.props.cancellationReason;
  }

  public get notes(): string | null {
    return this.props.notes;
  }

  public get isScheduled(): boolean {
    return this.props.status === "SCHEDULED";
  }

  public get isTerminal(): boolean {
    return this.props.status !== "SCHEDULED";
  }

  public cancel(reason: string | null = null): void {
    if (this.isTerminal) {
      throw new InvalidBookingTransitionError(this.props.status, "CANCELLED");
    }
    this.props.status = "CANCELLED";
    this.props.cancellationReason = Booking.validateReason(reason);
    this.touch();
    this._events.push(
      new BookingCancelled(this.id, this.props.tenantId, this.props.cancellationReason),
    );
  }

  public complete(): void {
    if (this.isTerminal) {
      throw new InvalidBookingTransitionError(this.props.status, "COMPLETED");
    }
    this.props.status = "COMPLETED";
    this.touch();
    this._events.push(new BookingCompleted(this.id, this.props.tenantId));
  }

  public markAsNoShow(): void {
    if (this.isTerminal) {
      throw new InvalidBookingTransitionError(this.props.status, "NO_SHOW");
    }
    this.props.status = "NO_SHOW";
    this.touch();
    this._events.push(new BookingNoShow(this.id, this.props.tenantId));
  }

  public reschedule(newSlot: TimeSlot, now: Date = new Date()): void {
    if (!(newSlot instanceof TimeSlot)) {
      throw new InvalidBookingError("Reschedule requires a TimeSlot value object.");
    }
    if (this.isTerminal) {
      throw new InvalidBookingError(
        `Cannot reschedule a booking in status ${this.props.status}.`,
      );
    }
    if (newSlot.isInThePast(now)) {
      throw new BookingInThePastError();
    }

    const previousStart = this.props.timeSlot.start;
    this.props.timeSlot = newSlot;
    this.touch();
    this._events.push(
      new BookingRescheduled(this.id, this.props.tenantId, previousStart, newSlot.start),
    );
  }

  public changeNotes(newNotes: string | null): void {
    this.props.notes = Booking.validateNotes(newNotes);
    this.touch();
  }

  // ─────────────────────────────────────────────────────────────
  // Conflict detection (used by use cases when booking many at once)
  // ─────────────────────────────────────────────────────────────

  public conflictsWith(other: Booking): boolean {
    if (this.isTerminal || other.isTerminal) return false;
    return this.props.timeSlot.overlaps(other.props.timeSlot);
  }

  // ─────────────────────────────────────────────────────────────
  // Domain events
  // ─────────────────────────────────────────────────────────────

  public pullDomainEvents(): DomainEvent[] {
    const events = this._events;
    this._events = [];
    return events;
  }
}