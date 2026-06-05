import type { Booking } from "@/domain/entities/booking";
import type { Customer } from "@/domain/entities/customer";
import type { DomainEvent } from "@/shared/utils/domain-event";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface CreateBookingInput {
  tenantSlug: string;
  professionalId: string;
  serviceId: string;
  startAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  notes?: string | null;
  now?: Date;
}

export interface CreateBookingData {
  booking: Booking;
  customer: Customer;
  domainEvents: DomainEvent[];
}

export type CreateBookingOutput = Result<
  DomainError | ApplicationError,
  CreateBookingData
>;