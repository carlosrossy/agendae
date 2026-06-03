import { DomainError } from "./domain-error";

export class InvalidTimeSlotError extends DomainError {
  readonly code = "INVALID_TIME_SLOT";

  constructor(message: string) {
    super(message);
  }
}