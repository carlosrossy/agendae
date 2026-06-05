import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";

import {
  BookingNotFoundError,
  UnauthorizedBookingActionError,
} from "@/application/errors/booking-errors";

import type { Result } from "@/shared/utils/result";
import type { ApplicationError } from "@/application/errors/application-error";
import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { MarkAsNoShowInput, MarkAsNoShowOutput } from "./mark-as-no-show.types";

export class MarkAsNoShowUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(input: MarkAsNoShowInput): Promise<MarkAsNoShowOutput> {
    try {
      let bookingId: UniqueId;
      try {
        bookingId = UniqueId.from(input.bookingId);
      } catch {
        return failure(new BookingNotFoundError(input.bookingId));
      }

      const booking = await this.bookingRepo.findById(bookingId);
      if (!booking) return failure(new BookingNotFoundError(input.bookingId));

      const authResult = await this.authorize(input.actorUserId, booking.tenantId);
      if (authResult.isFailure()) return failure(authResult.value);

      booking.markAsNoShow();
      await this.bookingRepo.save(booking);

      return success({ booking, domainEvents: booking.pullDomainEvents() });
    } catch (err) {
      if (err instanceof Error) return failure(err as never);
      throw err;
    }
  }

  private async authorize(
    actorUserId: string,
    tenantId: UniqueId,
  ): Promise<Result<ApplicationError, true>> {
    let userId: UniqueId;
    try {
      userId = UniqueId.from(actorUserId);
    } catch {
      return failure(new UnauthorizedBookingActionError("Invalid actor id."));
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      return failure(new UnauthorizedBookingActionError("Actor user not found."));
    }
    if (user.tenantId !== tenantId) {
      return failure(
        new UnauthorizedBookingActionError("Actor does not belong to this tenant."),
      );
    }
    if (user.role !== "OWNER" && user.role !== "STAFF") {
      return failure(
        new UnauthorizedBookingActionError("Only tenant staff can mark bookings as no-show."),
      );
    }
    return success(true);
  }
}