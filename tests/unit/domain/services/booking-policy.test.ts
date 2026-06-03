import { describe, it, expect } from "vitest";
import { BookingPolicy } from "@/domain/services/booking-policy";
import { Tenant } from "@/domain/entities/tenant";
import { Professional } from "@/domain/entities/professional";
import { Booking } from "@/domain/entities/booking";
import { Service } from "@/domain/entities/service";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";
import {
  BookingConflictError,
  LeadTimeNotRespectedError,
  OutsideBusinessHoursError,
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotBookableError,
  TenantNotActiveError,
} from "@/domain/errors/booking-policy.error";

// ─────────────────────────────────────────────────────────────
// Test helpers — build entities consistently across tests.
// ─────────────────────────────────────────────────────────────

const makeTenant = (overrides?: { minimumLeadTimeMinutes?: number; suspended?: boolean }) => {
  const t = Tenant.create({
    name: "Estúdio Maria",
    slug: "estudio-maria",
    email: "contato@estudio.com",
    timezone: "America/Sao_Paulo",
    minimumLeadTimeMinutes: overrides?.minimumLeadTimeMinutes ?? 60,
  });
  if (overrides?.suspended) t.suspend();
  return t;
};

const makeService = (tenantId: UniqueId) =>
  Service.create({
    tenantId,
    name: "Corte",
    durationMinutes: 30,
    priceCents: 5000,
  });

const allDaysOpen = () =>
  BusinessHours.create([
    { dayOfWeek: 0, start: "00:00", end: "23:59" },
    { dayOfWeek: 1, start: "00:00", end: "23:59" },
    { dayOfWeek: 2, start: "00:00", end: "23:59" },
    { dayOfWeek: 3, start: "00:00", end: "23:59" },
    { dayOfWeek: 4, start: "00:00", end: "23:59" },
    { dayOfWeek: 5, start: "00:00", end: "23:59" },
    { dayOfWeek: 6, start: "00:00", end: "23:59" },
  ]);

const makeProfessional = (
  tenantId: UniqueId,
  serviceId: UniqueId,
  overrides?: { archived?: boolean; noServices?: boolean; hours?: BusinessHours },
) => {
  const serviceIds = overrides?.noServices ? [] : [serviceId];
  const p = Professional.create({
    tenantId,
    name: "Maria",
    businessHours: overrides?.hours ?? allDaysOpen(),
    serviceIds,
  });
  if (overrides?.archived) p.archive();
  return p;
};

const futureSlot = (hoursFromNow = 24) => {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return TimeSlot.create(start, end);
};

