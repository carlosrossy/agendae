import { describe, it, expect } from "vitest";
import { Duration } from "@/domain/value-objects/duration";
import { InvalidDurationError } from "@/domain/errors/invalid-duration.error";

describe("Duration", () => {
  describe("fromMinutes", () => {
    it("should create a Duration with the given minutes", () => {
      const duration = Duration.fromMinutes(30);

      expect(duration.inMinutes).toBe(30);
    });

    it.each([0, -1, -30])("should reject non-positive values: %s", (value) => {
      expect(() => Duration.fromMinutes(value)).toThrow(InvalidDurationError);
    });

    it.each([1.5, 30.7, Number.NaN, Number.POSITIVE_INFINITY])(
      "should reject non-integer values: %s",
      (value) => {
        expect(() => Duration.fromMinutes(value)).toThrow(InvalidDurationError);
      },
    );
  });

  describe("fromHours", () => {
    it("should convert hours to minutes", () => {
      const duration = Duration.fromHours(2);

      expect(duration.inMinutes).toBe(120);
    });

    it("should accept fractional hours that result in whole minutes", () => {
      // 0.5h = 30min — integer minutes, so it's valid.
      const duration = Duration.fromHours(0.5);

      expect(duration.inMinutes).toBe(30);
    });

    it("should reject fractional hours that result in fractional minutes", () => {
      // 0.01h = 0.6 minutes — fractional, invalid.
      expect(() => Duration.fromHours(0.01)).toThrow(InvalidDurationError);
    });
  });

  describe("inHours getter", () => {
    it("should return hours as a decimal", () => {
      const duration = Duration.fromMinutes(90);

      expect(duration.inHours).toBe(1.5);
    });
  });

  describe("plus", () => {
    it("should return a new Duration that is the sum of both", () => {
      const a = Duration.fromMinutes(30);
      const b = Duration.fromMinutes(45);

      const sum = a.plus(b);

      expect(sum.inMinutes).toBe(75);
    });

    it("should not mutate the original durations", () => {
      const a = Duration.fromMinutes(30);
      const b = Duration.fromMinutes(45);

      a.plus(b);

      expect(a.inMinutes).toBe(30);
      expect(b.inMinutes).toBe(45);
    });
  });

  describe("comparison", () => {
    it("should compare correctly with isGreaterThan", () => {
      const big = Duration.fromMinutes(60);
      const small = Duration.fromMinutes(30);

      expect(big.isGreaterThan(small)).toBe(true);
      expect(small.isGreaterThan(big)).toBe(false);
    });

    it("should compare correctly with isLessThan", () => {
      const big = Duration.fromMinutes(60);
      const small = Duration.fromMinutes(30);

      expect(small.isLessThan(big)).toBe(true);
      expect(big.isLessThan(small)).toBe(false);
    });

    it("should be neither greater nor less than itself", () => {
      const a = Duration.fromMinutes(30);
      const b = Duration.fromMinutes(30);

      expect(a.isGreaterThan(b)).toBe(false);
      expect(a.isLessThan(b)).toBe(false);
    });
  });

  describe("equality (inherited from ValueObject)", () => {
    it("should consider two Durations with the same minutes as equal", () => {
      const a = Duration.fromMinutes(30);
      const b = Duration.fromMinutes(30);

      expect(a.equals(b)).toBe(true);
    });

    it("should treat 60 minutes and 1 hour as equal", () => {
      const a = Duration.fromMinutes(60);
      const b = Duration.fromHours(1);

      expect(a.equals(b)).toBe(true);
    });
  });

  describe("toString", () => {
    it.each([
      [30, "30min"],
      [45, "45min"],
      [60, "1h"],
      [120, "2h"],
      [90, "1h30"],
      [75, "1h15"],
      [125, "2h05"],
    ])("should format %s minutes as %s", (minutes, expected) => {
      const duration = Duration.fromMinutes(minutes);

      expect(duration.toString()).toBe(expected);
    });
  });
});