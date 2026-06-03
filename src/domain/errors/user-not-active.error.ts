import { DomainError } from "./domain-error";

export class UserNotActiveError extends DomainError {
  readonly code = "USER_NOT_ACTIVE";

  constructor(email: string) {
    super(`User "${email}" is not active and cannot perform this action.`);
  }
}