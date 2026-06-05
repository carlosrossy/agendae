import { ApplicationError } from "./application-error";

export class TenantNotFoundError extends ApplicationError {
  readonly code = "TENANT_NOT_FOUND";

  constructor(identifier: string) {
    super(`Tenant "${identifier}" was not found.`);
  }
}
export class SlugAlreadyTakenError extends ApplicationError {
  readonly code = "SLUG_ALREADY_TAKEN";

  constructor(slug: string) {
    super(`The slug "${slug}" is already in use by another tenant.`);
  }
}