import { describe, it, expect } from "vitest";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { Duration } from "@/domain/value-objects/duration";
import { InvalidTimeSlotError } from "@/domain/errors/invalid-time-slot.error";

// Helpers — keep tests readable.
const at = (iso: string) => new Date(iso);
const slot = (startIso: string, endIso: string) =>
  TimeSlot.create(at(startIso), at(endIso));

describe("TimeSlot", () => {
  describe("creation", () => {
    it("should create a valid slot", () => {
      const s = slot("2025-01-15T14:00:00Z", "2025-01-15T14:30:00Z");

      expect(s.start.toISOString()).toBe("2025-01-15T14:00:00.000Z");
      expect(s.end.toISOString()).toBe("2025-01-15T14:30:00.000Z");
    });

    it("should reject when end equals start (zero-length)", () => {
      expect(() =>
        slot("2025-01-15T14:00:00Z", "2025-01-15T14:00:00Z"),
      ).toThrow(InvalidTimeSlotError);
    });

    it("should reject when end is before start", () => {
      expect(() =>
        slot("2025-01-15T14:30:00Z", "2025-01-15T14:00:00Z"),
      ).toThrow(InvalidTimeSlotError);
    });

    it("should reject invalid Date inputs", () => {
      expect(() => TimeSlot.create(new Date("invalid"), new Date())).toThrow(
        InvalidTimeSlotError,
      );
    });
  });

  describe("immutability", () => {
    it("should not be affected by external mutation of the input dates", () => {
      const start = new Date("2025-01-15T14:00:00Z");
      const end = new Date("2025-01-15T14:30:00Z");
      const s = TimeSlot.create(start, end);

      // Mutate the originals AFTER creating the slot.
      start.setFullYear(1999);
      end.setFullYear(1999);

      expect(s.start.getFullYear()).toBe(2025);
      expect(s.end.getFullYear()).toBe(2025);
    });

    it("should not be affected by mutation of the returned dates", () => {
      const s = slot("2025-01-15T14:00:00Z", "2025-01-15T14:30:00Z");

      const exposed = s.start;
      exposed.setFullYear(1999);

      expect(s.start.getFullYear()).toBe(2025);
    });
  });

  describe("fromDuration", () => {
    it("should compute end from start + duration", () => {
      const s = TimeSlot.fromDuration(
        at("2025-01-15T14:00:00Z"),
        Duration.fromMinutes(30),
      );

      expect(s.end.toISOString()).toBe("2025-01-15T14:30:00.000Z");
    });
  });

  describe("duration", () => {
    it("should return the duration between start and end", () => {
      const s = slot("2025-01-15T14:00:00Z", "2025-01-15T15:30:00Z");

      expect(s.duration.inMinutes).toBe(90);
    });
  });

  describe("overlaps — the most important method", () => {
    const a = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");

    it("does NOT overlap when other is entirely before", () => {
      const before = slot("2025-01-15T12:00:00Z", "2025-01-15T13:00:00Z");
      expect(a.overlaps(before)).toBe(false);
    });

    it("does NOT overlap when other is entirely after", () => {
      const after = slot("2025-01-15T16:00:00Z", "2025-01-15T17:00:00Z");
      expect(a.overlaps(after)).toBe(false);
    });

    it("does NOT overlap when adjacent (other ends exactly when a starts)", () => {
      const adjacent = slot("2025-01-15T13:00:00Z", "2025-01-15T14:00:00Z");
      expect(a.overlaps(adjacent)).toBe(false);
    });

    it("does NOT overlap when adjacent (other starts exactly when a ends)", () => {
      const adjacent = slot("2025-01-15T15:00:00Z", "2025-01-15T16:00:00Z");
      expect(a.overlaps(adjacent)).toBe(false);
    });

    it("overlaps when other starts inside a", () => {
      const partial = slot("2025-01-15T14:30:00Z", "2025-01-15T15:30:00Z");
      expect(a.overlaps(partial)).toBe(true);
    });

    it("overlaps when other ends inside a", () => {
      const partial = slot("2025-01-15T13:30:00Z", "2025-01-15T14:30:00Z");
      expect(a.overlaps(partial)).toBe(true);
    });

    it("overlaps when other is fully contained in a", () => {
      const inside = slot("2025-01-15T14:15:00Z", "2025-01-15T14:45:00Z");
      expect(a.overlaps(inside)).toBe(true);
    });

    it("overlaps when other fully contains a", () => {
      const outside = slot("2025-01-15T13:00:00Z", "2025-01-15T16:00:00Z");
      expect(a.overlaps(outside)).toBe(true);
    });

    it("overlaps when identical", () => {
      const identical = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");
      expect(a.overlaps(identical)).toBe(true);
    });

    it("is symmetric (a.overlaps(b) === b.overlaps(a))", () => {
      const b = slot("2025-01-15T14:30:00Z", "2025-01-15T15:30:00Z");
      expect(a.overlaps(b)).toBe(b.overlaps(a));
    });
  });

  describe("contains", () => {
    const a = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");

    it("contains a slot fully inside", () => {
      const inner = slot("2025-01-15T14:15:00Z", "2025-01-15T14:45:00Z");
      expect(a.contains(inner)).toBe(true);
    });

    it("contains itself (boundaries touching)", () => {
      const same = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");
      expect(a.contains(same)).toBe(true);
    });

    it("does NOT contain when other starts before", () => {
      const before = slot("2025-01-15T13:30:00Z", "2025-01-15T14:30:00Z");
      expect(a.contains(before)).toBe(false);
    });

    it("does NOT contain when other ends after", () => {
      const after = slot("2025-01-15T14:30:00Z", "2025-01-15T15:30:00Z");
      expect(a.contains(after)).toBe(false);
    });
  });

  describe("isAdjacentTo", () => {
    const a = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");

    it("is adjacent when other ends exactly when a starts", () => {
      const before = slot("2025-01-15T13:00:00Z", "2025-01-15T14:00:00Z");
      expect(a.isAdjacentTo(before)).toBe(true);
    });

    it("is adjacent when other starts exactly when a ends", () => {
      const after = slot("2025-01-15T15:00:00Z", "2025-01-15T16:00:00Z");
      expect(a.isAdjacentTo(after)).toBe(true);
    });

    it("is NOT adjacent when there is a gap", () => {
      const gap = slot("2025-01-15T16:00:00Z", "2025-01-15T17:00:00Z");
      expect(a.isAdjacentTo(gap)).toBe(false);
    });

    it("is NOT adjacent when overlapping", () => {
      const overlapping = slot("2025-01-15T14:30:00Z", "2025-01-15T15:30:00Z");
      expect(a.isAdjacentTo(overlapping)).toBe(false);
    });
  });

  describe("isInThePast", () => {
    const s = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");

    it("is in the past when now is after end", () => {
      expect(s.isInThePast(at("2025-01-15T15:00:01Z"))).toBe(true);
    });

    it("is in the past when now equals end (slot just finished)", () => {
      expect(s.isInThePast(at("2025-01-15T15:00:00Z"))).toBe(true);
    });

    it("is NOT in the past when slot is still running", () => {
      expect(s.isInThePast(at("2025-01-15T14:30:00Z"))).toBe(false);
    });

    it("is NOT in the past when now is before slot", () => {
      expect(s.isInThePast(at("2025-01-15T13:00:00Z"))).toBe(false);
    });
  });

  describe("equality (inherited from ValueObject)", () => {
    it("considers two slots with same start and end as equal", () => {
      const a = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");
      const b = slot("2025-01-15T14:00:00Z", "2025-01-15T15:00:00Z");

      expect(a.equals(b)).toBe(true);
    });
  });
});