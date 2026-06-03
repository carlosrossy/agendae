import { Result, failure, success } from "@/shared/utils/result";
import type { DomainError } from "@/domain/errors/domain-error";
import type { Tenant } from "@/domain/entities/tenant";
import type { Professional } from "@/domain/entities/professional";
import type { Booking } from "@/domain/entities/booking";
import type { TimeSlot } from "@/domain/value-objects/time-slot";
import type { UniqueId } from "@/shared/utils/id";
import {
  BookingConflictError,
  LeadTimeNotRespectedError,
  OutsideBusinessHoursError,
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotBookableError,
  TenantNotActiveError,
} from "@/domain/errors/booking-policy.error";

export interface BookingPolicyInput {
  tenant: Tenant;
  professional: Professional;
  serviceId: UniqueId;
  timeSlot: TimeSlot;
  existingBookings: Booking[];
  now: Date;
}

/**
 * Domain Service: BookingPolicy
 *
 * Encapsulates the cross-entity rules that decide whether a booking
 * can be created at a given time. This logic lives here (and not inside
 * any single Entity) because it inherently spans multiple aggregates:
 *
 *   - Tenant: minimum lead time, active status
 *   - Professional: bookable status, performs service, business hours
 *   - Existing Bookings: conflict detection
 *
 * Returns Result<DomainError, true> so that callers (use cases) can
 * tell exactly which rule failed without try/catch.
 *
 * Stateless: only static methods. No I/O, no side effects.
 */
export const BookingPolicy = {
  /**
   * Checks ALL rules at once. Returns the FIRST violation, or success.
   *
   * Order of checks matters for clarity: cheaper/more fundamental checks
   * come first (status, identity), expensive checks (overlap loop) come last.
   */
  canBeScheduled(input: BookingPolicyInput): Result<DomainError, true> {
    const { tenant, professional, serviceId, timeSlot, existingBookings, now } = input;

    // 1. Tenant must be active.
    if (!tenant.isActive) {
      return failure(new TenantNotActiveError());
    }

    // 2. Professional must be bookable (ACTIVE + has at least one service).
    if (!professional.isBookable) {
      return failure(new ProfessionalNotBookableError());
    }

    // 3. Professional must perform this specific service.
    if (!professional.performsService(serviceId)) {
      return failure(new ProfessionalDoesNotPerformServiceError());
    }

    // 4. Slot must fit within the professional's business hours.
    if (!professional.businessHours.containsSlot(timeSlot)) {
      return failure(new OutsideBusinessHoursError());
    }

    // 5. Slot must respect tenant's minimum lead time.
    const leadMs = tenant.minimumLeadTime.inMinutes * 60_000;
    if (timeSlot.start.getTime() - now.getTime() < leadMs) {
      return failure(new LeadTimeNotRespectedError(tenant.minimumLeadTime.inMinutes));
    }

    // 6. No active conflict with any existing booking of this professional.
    //    (caller is responsible for passing only this professional's bookings)
    for (const existing of existingBookings) {
      if (existing.isTerminal) continue; // cancelled/completed/no_show don't block
      if (existing.timeSlot.overlaps(timeSlot)) {
        return failure(new BookingConflictError());
      }
    }

    return success(true);
  },
};