import { DomainError } from "./domain-error";

export class InvalidServiceError extends DomainError {
  readonly code = "INVALID_SERVICE";

  constructor(message: string) {
    super(message);
  }
}