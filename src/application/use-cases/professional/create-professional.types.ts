import type { Professional } from "@/domain/entities/professional";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface BusinessHoursInput {
  dayOfWeek: number; // 0..6 (Sunday..Saturday)
  start: string;     // "HH:MM"
  end: string;       // "HH:MM"
}

export interface CreateProfessionalInput {
  actorUserId: string;
  tenantId: string;
  name: string;
  bio?: string | null;
  businessHours: BusinessHoursInput[];
  serviceIds?: string[];
}

export interface CreateProfessionalData {
  professional: Professional;
}

export type CreateProfessionalOutput = Result<
  DomainError | ApplicationError,
  CreateProfessionalData
>;