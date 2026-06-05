import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaBookingRepository } from "@/infrastructure/database/prisma/repositories/prisma-booking.repository";
import { PrismaProfessionalRepository } from "@/infrastructure/database/prisma/repositories/prisma-professional.repository";
import { PrismaServiceRepository } from "@/infrastructure/database/prisma/repositories/prisma-service.repository";
import { PrismaCustomerRepository } from "@/infrastructure/database/prisma/repositories/prisma-customer.repository";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { Booking } from "@/domain/entities/booking";
import { Professional } from "@/domain/entities/professional";
import { Service } from "@/domain/entities/service";
import { Customer } from "@/domain/entities/customer";
import { Tenant } from "@/domain/entities/tenant";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import {
  prismaTest,
  cleanDatabase,
  disconnectPrismaTest,
} from "../../../../helpers/prisma-test";

describe("PrismaBookingRepository (integration)", () => {
  const repository = new PrismaBookingRepository(prismaTest);
  const professionalRepository = new PrismaProfessionalRepository(prismaTest);
  const serviceRepository = new PrismaServiceRepository(prismaTest);
  const customerRepository = new PrismaCustomerRepository(prismaTest);
  const tenantRepository = new PrismaTenantRepository(prismaTest);

  // Fixed clock so timeSlots stay deterministic and in the future.
  const NOW = new Date("2026-06-10T08:00:00.000Z");

  let tenant: Tenant;
  let customer: Customer;
  let professional: Professional;
  let service: Service;

  beforeEach(async () => {
    await cleanDatabase();

    tenant = Tenant.create({
      name: "Estúdio Maria",
      slug: "estudio-maria",
      email: "maria@x.com",
      timezone: "America/Sao_Paulo",
    });
    await tenantRepository.save(tenant);

    service = Service.create({
      tenantId: tenant.id,
      name: "Corte",
      durationMinutes: 30,
      priceCents: 5000,
    });
    await serviceRepository.save(service);

    professional = Professional.create({
      tenantId: tenant.id,
      name: "Maria Pro",
      businessHours: BusinessHours.create([
        { dayOfWeek: 1, start: "09:00", end: "18:00" },
      ]),
      serviceIds: [service.id],
    });
    await professionalRepository.save(professional);

    customer = Customer.create({
      tenantId: tenant.id,
      name: "João Cliente",
      email: "joao@cliente.com",
    });
    await customerRepository.save(customer);
  });

  afterAll(async () => {
    await disconnectPrismaTest();
  });

  function makeBooking(startIso: string, endIso: string) {
    return Booking.create({
      tenantId: tenant.id,
      customerId: customer.id,
      professionalId: professional.id,
      serviceId: service.id,
      timeSlot: TimeSlot.create(new Date(startIso), new Date(endIso)),
      price: Money.fromCents(5000),
      now: NOW,
    });
  }

  describe("save", () => {
    it("inserts a new booking", async () => {
      const booking = makeBooking(
        "2026-06-10T09:00:00.000Z",
        "2026-06-10T09:30:00.000Z",
      );

      await repository.save(booking);

      const found = await repository.findById(booking.id);
      expect(found).not.toBeNull();
      expect(found?.status).toBe("SCHEDULED");
      expect(found?.price.cents).toBe(5000);
    });

    it("persists a status transition on update", async () => {
      const booking = makeBooking(
        "2026-06-10T09:00:00.000Z",
        "2026-06-10T09:30:00.000Z",
      );
      await repository.save(booking);

      booking.cancel("cliente desistiu");
      await repository.save(booking);

      const found = await repository.findById(booking.id);
      expect(found?.status).toBe("CANCELLED");
      expect(found?.cancellationReason).toBe("cliente desistiu");
    });
  });

  describe("findByProfessionalInRange", () => {
    const rangeFrom = new Date("2026-06-10T09:00:00.000Z");
    const rangeTo = new Date("2026-06-10T10:00:00.000Z");

    it("returns a booking that overlaps the range", async () => {
      const booking = makeBooking(
        "2026-06-10T09:15:00.000Z",
        "2026-06-10T09:45:00.000Z",
      );
      await repository.save(booking);

      const result = await repository.findByProfessionalInRange(
        professional.id,
        rangeFrom,
        rangeTo,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(booking.id);
    });

    it("excludes a booking entirely outside the range", async () => {
      const booking = makeBooking(
        "2026-06-10T11:00:00.000Z",
        "2026-06-10T11:30:00.000Z",
      );
      await repository.save(booking);

      const result = await repository.findByProfessionalInRange(
        professional.id,
        rangeFrom,
        rangeTo,
      );

      expect(result).toHaveLength(0);
    });

    it("treats edge-touching as non-overlapping (booking ends exactly at range start)", async () => {
      const booking = makeBooking(
        "2026-06-10T08:30:00.000Z",
        "2026-06-10T09:00:00.000Z", // ends exactly at rangeFrom
      );
      await repository.save(booking);

      const result = await repository.findByProfessionalInRange(
        professional.id,
        rangeFrom,
        rangeTo,
      );

      expect(result).toHaveLength(0);
    });

    it("does NOT filter by status (cancelled bookings are still returned)", async () => {
      const booking = makeBooking(
        "2026-06-10T09:15:00.000Z",
        "2026-06-10T09:45:00.000Z",
      );
      booking.cancel("teste");
      await repository.save(booking);

      const result = await repository.findByProfessionalInRange(
        professional.id,
        rangeFrom,
        rangeTo,
      );

      // Status filtering is the BookingPolicy's job, not the repository's.
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("CANCELLED");
    });

    it("does not leak bookings from another professional", async () => {
      const otherPro = Professional.create({
        tenantId: tenant.id,
        name: "Outro Pro",
        businessHours: BusinessHours.create([
          { dayOfWeek: 1, start: "09:00", end: "18:00" },
        ]),
        serviceIds: [service.id],
      });
      await professionalRepository.save(otherPro);

      const theirs = Booking.create({
        tenantId: tenant.id,
        customerId: customer.id,
        professionalId: otherPro.id,
        serviceId: service.id,
        timeSlot: TimeSlot.create(
          new Date("2026-06-10T09:15:00.000Z"),
          new Date("2026-06-10T09:45:00.000Z"),
        ),
        price: Money.fromCents(5000),
        now: NOW,
      });
      await repository.save(theirs);

      const result = await repository.findByProfessionalInRange(
        professional.id,
        rangeFrom,
        rangeTo,
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("removes the booking", async () => {
      const booking = makeBooking(
        "2026-06-10T09:00:00.000Z",
        "2026-06-10T09:30:00.000Z",
      );
      await repository.save(booking);

      await repository.delete(booking.id);

      const found = await repository.findById(booking.id);
      expect(found).toBeNull();
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});
