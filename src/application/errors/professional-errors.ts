import { ApplicationError } from "./application-error";

export class ProfessionalNotFoundError extends ApplicationError {
  readonly code = "PROFESSIONAL_NOT_FOUND";

  constructor(identifier: string) {
    super(`Professional "${identifier}" was not found.`);
  }
}