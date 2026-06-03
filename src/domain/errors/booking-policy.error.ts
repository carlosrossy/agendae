import { DomainError } from "./domain-error";

export class ProfessionalDoesNotPerformServiceError extends DomainError {
  readonly code = "PROFESSIONAL_DOES_NOT_PERFORM_SERVICE";

  constructor() {
    super("The selected professional does not perform this service.");
  }
}

export class OutsideBusinessHoursError extends DomainError {
  readonly code = "OUTSIDE_BUSINESS_HOURS";

  constructor() {
    super("The requested time slot is outside the professional's business hours.");
  }
}

export class LeadTimeNotRespectedError extends DomainError {
  readonly code = "LEAD_TIME_NOT_RESPECTED";

  constructor(minimumMinutes: number) {
    super(
      `Bookings must be scheduled at least ${minimumMinutes} minutes in advance.`,
    );
  }
}

export class BookingConflictError extends DomainError {
  readonly code = "BOOKING_CONFLICT";

  constructor() {
    super("The professional already has a booking that conflicts with this time slot.");
  }
}

export class ProfessionalNotBookableError extends DomainError {
  readonly code = "PROFESSIONAL_NOT_BOOKABLE";

  constructor() {
    super("The selected professional is not bookable (archived or has no services).");
  }
}

export class TenantNotActiveError extends DomainError {
  readonly code = "TENANT_NOT_ACTIVE";

  constructor() {
    super("The tenant is not active.");
  }
}