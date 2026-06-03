import { DomainError } from "./domain-error";

export class InvalidUserError extends DomainError {
  readonly code = "INVALID_USER";

  constructor(message: string) {
    super(message);
  }
}