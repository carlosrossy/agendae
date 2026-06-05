import { ApplicationError } from "./application-error";

export class EmailAlreadyTakenError extends ApplicationError {
  readonly code = "EMAIL_ALREADY_TAKEN";

  constructor(email: string) {
    super(`The email "${email}" is already in use within this tenant.`);
  }
}