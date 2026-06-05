import type { Service } from "@/domain/entities/service";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  requiresPayment?: boolean;
}

export type CreateServiceOutput = Result<DomainError | ApplicationError, Service>;