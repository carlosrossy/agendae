import { describe, it, expect } from "vitest";
import { MarkAsNoShowUseCase } from "@/application/use-cases/booking/mark-as-no-show";
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
import { BookingNoShow } from "@/domain/events/booking-events";

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT = TimeSlot.create(FUTURE, new Date(FUTURE.getTime() + 60 * 60 * 1000));

const makeSetup = () => {
  const bookingRepo = new InMemoryBookingRepository();
  const userRepo = new InMemoryUserRepository();
  const useCase = new MarkAsNoShowUseCase(bookingRepo, userRepo);
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
  userRepo.seed([owner]);

  return { useCase, booking, owner };
};

describe("MarkAsNoShowUseCase", () => {
  it("marks booking as NO_SHOW", async () => {
    const { useCase, booking, owner } = makeSetup();

    const result = await useCase.execute({ bookingId: booking.id, actorUserId: owner.id });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.booking.status).toBe("NO_SHOW");
    expect(result.value.domainEvents[0]).toBeInstanceOf(BookingNoShow);
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

  it("fails when actor isn't authorized", async () => {
    const { useCase, booking } = makeSetup();
    const result = await useCase.execute({
      bookingId: booking.id,
      actorUserId: UniqueId.generate(),
    });
    expect(result.isFailure()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
  });
});