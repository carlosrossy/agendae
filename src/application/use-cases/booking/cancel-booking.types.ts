import type { Booking } from "@/domain/entities/booking";
import type { DomainEvent } from "@/shared/utils/domain-event";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";

export type Actor =
  | { type: "CUSTOMER"; id: string }
  | { type: "OWNER"; id: string };

export interface CancelBookingInput {
  bookingId: string;
  actor: Actor;
  reason?: string | null;
}

export interface CancelBookingData {
  booking: Booking;
  domainEvents: DomainEvent[];
}

export type CancelBookingOutput = Result<
  DomainError | ApplicationError,
  CancelBookingData
>;