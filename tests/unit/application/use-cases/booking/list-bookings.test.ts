import { describe, it, expect } from "vitest";
import { ListBookingsUseCase } from "@/application/use-cases/booking/list-bookings";
import { InMemoryBookingRepository } from "@/application/repositories/in-memory/in-memory-booking-repository";
import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";

import { Booking } from "@/domain/entities/booking";
import { Professional } from "@/domain/entities/professional";
import { User } from "@/domain/entities/user";
import { Tenant } from "@/domain/entities/tenant";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";

const MONDAY = new Date(Date.UTC(2030, 0, 7));
const at = (h: number) => new Date(Date.UTC(2030, 0, 7, h, 0));

const FROM = new Date(Date.UTC(2030, 0, 7, 0, 0));
const TO = new Date(Date.UTC(2030, 0, 8, 0, 0));

const makeSetup = () => {
  const bookingRepo = new InMemoryBookingRepository();
  const userRepo = new InMemoryUserRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const useCase = new ListBookingsUseCase(bookingRepo, userRepo, professionalRepo);

  const tenant = Tenant.create({
    name: "Estúdio",
    slug: "estudio",
    email: "a@a.com",
    timezone: "America/Sao_Paulo",
  });

  const owner = User.create({
    tenantId: tenant.id,
    name: "Owner",
    email: "owner@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  userRepo.seed([owner]);

  const prof1 = Professional.create({
    tenantId: tenant.id,
    name: "Maria",
    businessHours: BusinessHours.create([{ dayOfWeek: 1, start: "09:00", end: "18:00" }]),
  });
  const prof2 = Professional.create({
    tenantId: tenant.id,
    name: "Bia",
    businessHours: BusinessHours.create([{ dayOfWeek: 1, start: "09:00", end: "18:00" }]),
  });
  professionalRepo.seed([prof1, prof2]);

  return { useCase, bookingRepo, professionalRepo, userRepo, tenant, owner, prof1, prof2 };
};

const makeBooking = (tenantId: UniqueId, professionalId: UniqueId, startHour: number) =>
  Booking.create({
    tenantId,
    customerId: UniqueId.generate(),
    professionalId,
    serviceId: UniqueId.generate(),
    timeSlot: TimeSlot.create(at(startHour), at(startHour + 1)),
    price: Money.fromCents(5000),
  });

describe("ListBookingsUseCase", () => {
  it("returns all bookings of the tenant in range when no professionalId", async () => {
    const { useCase, bookingRepo, tenant, owner, prof1, prof2 } = makeSetup();

    const b1 = makeBooking(tenant.id, prof1.id, 10);
    const b2 = makeBooking(tenant.id, prof2.id, 14);
    bookingRepo.seed([b1, b2]);

    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      from: FROM,
      to: TO,
    });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.bookings).toHaveLength(2);
  });

  it("filters by professionalId", async () => {
    const { useCase, bookingRepo, tenant, owner, prof1, prof2 } = makeSetup();

    const b1 = makeBooking(tenant.id, prof1.id, 10);
    const b2 = makeBooking(tenant.id, prof2.id, 14);
    bookingRepo.seed([b1, b2]);

    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      professionalId: prof1.id,
      from: FROM,
      to: TO,
    });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.bookings).toHaveLength(1);
    expect(result.value.bookings[0]?.professionalId).toBe(prof1.id);
  });

  it("filters by status", async () => {
    const { useCase, bookingRepo, tenant, owner, prof1 } = makeSetup();

    const b1 = makeBooking(tenant.id, prof1.id, 10);
    const b2 = makeBooking(tenant.id, prof1.id, 14);
    b2.cancel();
    bookingRepo.seed([b1, b2]);

    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      from: FROM,
      to: TO,
      statuses: ["SCHEDULED"],
    });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.bookings).toHaveLength(1);
    expect(result.value.bookings[0]?.status).toBe("SCHEDULED");
  });

  it("returns sorted by start time", async () => {
    const { useCase, bookingRepo, tenant, owner, prof1 } = makeSetup();

    const b14 = makeBooking(tenant.id, prof1.id, 14);
    const b10 = makeBooking(tenant.id, prof1.id, 10);
    bookingRepo.seed([b14, b10]); // seed in reverse order

    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      from: FROM,
      to: TO,
    });

    if (!result.isSuccess()) return;
    expect(result.value.bookings[0]?.timeSlot.start.getUTCHours()).toBe(10);
    expect(result.value.bookings[1]?.timeSlot.start.getUTCHours()).toBe(14);
  });

  it("fails when actor isn't authorized", async () => {
    const { useCase, tenant } = makeSetup();
    const result = await useCase.execute({
      actorUserId: UniqueId.generate(),
      tenantId: tenant.id,
      from: FROM,
      to: TO,
    });

    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
  });

  it("fails when from >= to", async () => {
    const { useCase, tenant, owner } = makeSetup();
    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      from: TO, // swapped
      to: FROM,
    });

    expect(result.isFailure()).toBe(true);
  });

  it("ignores professionalId from another tenant (returns empty)", async () => {
    const { useCase, professionalRepo, bookingRepo, tenant, owner, prof1 } = makeSetup();

    // Pre-seed a booking for prof1.
    bookingRepo.seed([makeBooking(tenant.id, prof1.id, 10)]);

    // Pro from another tenant.
    const otherProf = Professional.create({
      tenantId: UniqueId.generate(),
      name: "Outro",
      businessHours: BusinessHours.create([{ dayOfWeek: 1, start: "09:00", end: "18:00" }]),
    });
    professionalRepo.seed([otherProf]);

    const result = await useCase.execute({
      actorUserId: owner.id,
      tenantId: tenant.id,
      professionalId: otherProf.id,
      from: FROM,
      to: TO,
    });

    if (!result.isSuccess()) return;
    expect(result.value.bookings).toHaveLength(0);
  });
});