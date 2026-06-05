import type { Booking } from "@/domain/entities/booking";
import type { DomainEvent } from "@/shared/utils/domain-event";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export interface CompleteBookingInput {
  bookingId: string;
  actorUserId: string;
}

export interface CompleteBookingData {
  booking: Booking;
  domainEvents: DomainEvent[];
}

export type CompleteBookingOutput = Result<
  DomainError | ApplicationError,
  CompleteBookingData
>;