import type { Professional } from "@/domain/entities/professional";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";
import type { BusinessHoursInput } from "./create-professional.types";

export interface UpdateProfessionalAvailabilityInput {
  actorUserId: string;
  professionalId: string;
  businessHours: BusinessHoursInput[];
}

export interface UpdateProfessionalAvailabilityData {
  professional: Professional;
}

export type UpdateProfessionalAvailabilityOutput = Result<
  DomainError | ApplicationError,
  UpdateProfessionalAvailabilityData
>;