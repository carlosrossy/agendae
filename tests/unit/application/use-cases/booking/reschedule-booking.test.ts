import { describe, it, expect } from "vitest";
import { RescheduleBookingUseCase } from "@/application/use-cases/booking/reschedule-booking";

import { InMemoryBookingRepository } from "@/application/repositories/in-memory/in-memory-booking-repository";
import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";
import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";
import { InMemoryServiceRepository } from "@/application/repositories/in-memory/in-memory-service-repository";

import { Tenant } from "@/domain/entities/tenant";
import { Professional } from "@/domain/entities/professional";
import { Service } from "@/domain/entities/service";
import { User } from "@/domain/entities/user";
import { Booking } from "@/domain/entities/booking";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

import {
  BookingNotFoundError,
  UnauthorizedBookingActionError,
} from "@/application/errors/booking-errors";
import { BookingConflictError } from "@/domain/errors/booking-policy.error";
import { BookingRescheduled } from "@/domain/events/booking-events";

const MONDAY_2030 = new Date(Date.UTC(2030, 0, 7));
const NOW = new Date(Date.UTC(2030, 0, 7, 6, 0));

const at = (h: number, m = 0) =>
  new Date(Date.UTC(MONDAY_2030.getUTCFullYear(), MONDAY_2030.getUTCMonth(), MONDAY_2030.getUTCDate(), h, m));

const makeSetup = () => {
  const bookingRepo = new InMemoryBookingRepository();
  const userRepo = new InMemoryUserRepository();
  const tenantRepo = new InMemoryTenantRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const serviceRepo = new InMemoryServiceRepository();

  const useCase = new RescheduleBookingUseCase(
    bookingRepo, userRepo, tenantRepo, professionalRepo, serviceRepo,
  );

  const tenant = Tenant.create({
    name: "Estúdio",
    slug: "estudio",
    email: "a@a.com",
    timezone: "America/Sao_Paulo",
    minimumLeadTimeMinutes: 60,
  });
  tenantRepo.seed([tenant]);

  const service = Service.create({
    tenantId: tenant.id,
    name: "Manicure",
    durationMinutes: 60,
    priceCents: 5000,
  });
  serviceRepo.seed([service]);

  const professional = Professional.create({
    tenantId: tenant.id,
    name: "Maria",
    businessHours: BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
    ]),
    serviceIds: [service.id],
  });
  professionalRepo.seed([professional]);

  const customerId = UniqueId.generate();

  const booking = Booking.create({
    tenantId: tenant.id,
    customerId,
    professionalId: professional.id,
    serviceId: service.id,
    timeSlot: TimeSlot.create(at(10), at(11)),
    price: service.price,
    now: NOW,
  });
  booking.pullDomainEvents();
  bookingRepo.seed([booking]);

  const owner = User.create({
    tenantId: tenant.id,
    name: "Maria User",
    email: "owner@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  userRepo.seed([owner]);

  return { useCase, bookingRepo, booking, owner, customerId, professional, service, tenant };
};

describe("RescheduleBookingUseCase", () => {
  describe("happy path", () => {
    it("reschedules to a valid new slot", async () => {
      const { useCase, booking, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
        newStartAt: at(14, 0),
        now: NOW,
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      expect(result.value.booking.timeSlot.start.toISOString()).toContain("T14:00");
      expect(result.value.booking.status).toBe("SCHEDULED");
      expect(result.value.domainEvents[0]).toBeInstanceOf(BookingRescheduled);
    });

    it("does NOT conflict with itself when moving", async () => {
      // This is the critical edge case: rescheduling to a slot that overlaps
      // the booking's ORIGINAL slot — should still succeed (we're moving it).
      const { useCase, booking, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
        // Original is 10:00-11:00, new is 10:30-11:30 — overlaps original
        newStartAt: at(10, 30),
        now: NOW,
      });

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("conflict with OTHER bookings", () => {
    it("fails when new slot conflicts with another existing booking", async () => {
      const { useCase, bookingRepo, booking, customerId, professional, service, tenant } = makeSetup();

      // Another booking 14:00-15:00 (different booking).
      const other = Booking.create({
        tenantId: tenant.id,
        customerId: UniqueId.generate(),
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(at(14), at(15)),
        price: service.price,
        now: NOW,
      });
      bookingRepo.seed([other]);

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
        newStartAt: at(14, 30), // overlaps `other`
        now: NOW,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingConflictError);
    });
  });

  describe("authorization", () => {
    it("fails when another customer tries to reschedule", async () => {
      const { useCase, booking } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: UniqueId.generate() },
        newStartAt: at(14),
        now: NOW,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });

    it("succeeds when OWNER of the tenant reschedules", async () => {
      const { useCase, booking, owner } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "OWNER", id: owner.id },
        newStartAt: at(14),
        now: NOW,
      });

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("not found", () => {
    it("fails when booking doesn't exist", async () => {
      const { useCase, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: UniqueId.generate(),
        actor: { type: "CUSTOMER", id: customerId },
        newStartAt: at(14),
        now: NOW,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingNotFoundError);
    });
  });

  describe("status protection", () => {
    it("fails when booking is already CANCELLED", async () => {
      const { useCase, booking, customerId } = makeSetup();
      booking.cancel();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
        newStartAt: at(14),
        now: NOW,
      });

      expect(result.isFailure()).toBe(true);
    });
  });
});