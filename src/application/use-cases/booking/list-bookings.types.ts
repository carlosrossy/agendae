import type { Booking, BookingStatus } from "@/domain/entities/booking";
import type { Result } from "@/shared/utils/result";
import type { ApplicationError } from "@/application/errors/application-error";

export interface ListBookingsInput {
  actorUserId: string;
  tenantId: string;
  professionalId?: string;
  from: Date;
  to: Date;
  statuses?: BookingStatus[];
}

export interface ListBookingsData {
  bookings: Booking[];
}

export type ListBookingsOutput = Result<ApplicationError, ListBookingsData>;