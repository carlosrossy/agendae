import { describe, it, expect, beforeEach } from "vitest";
import { CreateBookingUseCase } from "@/application/use-cases/booking/create-booking";

import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";
import { InMemoryServiceRepository } from "@/application/repositories/in-memory/in-memory-service-repository";
import { InMemoryCustomerRepository } from "@/application/repositories/in-memory/in-memory-customer-repository";
import { InMemoryBookingRepository } from "@/application/repositories/in-memory/in-memory-booking-repository";

import { Tenant } from "@/domain/entities/tenant";
import { Professional } from "@/domain/entities/professional";
import { Service } from "@/domain/entities/service";
import { Customer } from "@/domain/entities/customer";
import { Booking } from "@/domain/entities/booking";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import {
  BookingConflictError,
  LeadTimeNotRespectedError,
  ProfessionalDoesNotPerformServiceError,
  OutsideBusinessHoursError,
} from "@/domain/errors/booking-policy.error";
import { BookingCreated } from "@/domain/events/booking-events";

// ─────────────────────────────────────────────────────────────
// Constants — fixed dates for deterministic tests.
// ─────────────────────────────────────────────────────────────

const MONDAY_2030 = new Date(Date.UTC(2030, 0, 7)); // Mon Jan 7 2030
const MORNING_BEFORE = new Date(Date.UTC(2030, 0, 7, 6, 0)); // 06:00 — "now"
const SLOT_10H = new Date(Date.UTC(2030, 0, 7, 10, 0)); // 10:00 — start

// ─────────────────────────────────────────────────────────────
// Test setup builder
// ─────────────────────────────────────────────────────────────

