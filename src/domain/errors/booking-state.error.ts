import { DomainError } from "./domain-error";
import type { BookingStatus } from "@/domain/entities/booking";

export class InvalidBookingTransitionError extends DomainError {
  readonly code = "INVALID_BOOKING_TRANSITION";

  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Cannot transition booking from ${from} to ${to}.`);
  }
}

export class BookingInThePastError extends DomainError {
  readonly code = "BOOKING_IN_THE_PAST";

  constructor() {
    super("Booking cannot be scheduled in the past.");
  }
}