import { ApplicationError } from "./application-error";

export class TenantNotFoundError extends ApplicationError {
  readonly code = "TENANT_NOT_FOUND";

  constructor(identifier: string) {
    super(`Tenant "${identifier}" was not found.`);
  }
}