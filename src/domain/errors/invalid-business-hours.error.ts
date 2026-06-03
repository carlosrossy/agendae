import { DomainError } from "./domain-error";

export class InvalidBusinessHoursError extends DomainError {
  readonly code = "INVALID_BUSINESS_HOURS";

  constructor(message: string) {
    super(message);
  }
}