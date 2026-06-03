import { describe, it, expect } from "vitest";
import { BusinessHours, WeeklyWindow } from "@/domain/value-objects/business-hours";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { InvalidBusinessHoursError } from "@/domain/errors/invalid-business-hours.error";

const slot = (startIso: string, endIso: string) =>
  TimeSlot.create(new Date(startIso), new Date(endIso));

describe("BusinessHours", () => {
  describe("creation — valid", () => {
    it("should accept a simple weekly schedule", () => {
      const hours = BusinessHours.create([
        { dayOfWeek: 1, start: "09:00", end: "18:00" },
        { dayOfWeek: 6, start: "09:00", end: "13:00" },
      ]);

      expect(hours.listWindows()).toHaveLength(2);
    });

    it("should accept multiple windows on the same day (morning + afternoon)", () => {
      const hours = BusinessHours.create([
        { dayOfWeek: 1, start: "09:00", end: "12:00" },
        { dayOfWeek: 1, start: "14:00", end: "18:00" },
      ]);

      expect(hours.listWindows()).toHaveLength(2);
    });

    it("should accept an empty schedule (closed all week)", () => {
      const hours = BusinessHours.create([]);

      expect(hours.listWindows()).toHaveLength(0);
    });

    it("should sort windows by day and start time", () => {
      const hours = BusinessHours.create([
        { dayOfWeek: 6, start: "09:00", end: "13:00" },
        { dayOfWeek: 1, start: "14:00", end: "18:00" },
        { dayOfWeek: 1, start: "09:00", end: "12:00" },
      ]);

      const list = hours.listWindows();
      expect(list[0]?.dayOfWeek).toBe(1);
      expect(list[0]?.startMinutes).toBe(9 * 60);
      expect(list[1]?.dayOfWeek).toBe(1);
      expect(list[1]?.startMinutes).toBe(14 * 60);
      expect(list[2]?.dayOfWeek).toBe(6);
    });
  });

  describe("creation — invalid", () => {
    it.each([
      [-1, "Sunday-1"],
      [7, "after-Saturday"],
      [1.5, "fractional"],
    ])("should reject invalid dayOfWeek %s (%s)", (dayOfWeek) => {
      expect(() =>
        BusinessHours.create([
          // @ts-expect-error — testing runtime validation
          { dayOfWeek, start: "09:00", end: "18:00" },
        ]),
      ).toThrow(InvalidBusinessHoursError);
    });

    it.each([
      "9:00",
      "09:0",
      "ab:cd",
      "25:00",
      "09:60",
      "",
    ])("should reject invalid time format: %s", (time) => {
      expect(() =>
        BusinessHours.create([{ dayOfWeek: 1, start: time, end: "18:00" }]),
      ).toThrow(InvalidBusinessHoursError);
    });

    it("should reject when end equals start", () => {
      expect(() =>
        BusinessHours.create([{ dayOfWeek: 1, start: "09:00", end: "09:00" }]),
      ).toThrow(InvalidBusinessHoursError);
    });

    it("should reject when end is before start", () => {
      expect(() =>
        BusinessHours.create([{ dayOfWeek: 1, start: "18:00", end: "09:00" }]),
      ).toThrow(InvalidBusinessHoursError);
    });

    it("should reject overlapping windows on the same day", () => {
      expect(() =>
        BusinessHours.create([
          { dayOfWeek: 1, start: "09:00", end: "12:00" },
          { dayOfWeek: 1, start: "11:00", end: "14:00" }, // overlaps
        ]),
      ).toThrow(InvalidBusinessHoursError);
    });

    it("should accept adjacent windows on the same day (touching at boundary)", () => {
      const hours = BusinessHours.create([
        { dayOfWeek: 1, start: "09:00", end: "12:00" },
        { dayOfWeek: 1, start: "12:00", end: "14:00" }, // adjacent, not overlap
      ]);

      expect(hours.listWindows()).toHaveLength(2);
    });
  });

  describe("isOpenOn", () => {
    const hours = BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
      { dayOfWeek: 6, start: "09:00", end: "13:00" },
    ]);

    it("returns true for days with windows", () => {
      expect(hours.isOpenOn(1)).toBe(true);
      expect(hours.isOpenOn(6)).toBe(true);
    });

    it("returns false for days without windows", () => {
      expect(hours.isOpenOn(0)).toBe(false); // Sunday
      expect(hours.isOpenOn(2)).toBe(false); // Tuesday
      expect(hours.isOpenOn(5)).toBe(false); // Friday
    });
  });

  describe("containsSlot", () => {
    // Monday = 2025-01-13 (UTC).
    // Sunday = 2025-01-12 (UTC).
    const hours = BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" }, // Monday
      { dayOfWeek: 1, start: "20:00", end: "22:00" }, // Monday late shift
    ]);

    it("returns true when slot is fully within a window", () => {
      const s = slot("2025-01-13T10:00:00Z", "2025-01-13T11:00:00Z");
      expect(hours.containsSlot(s)).toBe(true);
    });

    it("returns true when slot touches the window boundary exactly", () => {
      const s = slot("2025-01-13T09:00:00Z", "2025-01-13T10:00:00Z");
      expect(hours.containsSlot(s)).toBe(true);
    });

    it("returns true when slot fits in a later window of the same day", () => {
      const s = slot("2025-01-13T20:30:00Z", "2025-01-13T21:30:00Z");
      expect(hours.containsSlot(s)).toBe(true);
    });

    it("returns false when slot starts before the window", () => {
      const s = slot("2025-01-13T08:30:00Z", "2025-01-13T10:00:00Z");
      expect(hours.containsSlot(s)).toBe(false);
    });

    it("returns false when slot ends after the window", () => {
      const s = slot("2025-01-13T17:00:00Z", "2025-01-13T19:00:00Z");
      expect(hours.containsSlot(s)).toBe(false);
    });

    it("returns false when slot falls between two windows of the same day (gap)", () => {
      const s = slot("2025-01-13T18:30:00Z", "2025-01-13T19:30:00Z");
      expect(hours.containsSlot(s)).toBe(false);
    });

    it("returns false when slot is on a closed day", () => {
      const s = slot("2025-01-12T10:00:00Z", "2025-01-12T11:00:00Z"); // Sunday
      expect(hours.containsSlot(s)).toBe(false);
    });

    it("returns false when slot crosses midnight (different days)", () => {
      const s = slot("2025-01-13T23:30:00Z", "2025-01-14T00:30:00Z");
      expect(hours.containsSlot(s)).toBe(false);
    });
  });

  describe("immutability", () => {
  it("listWindows returns a fresh array on each call", () => {
    const hours = BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
    ]);

    expect(hours.listWindows()).not.toBe(hours.listWindows());
  });

  it("mutating the returned array does not affect future calls", () => {
    const hours = BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
    ]);

    const copy = hours.listWindows();
    (copy as unknown as WeeklyWindow[]).pop();

    expect(hours.listWindows()).toHaveLength(1);
  });
});
});