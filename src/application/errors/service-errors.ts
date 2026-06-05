import { ApplicationError } from "./application-error";

export class ServiceNotFoundError extends ApplicationError {
  readonly code = "SERVICE_NOT_FOUND";

  constructor(identifier: string) {
    super(`Service "${identifier}" was not found.`);
  }
}