const makeSetup = () => {
  const tenantRepo = new InMemoryTenantRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const serviceRepo = new InMemoryServiceRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const bookingRepo = new InMemoryBookingRepository();

  const useCase = new CreateBookingUseCase(
    tenantRepo,
    professionalRepo,
    serviceRepo,
    customerRepo,
    bookingRepo,
  );

  const tenant = Tenant.create({
    name: "Estúdio Maria",
    slug: "estudio-maria",
    email: "maria@x.com",
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

  return {
    tenantRepo, professionalRepo, serviceRepo, customerRepo, bookingRepo,
    useCase, tenant, service, professional,
  };
};

const validInput = (overrides: Partial<Parameters<CreateBookingUseCase["execute"]>[0]> = {}) => ({
  tenantSlug: "estudio-maria",
  professionalId: "", // filled below
  serviceId: "",
  startAt: SLOT_10H,
  customerName: "João da Silva",
  customerEmail: "joao@example.com",
  now: MORNING_BEFORE,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CreateBookingUseCase", () => {
  describe("happy path", () => {
    it("creates a booking and a new customer", async () => {
      const { useCase, professional, service, bookingRepo, customerRepo } = makeSetup();

      const result = await useCase.execute(
        validInput({ professionalId: professional.id, serviceId: service.id }),
      );

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const { booking, customer, domainEvents } = result.value;

      expect(booking).toBeInstanceOf(Booking);
      expect(booking.status).toBe("SCHEDULED");
      expect(booking.professionalId).toBe(professional.id);
      expect(booking.serviceId).toBe(service.id);
      expect(booking.timeSlot.duration.inMinutes).toBe(60);
      expect(booking.price.cents).toBe(5000);

      expect(customer).toBeInstanceOf(Customer);
      expect(customer.name).toBe("João da Silva");
      expect(customer.email.value).toBe("joao@example.com");

      expect(booking.customerId).toBe(customer.id);

      expect(bookingRepo.list()).toHaveLength(1);
      expect(customerRepo.list()).toHaveLength(1);

      // Domain events should include BookingCreated.
      expect(domainEvents).toHaveLength(1);
      expect(domainEvents[0]).toBeInstanceOf(BookingCreated);
    });

    it("reuses an existing customer if email already exists for this tenant", async () => {
      const { useCase, professional, service, customerRepo, tenant } = makeSetup();

      // Pre-seed a customer with the same email.
      const existing = Customer.create({
        tenantId: tenant.id,
        name: "João Pré-existente",
        email: "joao@example.com",
      });
      customerRepo.seed([existing]);

      const result = await useCase.execute(
        validInput({ professionalId: professional.id, serviceId: service.id }),
      );

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      expect(result.value.customer.id).toBe(existing.id);
      expect(customerRepo.list()).toHaveLength(1); // no duplication
    });

    it("normalizes customer email when matching existing", async () => {
      const { useCase, professional, service, customerRepo, tenant } = makeSetup();

      const existing = Customer.create({
        tenantId: tenant.id,
        name: "João",
        email: "joao@example.com",
      });
      customerRepo.seed([existing]);

      const result = await useCase.execute(
        validInput({
          professionalId: professional.id,
          serviceId: service.id,
          customerEmail: "  JOAO@EXAMPLE.COM  ", // different case + whitespace
        }),
      );

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;
      expect(result.value.customer.id).toBe(existing.id);
    });
  });

  describe("validation failures", () => {
    it("fails with TenantNotFoundError for unknown slug", async () => {
      const { useCase, professional, service } = makeSetup();

      const result = await useCase.execute(
        validInput({
          professionalId: professional.id,
          serviceId: service.id,
          tenantSlug: "ghost-tenant",
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotFoundError);
    });

    it("fails with ProfessionalNotFoundError for unknown professional", async () => {
      const { useCase, service } = makeSetup();

      const result = await useCase.execute(
        validInput({ professionalId: UniqueId.generate(), serviceId: service.id }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotFoundError);
    });

    it("fails with ServiceNotFoundError for unknown service", async () => {
      const { useCase, professional } = makeSetup();

      const result = await useCase.execute(
        validInput({ professionalId: professional.id, serviceId: UniqueId.generate() }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ServiceNotFoundError);
    });

    it("fails with ProfessionalNotFoundError when professional is from a different tenant (cross-tenant guard)", async () => {
      const { useCase, service, tenantRepo, professionalRepo } = makeSetup();

      // Create a second tenant + professional that belongs to it.
      const otherTenant = Tenant.create({
        name: "Outro",
        slug: "outro",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([otherTenant]);

      const intruder = Professional.create({
        tenantId: otherTenant.id, // different tenant!
        name: "Bia",
        businessHours: BusinessHours.create([
          { dayOfWeek: 1, start: "09:00", end: "18:00" },
        ]),
        serviceIds: [service.id], // hypothetically performs the service
      });
      professionalRepo.seed([intruder]);

      // Attacker passes our tenant's slug + the OTHER tenant's professional.
      const result = await useCase.execute(
        validInput({
          tenantSlug: "estudio-maria",
          professionalId: intruder.id,
          serviceId: service.id,
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotFoundError);
    });
  });

  describe("policy violations propagate", () => {
    it("propagates BookingConflictError on overlapping slot", async () => {
      const { useCase, professional, service, bookingRepo, tenant } = makeSetup();

      // Pre-seed a booking 10:00-11:00.
      const existing = Booking.create({
        tenantId: tenant.id,
        customerId: UniqueId.generate(),
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(SLOT_10H, new Date(SLOT_10H.getTime() + 60 * 60 * 1000)),
        price: Money.fromCents(5000),
        now: MORNING_BEFORE,
      });
      bookingRepo.seed([existing]);

      const result = await useCase.execute(
        validInput({ professionalId: professional.id, serviceId: service.id }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingConflictError);
    });

    it("propagates LeadTimeNotRespectedError when too soon", async () => {
      const { useCase, professional, service } = makeSetup();

      // Now = 09:30, slot at 10:00 — only 30min ahead, but tenant requires 60.
      const lateNow = new Date(Date.UTC(2030, 0, 7, 9, 30));
      const result = await useCase.execute(
        validInput({
          professionalId: professional.id,
          serviceId: service.id,
          now: lateNow,
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(LeadTimeNotRespectedError);
    });

    it("propagates OutsideBusinessHoursError on closed days", async () => {
      const { useCase, professional, service } = makeSetup();

      // Sunday — closed.
      const SUNDAY = new Date(Date.UTC(2030, 0, 6, 10, 0));
      const result = await useCase.execute(
        validInput({
          professionalId: professional.id,
          serviceId: service.id,
          startAt: SUNDAY,
          now: new Date(Date.UTC(2030, 0, 6, 6, 0)),
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(OutsideBusinessHoursError);
    });

    it("propagates ProfessionalDoesNotPerformServiceError", async () => {
      const { useCase, professional, serviceRepo, tenant } = makeSetup();

      // Add another service the professional doesn't perform.
      const otherService = Service.create({
        tenantId: tenant.id,
        name: "Pedicure",
        durationMinutes: 60,
        priceCents: 8000,
      });
      serviceRepo.seed([otherService]);

      const result = await useCase.execute(
        validInput({
          professionalId: professional.id,
          serviceId: otherService.id,
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalDoesNotPerformServiceError);
    });
  });

  describe("rollback on failure", () => {
    it("does NOT persist anything when policy fails", async () => {
      const { useCase, professional, service, bookingRepo, customerRepo, tenant } = makeSetup();

      // Pre-seed conflicting booking.
      const existing = Booking.create({
        tenantId: tenant.id,
        customerId: UniqueId.generate(),
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(SLOT_10H, new Date(SLOT_10H.getTime() + 60 * 60 * 1000)),
        price: Money.fromCents(5000),
        now: MORNING_BEFORE,
      });
      bookingRepo.seed([existing]);

      await useCase.execute(
        validInput({ professionalId: professional.id, serviceId: service.id }),
      );

      expect(bookingRepo.list()).toHaveLength(1); // only the pre-seeded one
      expect(customerRepo.list()).toHaveLength(0);
    });
  });
});