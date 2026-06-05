import { UniqueId } from "@/shared/utils/id";
import { success, failure, Result } from "@/shared/utils/result";

import {
  BookingNotFoundError,
  UnauthorizedBookingActionError,
} from "@/application/errors/booking-errors";

import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type {
  CancelBookingInput,
  CancelBookingOutput,
} from "./cancel-booking.types";

export class CancelBookingUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    try {
      let bookingId: UniqueId;
      try {
        bookingId = UniqueId.from(input.bookingId);
      } catch {
        return failure(new BookingNotFoundError(input.bookingId));
      }

      const booking = await this.bookingRepo.findById(bookingId);
      if (!booking) {
        return failure(new BookingNotFoundError(input.bookingId));
      }

      const authResult = await this.authorize(booking, input.actor);
      if (authResult.isFailure()) {
        return failure(authResult.value);
      }

      booking.cancel(input.reason ?? null);

      await this.bookingRepo.save(booking);

      const domainEvents = booking.pullDomainEvents();

      return success({ booking, domainEvents });
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }

  private async authorize(
    booking: { customerId: UniqueId; tenantId: UniqueId },
    actor: CancelBookingInput["actor"],
  ): Promise<Result<ApplicationError, true>> {
    let actorId: UniqueId;
    try {
      actorId = UniqueId.from(actor.id);
    } catch {
      return failure(new UnauthorizedBookingActionError("Invalid actor id."));
    }

    if (actor.type === "CUSTOMER") {
      if (booking.customerId !== actorId) {
        return failure(
          new UnauthorizedBookingActionError(
            "Customers can only cancel their own bookings.",
          ),
        );
      }
      return success(true);
    }

    const user = await this.userRepo.findById(actorId);
    if (!user) {
      return failure(
        new UnauthorizedBookingActionError("Actor user not found."),
      );
    }
    if (user.role !== "OWNER" || user.tenantId !== booking.tenantId) {
      return failure(
        new UnauthorizedBookingActionError(
          "Only OWNERs of this tenant can cancel bookings.",
        ),
      );
    }
    return success(true);
  }
}

import type { ApplicationError } from "@/application/errors/application-error";
