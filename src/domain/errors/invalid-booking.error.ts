import { DomainError } from "./domain-error";

export class InvalidBookingError extends DomainError {
  readonly code = "INVALID_BOOKING";

  constructor(message: string) {
    super(message);
  }
}