import type { Tenant } from "@/domain/entities/tenant";
import type { User } from "@/domain/entities/user";
import type { Professional } from "@/domain/entities/professional";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface RegisterTenantInput {
  tenantName: string;
  tenantSlug: string;
  timezone: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;

  isSolo: boolean;
}

export interface RegisterTenantOutputData {
  tenant: Tenant;
  owner: User;
  professional: Professional | null;
}

export type RegisterTenantOutput = Result<
  DomainError | ApplicationError,
  RegisterTenantOutputData
>;