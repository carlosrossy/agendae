import { describe, it, expect } from "vitest";
import { Phone } from "@/domain/value-objects/phone";
import { InvalidPhoneError } from "@/domain/errors/invalid-phone.error";

describe("Phone", () => {
  describe("create — valid mobile", () => {
    it.each([
      "11999999999",
      "(11) 99999-9999",
      "(11) 9 9999-9999",
      "11 99999-9999",
      "+55 11 99999-9999",
      "+5511999999999",
      "  (11) 99999-9999  ",
    ])("should accept and normalize: %s", (input) => {
      const phone = Phone.create(input);

      expect(phone.digits).toBe("11999999999");
      expect(phone.isMobile).toBe(true);
      expect(phone.isFixed).toBe(false);
    });
  });

  describe("create — valid fixed", () => {
    it.each([
      "1133334444",
      "(11) 3333-4444",
      "11 3333-4444",
      "+55 11 3333-4444",
    ])("should accept and normalize: %s", (input) => {
      const phone = Phone.create(input);

      expect(phone.digits).toBe("1133334444");
      expect(phone.isFixed).toBe(true);
      expect(phone.isMobile).toBe(false);
    });
  });

  describe("create — invalid", () => {
    it.each([
      "",
      "   ",
      "abc",
      "1234567",                // muito curto
      "999999999999",           // 12 dígitos sem ser +55
      "00999999999",            // DDD 00 inválido
      "10999999999",            // DDD 10 inválido (mínimo é 11)
      "11899999999",            // 11 dígitos mas terceiro não é 9 (móvel inválido)
      "1109999999",             // fixo começando com 0
      "1119999999",             // fixo começando com 1
    ])("should reject: %s", (input) => {
      expect(() => Phone.create(input)).toThrow(InvalidPhoneError);
    });

    it("should reject non-string input", () => {
      // @ts-expect-error — testing runtime behavior
      expect(() => Phone.create(null)).toThrow(InvalidPhoneError);
      // @ts-expect-error — testing runtime behavior
      expect(() => Phone.create(undefined)).toThrow(InvalidPhoneError);
      // @ts-expect-error — testing runtime behavior
      expect(() => Phone.create(11999999999)).toThrow(InvalidPhoneError);
    });
  });

  describe("format", () => {
    it("should format mobile correctly", () => {
      const phone = Phone.create("11999999999");

      expect(phone.format()).toBe("(11) 99999-9999");
    });

    it("should format fixed correctly", () => {
      const phone = Phone.create("1133334444");

      expect(phone.format()).toBe("(11) 3333-4444");
    });

    it("toString returns the formatted value", () => {
      const phone = Phone.create("11999999999");

      expect(phone.toString()).toBe("(11) 99999-9999");
    });
  });

  describe("equality (inherited from ValueObject)", () => {
    it("treats two phones with same digits as equal regardless of input format", () => {
      const a = Phone.create("(11) 99999-9999");
      const b = Phone.create("11999999999");

      expect(a.equals(b)).toBe(true);
    });

    it("treats different numbers as not equal", () => {
      const a = Phone.create("11999999999");
      const b = Phone.create("11988888888");

      expect(a.equals(b)).toBe(false);
    });
  });
});