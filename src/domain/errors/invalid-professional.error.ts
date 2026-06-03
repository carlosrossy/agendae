import { DomainError } from "./domain-error";

export class InvalidProfessionalError extends DomainError {
  readonly code = "INVALID_PROFESSIONAL";

  constructor(message: string) {
    super(message);
  }
}