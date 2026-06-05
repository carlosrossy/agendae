import { describe, it, expect } from "vitest";
import { CancelBookingUseCase } from "@/application/use-cases/booking/cancel-booking";

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
import { BookingCancelled } from "@/domain/events/booking-events";

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT = TimeSlot.create(FUTURE, new Date(FUTURE.getTime() + 60 * 60 * 1000));

const makeSetup = () => {
  const bookingRepo = new InMemoryBookingRepository();
  const userRepo = new InMemoryUserRepository();
  const useCase = new CancelBookingUseCase(bookingRepo, userRepo);

  const tenantId = UniqueId.generate();
  const customerId = UniqueId.generate();
  const professionalId = UniqueId.generate();
  const serviceId = UniqueId.generate();

  const booking = Booking.create({
    tenantId,
    customerId,
    professionalId,
    serviceId,
    timeSlot: SLOT,
    price: Money.fromCents(5000),
  });
  booking.pullDomainEvents();
  bookingRepo.seed([booking]);

  // Owner user of the same tenant.
  const owner = User.create({
    tenantId,
    name: "Maria",
    email: "maria@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  userRepo.seed([owner]);

  return { useCase, bookingRepo, userRepo, booking, owner, tenantId, customerId };
};

describe("CancelBookingUseCase", () => {
  describe("customer authorization", () => {
    it("succeeds when customer cancels own booking", async () => {
      const { useCase, booking, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
        reason: "Cliente desistiu",
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      expect(result.value.booking.status).toBe("CANCELLED");
      expect(result.value.booking.cancellationReason).toBe("Cliente desistiu");
      expect(result.value.domainEvents[0]).toBeInstanceOf(BookingCancelled);
    });

    it("fails when customer tries to cancel someone else's booking", async () => {
      const { useCase, booking } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: UniqueId.generate() }, // different customer
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });
  });

  describe("owner authorization", () => {
    it("succeeds when owner of same tenant cancels", async () => {
      const { useCase, booking, owner } = makeSetup();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "OWNER", id: owner.id },
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;
      expect(result.value.booking.status).toBe("CANCELLED");
    });

    it("fails when owner is from a different tenant", async () => {
      const { useCase, booking, userRepo } = makeSetup();

      const otherOwner = User.create({
        tenantId: UniqueId.generate(), // different tenant!
        name: "Bia",
        email: "bia@y.com",
        passwordHash: "hashed::pwd",
        role: "OWNER",
      });
      userRepo.seed([otherOwner]);

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "OWNER", id: otherOwner.id },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });

    it("fails when actor is STAFF (not OWNER)", async () => {
      const { useCase, booking, userRepo, tenantId } = makeSetup();

      const staff = User.create({
        tenantId,
        name: "Bia (staff)",
        email: "bia@y.com",
        passwordHash: "hashed::pwd",
        role: "STAFF",
      });
      userRepo.seed([staff]);

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "OWNER", id: staff.id },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });
  });

  describe("not found", () => {
    it("fails when booking doesn't exist", async () => {
      const { useCase, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: UniqueId.generate(),
        actor: { type: "CUSTOMER", id: customerId },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingNotFoundError);
    });

    it("fails when bookingId is malformed", async () => {
      const { useCase, customerId } = makeSetup();

      const result = await useCase.execute({
        bookingId: "not-a-ulid",
        actor: { type: "CUSTOMER", id: customerId },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(BookingNotFoundError);
    });
  });

  describe("domain transition rules", () => {
    it("fails when booking is already CANCELLED", async () => {
      const { useCase, booking, customerId } = makeSetup();
      booking.cancel("Primeira tentativa");

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "CUSTOMER", id: customerId },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidBookingTransitionError);
    });

    it("fails when booking is COMPLETED", async () => {
      const { useCase, booking, owner } = makeSetup();
      booking.complete();

      const result = await useCase.execute({
        bookingId: booking.id,
        actor: { type: "OWNER", id: owner.id },
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidBookingTransitionError);
    });
  });
});