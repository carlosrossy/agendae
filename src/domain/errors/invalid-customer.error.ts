import { DomainError } from "./domain-error";

export class InvalidCustomerError extends DomainError {
  readonly code = "INVALID_CUSTOMER";

  constructor(message: string) {
    super(message);
  }
}