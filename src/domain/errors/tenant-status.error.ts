import { DomainError } from "./domain-error";

export class TenantNotActiveError extends DomainError {
  readonly code = "TENANT_NOT_ACTIVE";

  constructor(tenantName: string) {
    super(`Tenant "${tenantName}" is not active.`);
  }
}