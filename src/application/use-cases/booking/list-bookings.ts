import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";

import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";
import { TenantNotFoundError } from "@/application/errors/tenant-errors";

import type { Result } from "@/shared/utils/result";
import type { ApplicationError } from "@/application/errors/application-error";
import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { ListBookingsInput, ListBookingsOutput } from "./list-bookings.types";
import { Booking } from "@/domain/entities/booking";

export class ListBookingsUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly userRepo: UserRepository,
    private readonly professionalRepo: ProfessionalRepository,
  ) {}

  async execute(input: ListBookingsInput): Promise<ListBookingsOutput> {
    try {
      let tenantId: UniqueId;
      try {
        tenantId = UniqueId.from(input.tenantId);
      } catch {
        return failure(new TenantNotFoundError(input.tenantId));
      }

      const authResult = await this.authorize(input.actorUserId, tenantId);
      if (authResult.isFailure()) return failure(authResult.value);

      if (input.to.getTime() <= input.from.getTime()) {
        return failure(
          new UnauthorizedBookingActionError("'to' must be after 'from'.") as never,
        );
      }

      let professionalIds: UniqueId[];
      if (input.professionalId) {
        let pid: UniqueId;
        try {
          pid = UniqueId.from(input.professionalId);
        } catch {
          return success({ bookings: [] });
        }

        const prof = await this.professionalRepo.findById(pid);
        if (!prof || prof.tenantId !== tenantId) {
          return success({ bookings: [] });
        }
        professionalIds = [pid];
      } else {
        const allProfs = await this.professionalRepo.findByTenant(tenantId, {
          includeArchived: true,
        });
        professionalIds = allProfs.map((p) => p.id);
      }

      const merged: Booking[] = [];

      for (const pid of professionalIds) {
        const bookings = await this.bookingRepo.findByProfessionalInRange(
          pid, input.from, input.to,
        );
        merged.push(...bookings);
      }

      const filtered = input.statuses?.length
        ? merged.filter((b) => input.statuses!.includes(b.status))
        : merged;

      filtered.sort((a, b) => a.timeSlot.start.getTime() - b.timeSlot.start.getTime());

      return success({ bookings: filtered });
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
        new UnauthorizedBookingActionError("Only tenant staff can list bookings."),
      );
    }
    return success(true);
  }
}