const buildExistingBooking = (
  tenantId: UniqueId,
  customerId: UniqueId,
  professionalId: UniqueId,
  serviceId: UniqueId,
  slot: TimeSlot,
) =>
  Booking.create({
    tenantId,
    customerId,
    professionalId,
    serviceId,
    timeSlot: slot,
    price: Money.fromCents(5000),
  });

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("BookingPolicy.canBeScheduled", () => {
  it("returns success when ALL rules pass", () => {
    const tenant = makeTenant();
    const service = makeService(tenant.id);
    const professional = makeProfessional(tenant.id, service.id);
    const slot = futureSlot(24);

    const result = BookingPolicy.canBeScheduled({
      tenant,
      professional,
      serviceId: service.id,
      timeSlot: slot,
      existingBookings: [],
      now: new Date(),
    });

    expect(result.isSuccess()).toBe(true);
  });

  describe("rule 1: tenant must be active", () => {
    it("fails when tenant is suspended", () => {
      const tenant = makeTenant({ suspended: true });
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: futureSlot(24),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotActiveError);
    });
  });

  describe("rule 2: professional must be bookable", () => {
    it("fails when professional is archived", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id, { archived: true });

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: futureSlot(24),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotBookableError);
    });

    it("fails when professional has no services", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id, { noServices: true });

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: futureSlot(24),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotBookableError);
    });
  });

  describe("rule 3: professional must perform the service", () => {
    it("fails when professional doesn't perform this service", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const otherService = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: otherService.id, // different!
        timeSlot: futureSlot(24),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalDoesNotPerformServiceError);
    });
  });

  describe("rule 4: slot must be within business hours", () => {
    it("fails when slot is on a closed day", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      // Monday only — 8h-18h
      const hours = BusinessHours.create([
        { dayOfWeek: 1, start: "08:00", end: "18:00" },
      ]);
      const professional = makeProfessional(tenant.id, service.id, { hours });

      // Find next Sunday (always closed).
      const now = new Date();
      const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
      const sundayStart = new Date(now);
      sundayStart.setUTCDate(sundayStart.getUTCDate() + daysUntilSunday);
      sundayStart.setUTCHours(10, 0, 0, 0);
      const sundayEnd = new Date(sundayStart.getTime() + 30 * 60 * 1000);
      const slot = TimeSlot.create(sundayStart, sundayEnd);

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: slot,
        existingBookings: [],
        now,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(OutsideBusinessHoursError);
    });
  });

  describe("rule 5: lead time must be respected", () => {
    it("fails when booking is sooner than minimum lead time", () => {
      const tenant = makeTenant({ minimumLeadTimeMinutes: 120 }); // 2h lead
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);

      // Only 1 hour ahead, but tenant requires 2.
      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: futureSlot(1),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(LeadTimeNotRespectedError);
    });

    it("passes when booking is exactly at minimum lead time", () => {
      const tenant = makeTenant({ minimumLeadTimeMinutes: 60 });
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);

      const now = new Date();
      const start = new Date(now.getTime() + 60 * 60 * 1000); // exactly 1h ahead
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const slot = TimeSlot.create(start, end);

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: slot,
        existingBookings: [],
        now,
      });

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("rule 6: no conflict with existing bookings", () => {
    it("fails when there is an overlapping SCHEDULED booking", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);
      const customerId = UniqueId.generate();

      const slot = futureSlot(24);
      const overlapping = TimeSlot.create(
        new Date(slot.start.getTime() + 10 * 60 * 1000),
        new Date(slot.end.getTime() + 10 * 60 * 1000),
      );
      const existing = buildExistingBooking(
        tenant.id,
        customerId,
        professional.id,
        service.id,
        slot,
      );

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: overlapping,
        existingBookings: [existing],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingConflictError);
    });

    it("passes when existing booking is adjacent (back-to-back)", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);
      const customerId = UniqueId.generate();

      const firstSlot = futureSlot(24);
      const adjacent = TimeSlot.create(
        firstSlot.end,
        new Date(firstSlot.end.getTime() + 30 * 60 * 1000),
      );
      const existing = buildExistingBooking(
        tenant.id,
        customerId,
        professional.id,
        service.id,
        firstSlot,
      );

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: adjacent,
        existingBookings: [existing],
        now: new Date(),
      });

      expect(result.isSuccess()).toBe(true);
    });

    it("passes when conflicting booking is CANCELLED", () => {
      const tenant = makeTenant();
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id);
      const customerId = UniqueId.generate();

      const slot = futureSlot(24);
      const overlapping = TimeSlot.create(
        new Date(slot.start.getTime() + 10 * 60 * 1000),
        new Date(slot.end.getTime() + 10 * 60 * 1000),
      );
      const existing = buildExistingBooking(
        tenant.id,
        customerId,
        professional.id,
        service.id,
        slot,
      );
      existing.cancel("Cliente desistiu");

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: overlapping,
        existingBookings: [existing],
        now: new Date(),
      });

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("rule ordering — first violation wins", () => {
    it("returns TenantNotActiveError when multiple rules would fail", () => {
      // Tenant suspended AND professional archived AND lead time violated.
      // Should report tenant first, since it's the cheapest check.
      const tenant = makeTenant({ suspended: true, minimumLeadTimeMinutes: 1440 });
      const service = makeService(tenant.id);
      const professional = makeProfessional(tenant.id, service.id, { archived: true });

      const result = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot: futureSlot(1),
        existingBookings: [],
        now: new Date(),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotActiveError);
    });
  });
});