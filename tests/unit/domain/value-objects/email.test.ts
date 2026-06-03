import { describe, it, expect } from "vitest";
import { Email } from "@/domain/value-objects/email";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

describe("Email", () => {
  describe("creation", () => {
    it("should create an Email from a valid address", () => {
      const email = Email.create("carlos@example.com");

      expect(email.value).toBe("carlos@example.com");
    });

    it("should lowercase the value", () => {
      const email = Email.create("Carlos@Example.COM");

      expect(email.value).toBe("carlos@example.com");
    });

    it("should trim surrounding whitespace", () => {
      const email = Email.create("  carlos@example.com  ");

      expect(email.value).toBe("carlos@example.com");
    });
  });

  describe("validation", () => {
    it.each([
      "",
      "   ",
      "no-at-sign.com",
      "@no-local-part.com",
      "no-domain@",
      "spaces in@email.com",
      "double@@at.com",
      "missing-tld@domain",
    ])("should reject invalid email: %s", (invalid) => {
      expect(() => Email.create(invalid)).toThrow(InvalidEmailError);
    });
  });

  describe("equality", () => {
    it("should consider two Emails with the same value as equal", () => {
      const a = Email.create("x@y.com");
      const b = Email.create("x@y.com");

      expect(a.equals(b)).toBe(true);
    });

    it("should consider two Emails with different values as not equal", () => {
      const a = Email.create("x@y.com");
      const b = Email.create("z@y.com");

      expect(a.equals(b)).toBe(false);
    });

    it("should treat case differences as equal (because of normalization)", () => {
      const a = Email.create("x@y.com");
      const b = Email.create("X@Y.COM");

      expect(a.equals(b)).toBe(true);
    });

    it("should return false when compared to null or undefined", () => {
      const email = Email.create("x@y.com");

      expect(email.equals(null)).toBe(false);
      expect(email.equals(undefined)).toBe(false);
    });
  });

  describe("string representation", () => {
    it("should return the value when calling toString", () => {
      const email = Email.create("x@y.com");

      expect(email.toString()).toBe("x@y.com");
    });
  });
});
