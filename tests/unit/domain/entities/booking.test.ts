import { describe, it, expect } from "vitest";
import { Booking } from "@/domain/entities/booking";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";
import { InvalidBookingError } from "@/domain/errors/invalid-booking.error";
import {
  BookingInThePastError,
  InvalidBookingTransitionError,
} from "@/domain/errors/booking-state.error";
import {
  BookingCancelled,
  BookingCompleted,
  BookingCreated,
  BookingNoShow,
  BookingRescheduled,
} from "@/domain/events/booking-events";

const tenantId = UniqueId.generate();
const customerId = UniqueId.generate();
const professionalId = UniqueId.generate();
const serviceId = UniqueId.generate();

const futureSlot = () => {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
  const end = new Date(start.getTime() + 30 * 60 * 1000); // +30min
  return TimeSlot.create(start, end);
};

const farFutureSlot = () => {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000); // +2 days
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return TimeSlot.create(start, end);
};

const validInput = () => ({
  tenantId,
  customerId,
  professionalId,
  serviceId,
  timeSlot: futureSlot(),
  price: Money.fromCents(5000),
});

describe("Booking", () => {
  describe("create — happy path", () => {
    it("creates a SCHEDULED booking", () => {
      const b = Booking.create(validInput());

      expect(b.status).toBe("SCHEDULED");
      expect(b.isScheduled).toBe(true);
      expect(b.isTerminal).toBe(false);
      expect(b.tenantId).toBe(tenantId);
      expect(b.customerId).toBe(customerId);
      expect(b.professionalId).toBe(professionalId);
      expect(b.serviceId).toBe(serviceId);
      expect(b.timeSlot).toBeInstanceOf(TimeSlot);
      expect(b.price).toBeInstanceOf(Money);
      expect(b.cancellationReason).toBeNull();
      expect(b.notes).toBeNull();
    });

    it("emits BookingCreated event on creation", () => {
      const b = Booking.create(validInput());
      const events = b.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCreated);
      expect(events[0]?.aggregateId).toBe(b.id);
    });

    it("pullDomainEvents clears the queue", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents();

      expect(b.pullDomainEvents()).toHaveLength(0);
    });

    it("accepts optional notes", () => {
      const b = Booking.create({ ...validInput(), notes: "Cliente prefere atendimento em silêncio" });
      expect(b.notes).toBe("Cliente prefere atendimento em silêncio");
    });
  });

  describe("create — rejection: past slot", () => {
    it("rejects a slot in the past", () => {
      const start = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const past = TimeSlot.create(start, end);

      expect(() =>
        Booking.create({ ...validInput(), timeSlot: past }),
      ).toThrow(BookingInThePastError);
    });

    it("uses the provided `now` for past-check", () => {
      const fixedNow = new Date("2025-01-15T12:00:00Z");
      const slot = TimeSlot.create(
        new Date("2025-01-15T14:00:00Z"),
        new Date("2025-01-15T14:30:00Z"),
      );

      // With now=2025-01-15T12:00, slot at 14:00 is future — OK.
      expect(() =>
        Booking.create({ ...validInput(), timeSlot: slot, now: fixedNow }),
      ).not.toThrow();

      // With now=2025-01-15T15:00, slot is past — should throw.
      const laterNow = new Date("2025-01-15T15:00:00Z");
      expect(() =>
        Booking.create({ ...validInput(), timeSlot: slot, now: laterNow }),
      ).toThrow(BookingInThePastError);
    });
  });

  describe("create — input validation", () => {
    it("rejects when timeSlot is not a TimeSlot", () => {
      expect(() =>
        // @ts-expect-error — testing runtime validation
        Booking.create({ ...validInput(), timeSlot: { start: new Date() } }),
      ).toThrow(InvalidBookingError);
    });

    it("rejects when price is not a Money", () => {
      expect(() =>
        // @ts-expect-error — testing runtime validation
        Booking.create({ ...validInput(), price: 50 }),
      ).toThrow(InvalidBookingError);
    });
  });

  describe("cancel", () => {
    it("cancels a SCHEDULED booking", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents(); // clear creation event

      b.cancel("Cliente desistiu");

      expect(b.status).toBe("CANCELLED");
      expect(b.cancellationReason).toBe("Cliente desistiu");
      expect(b.isTerminal).toBe(true);
    });

    it("emits BookingCancelled event", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents();

      b.cancel("teste");
      const events = b.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCancelled);
    });

    it("allows null reason", () => {
      const b = Booking.create(validInput());
      b.cancel(null);

      expect(b.cancellationReason).toBeNull();
      expect(b.status).toBe("CANCELLED");
    });

    it("trims and treats empty reason as null", () => {
      const b = Booking.create(validInput());
      b.cancel("   ");
      expect(b.cancellationReason).toBeNull();
    });

    it("fails to cancel an already CANCELLED booking", () => {
      const b = Booking.create(validInput());
      b.cancel();
      expect(() => b.cancel()).toThrow(InvalidBookingTransitionError);
    });

    it("fails to cancel a COMPLETED booking", () => {
      const b = Booking.create(validInput());
      b.complete();
      expect(() => b.cancel()).toThrow(InvalidBookingTransitionError);
    });

    it("rejects reason too long", () => {
      const b = Booking.create(validInput());
      expect(() => b.cancel("a".repeat(501))).toThrow(InvalidBookingError);
    });
  });

  describe("complete", () => {
    it("completes a SCHEDULED booking", () => {
      const b = Booking.create(validInput());
      b.complete();

      expect(b.status).toBe("COMPLETED");
      expect(b.isTerminal).toBe(true);
    });

    it("emits BookingCompleted event", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents();

      b.complete();
      const events = b.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCompleted);
    });

    it("fails on already COMPLETED", () => {
      const b = Booking.create(validInput());
      b.complete();
      expect(() => b.complete()).toThrow(InvalidBookingTransitionError);
    });
  });

  describe("markAsNoShow", () => {
    it("marks SCHEDULED as NO_SHOW", () => {
      const b = Booking.create(validInput());
      b.markAsNoShow();

      expect(b.status).toBe("NO_SHOW");
      expect(b.isTerminal).toBe(true);
    });

    it("emits BookingNoShow event", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents();

      b.markAsNoShow();
      const events = b.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingNoShow);
    });

    it("fails on terminal status", () => {
      const b = Booking.create(validInput());
      b.cancel();
      expect(() => b.markAsNoShow()).toThrow(InvalidBookingTransitionError);
    });
  });

  describe("reschedule", () => {
    it("changes timeSlot but keeps SCHEDULED", () => {
      const b = Booking.create(validInput());
      const originalStart = b.timeSlot.start.getTime();
      const newSlot = farFutureSlot();

      b.reschedule(newSlot);

      expect(b.status).toBe("SCHEDULED");
      expect(b.timeSlot.start.getTime()).not.toBe(originalStart);
      expect(b.timeSlot.start.getTime()).toBe(newSlot.start.getTime());
    });

    it("emits BookingRescheduled event with previous and new starts", () => {
      const b = Booking.create(validInput());
      const originalStart = b.timeSlot.start;
      b.pullDomainEvents();

      const newSlot = farFutureSlot();
      b.reschedule(newSlot);
      const events = b.pullDomainEvents();

      expect(events).toHaveLength(1);
      const rescheduled = events[0] as BookingRescheduled;
      expect(rescheduled).toBeInstanceOf(BookingRescheduled);
      expect(rescheduled.previousStart.getTime()).toBe(originalStart.getTime());
      expect(rescheduled.newStart.getTime()).toBe(newSlot.start.getTime());
    });

    it("rejects rescheduling to the past", () => {
      const b = Booking.create(validInput());
      const start = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const past = TimeSlot.create(start, end);

      expect(() => b.reschedule(past)).toThrow(BookingInThePastError);
    });

    it("rejects rescheduling a CANCELLED booking", () => {
      const b = Booking.create(validInput());
      b.cancel();
      expect(() => b.reschedule(farFutureSlot())).toThrow(InvalidBookingError);
    });

    it("rejects non-TimeSlot input", () => {
      const b = Booking.create(validInput());
      // @ts-expect-error — testing runtime validation
      expect(() => b.reschedule({ start: new Date() })).toThrow(InvalidBookingError);
    });
  });

  describe("conflictsWith", () => {
    it("returns true for overlapping SCHEDULED bookings", () => {
      const a = Booking.create(validInput());
      // Build a second booking that overlaps with `a`'s slot.
      const overlapping = TimeSlot.create(
        new Date(a.timeSlot.start.getTime() + 5 * 60 * 1000),
        new Date(a.timeSlot.end.getTime() + 5 * 60 * 1000),
      );
      const b = Booking.create({ ...validInput(), timeSlot: overlapping });

      expect(a.conflictsWith(b)).toBe(true);
      expect(b.conflictsWith(a)).toBe(true);
    });

    it("returns false for adjacent slots (back-to-back)", () => {
      const a = Booking.create(validInput());
      const adjacent = TimeSlot.create(
        a.timeSlot.end,
        new Date(a.timeSlot.end.getTime() + 30 * 60 * 1000),
      );
      const b = Booking.create({ ...validInput(), timeSlot: adjacent });

      expect(a.conflictsWith(b)).toBe(false);
    });

    it("returns false when one booking is CANCELLED", () => {
      const a = Booking.create(validInput());
      const overlapping = TimeSlot.create(
        new Date(a.timeSlot.start.getTime() + 5 * 60 * 1000),
        new Date(a.timeSlot.end.getTime() + 5 * 60 * 1000),
      );
      const b = Booking.create({ ...validInput(), timeSlot: overlapping });

      a.cancel();
      expect(a.conflictsWith(b)).toBe(false);
      expect(b.conflictsWith(a)).toBe(false);
    });

    it("returns false when one booking is COMPLETED", () => {
      const a = Booking.create(validInput());
      const overlapping = TimeSlot.create(
        new Date(a.timeSlot.start.getTime() + 5 * 60 * 1000),
        new Date(a.timeSlot.end.getTime() + 5 * 60 * 1000),
      );
      const b = Booking.create({ ...validInput(), timeSlot: overlapping });

      b.complete();
      expect(a.conflictsWith(b)).toBe(false);
    });
  });

  describe("changeNotes", () => {
    it("updates notes", () => {
      const b = Booking.create(validInput());
      b.changeNotes("Nova observação");
      expect(b.notes).toBe("Nova observação");
    });

    it("accepts null to clear", () => {
      const b = Booking.create({ ...validInput(), notes: "algo" });
      b.changeNotes(null);
      expect(b.notes).toBeNull();
    });

    it("does not emit events for note changes", () => {
      const b = Booking.create(validInput());
      b.pullDomainEvents();

      b.changeNotes("nova");
      expect(b.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe("equality (inherited)", () => {
    it("two bookings with same id are equal", () => {
      const a = Booking.create(validInput());
      const b = Booking.restore({
        id: a.id,
        tenantId: a.tenantId,
        customerId: a.customerId,
        professionalId: a.professionalId,
        serviceId: a.serviceId,
        timeSlot: farFutureSlot(),
        price: Money.fromCents(9999),
        status: "COMPLETED",
        cancellationReason: null,
        notes: null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });
  });
});