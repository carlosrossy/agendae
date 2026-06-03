import { DomainError } from "./domain-error";

export class InvalidPhoneError extends DomainError {
  readonly code = "INVALID_PHONE";

  constructor(value: string) {
    super(`The value "${value}" is not a valid Brazilian phone number.`);
  }
}