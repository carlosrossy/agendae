import { TimeSlot } from "@/domain/value-objects/time-slot";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";
import { BookingPolicy } from "@/domain/services/booking-policy";

import {
  BookingNotFoundError,
  UnauthorizedBookingActionError,
} from "@/application/errors/booking-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { TenantNotFoundError } from "@/application/errors/tenant-errors";

import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { ApplicationError } from "@/application/errors/application-error";
import type { Result } from "@/shared/utils/result";

import type {
  RescheduleBookingInput,
  RescheduleBookingOutput,
} from "./reschedule-booking.types";

export class RescheduleBookingUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly userRepo: UserRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly serviceRepo: ServiceRepository,
  ) {}

  async execute(input: RescheduleBookingInput): Promise<RescheduleBookingOutput> {
    try {
      const now = input.now ?? new Date();

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

      const tenant = await this.tenantRepo.findById(booking.tenantId);
      if (!tenant) return failure(new TenantNotFoundError(booking.tenantId));

      const professional = await this.professionalRepo.findById(booking.professionalId);
      if (!professional) return failure(new ProfessionalNotFoundError(booking.professionalId));

      const service = await this.serviceRepo.findById(booking.serviceId);
      if (!service) return failure(new ServiceNotFoundError(booking.serviceId));

      const newSlot = TimeSlot.fromDuration(input.newStartAt, service.duration);

      const dayStart = new Date(
        Date.UTC(
          input.newStartAt.getUTCFullYear(),
          input.newStartAt.getUTCMonth(),
          input.newStartAt.getUTCDate(),
          0, 0, 0, 0,
        ),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const sameDay = await this.bookingRepo.findByProfessionalInRange(
        professional.id,
        dayStart,
        dayEnd,
      );
      const others = sameDay.filter((b) => b.id !== booking.id);

      const policyResult = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: newSlot,
        existingBookings: others,
        now,
      });
      if (policyResult.isFailure()) {
        return failure(policyResult.value);
      }

      booking.reschedule(newSlot, now);

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
    actor: RescheduleBookingInput["actor"],
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
          new UnauthorizedBookingActionError("Customers can only reschedule their own bookings."),
        );
      }
      return success(true);
    }

    const user = await this.userRepo.findById(actorId);
    if (!user) {
      return failure(new UnauthorizedBookingActionError("Actor user not found."));
    }
    if (user.role !== "OWNER" || user.tenantId !== booking.tenantId) {
      return failure(
        new UnauthorizedBookingActionError("Only OWNERs of this tenant can reschedule bookings."),
      );
    }
    return success(true);
  }
}