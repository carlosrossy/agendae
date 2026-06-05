import { ApplicationError } from "./application-error";

export class BookingNotFoundError extends ApplicationError {
  readonly code = "BOOKING_NOT_FOUND";

  constructor(identifier: string) {
    super(`Booking "${identifier}" was not found.`);
  }
}

export class UnauthorizedBookingActionError extends ApplicationError {
  readonly code = "UNAUTHORIZED_BOOKING_ACTION";

  constructor(message: string = "You are not authorized to perform this action on this booking.") {
    super(message);
  }
}