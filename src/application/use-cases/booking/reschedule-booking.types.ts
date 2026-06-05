import type { Booking } from "@/domain/entities/booking";
import type { DomainEvent } from "@/shared/utils/domain-event";
import type { Result } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { ApplicationError } from "@/application/errors/application-error";
import type { Actor } from "./cancel-booking.types";

export interface RescheduleBookingInput {
  bookingId: string;
  actor: Actor;
  newStartAt: Date;
  now?: Date;
}

export interface RescheduleBookingData {
  booking: Booking;
  domainEvents: DomainEvent[];
}

export type RescheduleBookingOutput = Result<
  DomainError | ApplicationError,
  RescheduleBookingData
>;