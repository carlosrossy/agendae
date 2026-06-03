import { DomainError } from "./domain-error";

export class InvalidTenantError extends DomainError {
  readonly code = "INVALID_TENANT";

  constructor(message: string) {
    super(message);
  }
}