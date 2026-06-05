import { describe, it, expect, beforeEach } from "vitest";
import { ListAvailableSlotsUseCase } from "@/application/use-cases/booking/list-available-slots";
import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";
import { InMemoryServiceRepository } from "@/application/repositories/in-memory/in-memory-service-repository";
import { InMemoryBookingRepository } from "@/application/repositories/in-memory/in-memory-booking-repository";
import { Tenant } from "@/domain/entities/tenant";
import { Professional } from "@/domain/entities/professional";
import { Service } from "@/domain/entities/service";
import { Booking } from "@/domain/entities/booking";
import { Money } from "@/domain/value-objects/money";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";
import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import {
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotBookableError,
  TenantNotActiveError,
} from "@/domain/errors/booking-policy.error";

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────

const MONDAY_2030 = new Date(Date.UTC(2030, 0, 7)); // Mon, Jan 7, 2030 — far future
const SUNDAY_2030 = new Date(Date.UTC(2030, 0, 6)); // Sun, Jan 6, 2030

const atTime = (date: Date, hours: number, minutes = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes));

const makeSetup = () => {
  const tenantRepo = new InMemoryTenantRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const serviceRepo = new InMemoryServiceRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const useCase = new ListAvailableSlotsUseCase(
    tenantRepo,
    professionalRepo,
    serviceRepo,
    bookingRepo,
  );

  const tenant = Tenant.create({
    name: "Estúdio Maria",
    slug: "estudio-maria",
    email: "maria@x.com",
    timezone: "America/Sao_Paulo",
    minimumLeadTimeMinutes: 60, // 1 hour
  });
  tenantRepo.seed([tenant]);

  const service = Service.create({
    tenantId: tenant.id,
    name: "Manicure",
    durationMinutes: 60,
    priceCents: 5000,
  });
  serviceRepo.seed([service]);

  // Monday 09:00-18:00.
  const hours = BusinessHours.create([
    { dayOfWeek: 1, start: "09:00", end: "18:00" },
  ]);
  const professional = Professional.create({
    tenantId: tenant.id,
    name: "Maria",
    businessHours: hours,
    serviceIds: [service.id],
  });
  professionalRepo.seed([professional]);

  return { tenantRepo, professionalRepo, serviceRepo, bookingRepo, useCase, tenant, service, professional };
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ListAvailableSlotsUseCase", () => {
  describe("happy path", () => {
    it("returns 30-min slots from 09:00 to 17:00 for a 60-min service", async () => {
      const { useCase, professional, service } = makeSetup();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6), // long before opening
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const slots = result.value.slots;

      // Expected starts: 09:00, 09:30, 10:00, ..., 17:00. That's 17 slots.
      expect(slots).toHaveLength(17);
      expect(slots[0]?.start.toISOString()).toContain("T09:00");
      expect(slots[slots.length - 1]?.start.toISOString()).toContain("T17:00");
      // The last slot ends exactly at 18:00 (window end) — boundary OK.
      expect(slots[slots.length - 1]?.end.toISOString()).toContain("T18:00");
    });

    it("uses custom granularity", async () => {
      const { useCase, professional, service } = makeSetup();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        granularityMinutes: 60,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      // 09:00, 10:00, ..., 17:00 = 9 slots.
      expect(result.value.slots).toHaveLength(9);
    });
  });

  describe("closed days", () => {
    it("returns empty list when the date falls on a closed day", async () => {
      const { useCase, professional, service } = makeSetup();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: SUNDAY_2030, // closed
        now: atTime(SUNDAY_2030, 6),
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      expect(result.value.slots).toHaveLength(0);
    });
  });

  describe("conflict with existing bookings", () => {
    it("excludes slots overlapping an existing SCHEDULED booking", async () => {
      const { useCase, professional, service, bookingRepo, tenant } = makeSetup();

      // Add a booking 10:00–11:00.
      const existing = Booking.create({
        tenantId: tenant.id,
        customerId: UniqueId.generate(),
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(atTime(MONDAY_2030, 10), atTime(MONDAY_2030, 11)),
        price: Money.fromCents(5000),
        now: atTime(MONDAY_2030, 6),
      });
      bookingRepo.seed([existing]);

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      if (!result.isSuccess()) throw new Error("expected success");
      const startsHours = result.value.slots.map((s) => s.start.getUTCHours() + s.start.getUTCMinutes() / 60);

      // Slots that should be excluded: 09:30 (ends 10:30, overlaps 10:00),
      //                                10:00 (overlaps),
      //                                10:30 (overlaps 10:00-11:00).
      expect(startsHours).not.toContain(9.5);
      expect(startsHours).not.toContain(10);
      expect(startsHours).not.toContain(10.5);

      // But 11:00 should be there (adjacent — back-to-back is allowed).
      expect(startsHours).toContain(11);
    });

    it("does NOT exclude when the existing booking is CANCELLED", async () => {
      const { useCase, professional, service, bookingRepo, tenant } = makeSetup();

      const existing = Booking.create({
        tenantId: tenant.id,
        customerId: UniqueId.generate(),
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(atTime(MONDAY_2030, 10), atTime(MONDAY_2030, 11)),
        price: Money.fromCents(5000),
        now: atTime(MONDAY_2030, 6),
      });
      existing.cancel("Cliente desistiu");
      bookingRepo.seed([existing]);

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      if (!result.isSuccess()) throw new Error("expected success");
      const startsHours = result.value.slots.map((s) => s.start.getUTCHours() + s.start.getUTCMinutes() / 60);

      // 10:00 should be back — cancellation freed it.
      expect(startsHours).toContain(10);
    });
  });

  describe("minimum lead time", () => {
    it("removes slots that violate tenant lead time", async () => {
      const { useCase, professional, service } = makeSetup();

      // Tenant requires 60min lead time. Now = 09:30.
      // So 09:00, 09:30, 10:00 are NOT allowed (start before now+60min).
      // 10:30 onwards should be allowed.
      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 9, 30),
      });

      if (!result.isSuccess()) throw new Error("expected success");
      const starts = result.value.slots.map((s) => s.start.toISOString());

      expect(starts.some((s) => s.includes("T09:00"))).toBe(false);
      expect(starts.some((s) => s.includes("T09:30"))).toBe(false);
      expect(starts.some((s) => s.includes("T10:00"))).toBe(false);
      expect(starts.some((s) => s.includes("T10:30"))).toBe(true);
    });

    it("returns empty list when 'now' is so late nothing fits", async () => {
      const { useCase, professional, service } = makeSetup();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 18), // 18:00 — closing
      });

      if (!result.isSuccess()) throw new Error("expected success");
      expect(result.value.slots).toHaveLength(0);
    });
  });

  describe("multiple windows on the same day", () => {
    it("respects morning + afternoon split", async () => {
      // Override the professional with split hours.
      const setup = makeSetup();
      const { useCase, tenant, service, professionalRepo } = setup;

      const split = Professional.create({
        tenantId: tenant.id,
        name: "Maria",
        businessHours: BusinessHours.create([
          { dayOfWeek: 1, start: "09:00", end: "12:00" },
          { dayOfWeek: 1, start: "14:00", end: "18:00" },
        ]),
        serviceIds: [service.id],
      });
      professionalRepo.clear();
      professionalRepo.seed([split]);

      const result = await useCase.execute({
        professionalId: split.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      if (!result.isSuccess()) throw new Error("expected success");
      const starts = result.value.slots.map((s) => s.start.getUTCHours() + s.start.getUTCMinutes() / 60);

      // Morning: 09:00 → last that fits is 11:00 (ends 12:00). 5 slots.
      // No slots between 12:00 and 14:00 (lunch).
      // Afternoon: 14:00 → last is 17:00. 7 slots.
      // Total 12 slots.
      expect(starts).toContain(9);
      expect(starts).toContain(11);
      expect(starts).not.toContain(11.5); // would end 12:30, past morning end
      expect(starts).not.toContain(12);
      expect(starts).not.toContain(13.5);
      expect(starts).toContain(14);
      expect(starts).toContain(17);
      expect(starts).not.toContain(17.5);
    });
  });

  describe("validation failures", () => {
    it("fails with ProfessionalNotFoundError for unknown professional", async () => {
      const { useCase, service } = makeSetup();

      const result = await useCase.execute({
        professionalId: UniqueId.generate(),
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotFoundError);
    });

    it("fails with ServiceNotFoundError for unknown service", async () => {
      const { useCase, professional } = makeSetup();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: UniqueId.generate(),
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ServiceNotFoundError);
    });

    it("fails when tenant is suspended", async () => {
      const { useCase, tenant, professional, service } = makeSetup();
      tenant.suspend();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotActiveError);
    });

    it("fails when professional is archived", async () => {
      const { useCase, professional, service } = makeSetup();
      professional.archive();

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: service.id,
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotBookableError);
    });

    it("fails when professional does not perform the service", async () => {
      const { useCase, professional, service, serviceRepo, tenant } = makeSetup();

      // Create another service the professional does NOT perform.
      const otherService = Service.create({
        tenantId: tenant.id,
        name: "Outro",
        durationMinutes: 30,
        priceCents: 3000,
      });
      serviceRepo.seed([otherService]);

      const result = await useCase.execute({
        professionalId: professional.id,
        serviceId: otherService.id, // not in professional.serviceIds
        date: MONDAY_2030,
        now: atTime(MONDAY_2030, 6),
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalDoesNotPerformServiceError);
    });
  });
});