import type { TimeSlot } from "@/domain/value-objects/time-slot";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface ListAvailableSlotsInput {
  professionalId: string;
  serviceId: string;
  date: Date;
  granularityMinutes?: number;
  now?: Date;
}

export interface ListAvailableSlotsData {
  slots: TimeSlot[];
}

export type ListAvailableSlotsOutput = Result<
  DomainError | ApplicationError,
  ListAvailableSlotsData
>;