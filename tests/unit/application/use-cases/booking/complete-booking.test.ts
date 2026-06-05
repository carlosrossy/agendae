import { describe, it, expect } from "vitest";
import { CompleteBookingUseCase } from "@/application/use-cases/booking/complete-booking";
import { InMemoryBookingRepository } from "@/application/repositories/in-memory/in-memory-booking-repository";
import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";

import { Booking } from "@/domain/entities/booking";
import { User } from "@/domain/entities/user";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

import {
  BookingNotFoundError,
  UnauthorizedBookingActionError,
} from "@/application/errors/booking-errors";
import { InvalidBookingTransitionError } from "@/domain/errors/booking-state.error";
import { BookingCompleted } from "@/domain/events/booking-events";

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT = TimeSlot.create(FUTURE, new Date(FUTURE.getTime() + 60 * 60 * 1000));

const makeSetup = () => {
  const bookingRepo = new InMemoryBookingRepository();
  const userRepo = new InMemoryUserRepository();
  const useCase = new CompleteBookingUseCase(bookingRepo, userRepo);

  const tenantId = UniqueId.generate();

  const booking = Booking.create({
    tenantId,
    customerId: UniqueId.generate(),
    professionalId: UniqueId.generate(),
    serviceId: UniqueId.generate(),
    timeSlot: SLOT,
    price: Money.fromCents(5000),
  });
  booking.pullDomainEvents();
  bookingRepo.seed([booking]);

  const owner = User.create({
    tenantId,
    name: "Owner",
    email: "owner@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  const staff = User.create({
    tenantId,
    name: "Staff",
    email: "staff@x.com",
    passwordHash: "hashed::pwd",
    role: "STAFF",
  });
  userRepo.seed([owner, staff]);

  return { useCase, bookingRepo, userRepo, booking, owner, staff, tenantId };
};

describe("CompleteBookingUseCase", () => {
  it("completes when OWNER calls", async () => {
    const { useCase, booking, owner } = makeSetup();
    const result = await useCase.execute({ bookingId: booking.id, actorUserId: owner.id });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.booking.status).toBe("COMPLETED");
    expect(result.value.domainEvents[0]).toBeInstanceOf(BookingCompleted);
  });

  it("completes when STAFF of same tenant calls", async () => {
    const { useCase, booking, staff } = makeSetup();
    const result = await useCase.execute({ bookingId: booking.id, actorUserId: staff.id });

    expect(result.isSuccess()).toBe(true);
  });

  it("fails when actor is from a different tenant", async () => {
    const { useCase, booking, userRepo } = makeSetup();

    const stranger = User.create({
      tenantId: UniqueId.generate(),
      name: "Outro",
      email: "outro@x.com",
      passwordHash: "hashed::pwd",
      role: "OWNER",
    });
    userRepo.seed([stranger]);

    const result = await useCase.execute({ bookingId: booking.id, actorUserId: stranger.id });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
  });

  it("fails when actor is CUSTOMER", async () => {
    const { useCase, booking, userRepo, tenantId } = makeSetup();

    const customer = User.create({
      tenantId,
      name: "Customer",
      email: "cust@x.com",
      passwordHash: "hashed::pwd",
      role: "CUSTOMER",
    });
    userRepo.seed([customer]);

    const result = await useCase.execute({ bookingId: booking.id, actorUserId: customer.id });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
  });

  it("fails when booking is already CANCELLED", async () => {
    const { useCase, booking, owner } = makeSetup();
    booking.cancel();

    const result = await useCase.execute({ bookingId: booking.id, actorUserId: owner.id });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidBookingTransitionError);
  });

  it("fails when booking doesn't exist", async () => {
    const { useCase, owner } = makeSetup();
    const result = await useCase.execute({
      bookingId: UniqueId.generate(),
      actorUserId: owner.id,
    });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingNotFoundError);
  });
});