import { DomainError } from "./domain-error";

export class InvalidDurationError extends DomainError {
  readonly code = "INVALID_DURATION";

  constructor(message: string) {
    super(message);
  }
}