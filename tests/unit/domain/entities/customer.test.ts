import { describe, it, expect } from "vitest";
import { Customer } from "@/domain/entities/customer";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { UniqueId } from "@/shared/utils/id";
import { InvalidCustomerError } from "@/domain/errors/invalid-customer.error";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

const tenantId = UniqueId.generate();
const userId = UniqueId.generate();

const validInput = () => ({
  tenantId,
  name: "João da Silva",
  email: "joao@example.com",
});

describe("Customer", () => {
  describe("create — happy path", () => {
    it("creates an anonymous customer (no userId)", () => {
      const c = Customer.create(validInput());

      expect(c.name).toBe("João da Silva");
      expect(c.email).toBeInstanceOf(Email);
      expect(c.email.value).toBe("joao@example.com");
      expect(c.userId).toBeNull();
      expect(c.isRegistered).toBe(false);
      expect(c.phone).toBeNull();
      expect(c.notes).toBeNull();
      expect(c.tenantId).toBe(tenantId);
    });

    it("creates a registered customer when userId provided", () => {
      const c = Customer.create({ ...validInput(), userId });
      expect(c.userId).toBe(userId);
      expect(c.isRegistered).toBe(true);
    });

    it("accepts optional phone", () => {
      const c = Customer.create({ ...validInput(), phone: "(11) 99999-9999" });
      expect(c.phone).toBeInstanceOf(Phone);
      expect(c.phone?.digits).toBe("11999999999");
    });

    it("accepts optional notes", () => {
      const c = Customer.create({ ...validInput(), notes: "Alérgico a esmalte com formol" });
      expect(c.notes).toBe("Alérgico a esmalte com formol");
    });

    it("trims name and notes", () => {
      const c = Customer.create({
        ...validInput(),
        name: "  João  ",
        notes: "  Anotação  ",
      });
      expect(c.name).toBe("João");
      expect(c.notes).toBe("Anotação");
    });

    it("treats empty/whitespace notes as null", () => {
      expect(Customer.create({ ...validInput(), notes: "" }).notes).toBeNull();
      expect(Customer.create({ ...validInput(), notes: "   " }).notes).toBeNull();
      expect(Customer.create({ ...validInput(), notes: null }).notes).toBeNull();
    });
  });

  describe("create — validation", () => {
    it.each(["", " ", "a"])("rejects name too short: %s", (name) => {
      expect(() => Customer.create({ ...validInput(), name })).toThrow(InvalidCustomerError);
    });

    it("rejects name too long", () => {
      const longName = "a".repeat(101);
      expect(() => Customer.create({ ...validInput(), name: longName })).toThrow(
        InvalidCustomerError,
      );
    });

    it("rejects notes too long", () => {
      const longNotes = "a".repeat(1001);
      expect(() => Customer.create({ ...validInput(), notes: longNotes })).toThrow(
        InvalidCustomerError,
      );
    });

    it("propagates Email validation errors", () => {
      expect(() => Customer.create({ ...validInput(), email: "not-an-email" })).toThrow(
        InvalidEmailError,
      );
    });

    it("propagates Phone validation errors", () => {
      expect(() =>
        Customer.create({ ...validInput(), phone: "not-a-phone" }),
      ).toThrow();
    });
  });

  describe("mutators", () => {
    it("rename validates", () => {
      const c = Customer.create(validInput());
      c.rename("Outro Nome");
      expect(c.name).toBe("Outro Nome");

      expect(() => c.rename("a")).toThrow(InvalidCustomerError);
    });

    it("changeEmail validates via Email VO", () => {
      const c = Customer.create(validInput());
      c.changeEmail("novo@example.com");
      expect(c.email.value).toBe("novo@example.com");

      expect(() => c.changeEmail("bad")).toThrow(InvalidEmailError);
    });

    it("changePhone accepts null to remove", () => {
      const c = Customer.create({ ...validInput(), phone: "(11) 99999-9999" });
      expect(c.phone).not.toBeNull();

      c.changePhone(null);
      expect(c.phone).toBeNull();
    });

    it("changeNotes accepts null to clear", () => {
      const c = Customer.create({ ...validInput(), notes: "Algo" });
      c.changeNotes(null);
      expect(c.notes).toBeNull();
    });
  });

  describe("linkUser / unlinkUser", () => {
    it("linkUser sets userId on an anonymous customer", () => {
      const c = Customer.create(validInput());
      expect(c.isRegistered).toBe(false);

      c.linkUser(userId);
      expect(c.userId).toBe(userId);
      expect(c.isRegistered).toBe(true);
    });

    it("linkUser fails when already linked", () => {
      const c = Customer.create({ ...validInput(), userId });
      const otherUserId = UniqueId.generate();

      expect(() => c.linkUser(otherUserId)).toThrow(InvalidCustomerError);
    });

    it("unlinkUser clears userId", () => {
      const c = Customer.create({ ...validInput(), userId });
      c.unlinkUser();
      expect(c.userId).toBeNull();
      expect(c.isRegistered).toBe(false);
    });

    it("unlinkUser when not linked is no-op", async () => {
      const c = Customer.create(validInput());
      const t = c.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      c.unlinkUser();

      expect(c.updatedAt.getTime()).toBe(t);
    });
  });

  describe("equality (inherited)", () => {
    it("two customers with same id are equal", () => {
      const a = Customer.create(validInput());
      const b = Customer.restore({
        id: a.id,
        tenantId: a.tenantId,
        userId: null,
        name: "Different",
        email: Email.create("other@example.com"),
        phone: null,
        notes: null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });

    it("two customers with different ids are not equal", () => {
      const a = Customer.create(validInput());
      const b = Customer.create(validInput());
      expect(a.equals(b)).toBe(false);
    });
  });
});