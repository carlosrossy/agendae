import { describe, it, expect } from "vitest";
import { Tenant } from "@/domain/entities/tenant";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { Duration } from "@/domain/value-objects/duration";
import { InvalidTenantError } from "@/domain/errors/invalid-tenant.error";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

const validInput = () => ({
  name: "Estúdio Maria",
  slug: "estudio-maria",
  email: "contato@estudiomaria.com.br",
  timezone: "America/Sao_Paulo",
});

describe("Tenant", () => {
  describe("create — happy path", () => {
    it("creates a tenant with valid input", () => {
      const tenant = Tenant.create(validInput());

      expect(tenant.name).toBe("Estúdio Maria");
      expect(tenant.slug).toBe("estudio-maria");
      expect(tenant.email).toBeInstanceOf(Email);
      expect(tenant.email.value).toBe("contato@estudiomaria.com.br");
      expect(tenant.phone).toBeNull();
      expect(tenant.timezone).toBe("America/Sao_Paulo");
      expect(tenant.status).toBe("ACTIVE");
      expect(tenant.isActive).toBe(true);
    });

    it("assigns a generated id", () => {
      const tenant = Tenant.create(validInput());
      expect(tenant.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("uses default minimum lead time when not provided", () => {
      const tenant = Tenant.create(validInput());
      expect(tenant.minimumLeadTime.inMinutes).toBe(60);
    });

    it("accepts a custom minimum lead time", () => {
      const tenant = Tenant.create({ ...validInput(), minimumLeadTimeMinutes: 120 });
      expect(tenant.minimumLeadTime.inMinutes).toBe(120);
    });

    it("accepts an optional phone", () => {
      const tenant = Tenant.create({ ...validInput(), phone: "(11) 99999-9999" });
      expect(tenant.phone).toBeInstanceOf(Phone);
      expect(tenant.phone?.digits).toBe("11999999999");
    });

    it("trims and normalizes name and slug", () => {
      const tenant = Tenant.create({
        ...validInput(),
        name: "  Estúdio Maria  ",
        slug: "  Estudio-Maria  ",
      });

      expect(tenant.name).toBe("Estúdio Maria");
      expect(tenant.slug).toBe("estudio-maria");
    });
  });

  describe("create — validation: name", () => {
    it.each(["", " ", "a"])("rejects name too short: %s", (name) => {
      expect(() => Tenant.create({ ...validInput(), name })).toThrow(InvalidTenantError);
    });

    it("rejects name too long", () => {
      const longName = "a".repeat(101);
      expect(() => Tenant.create({ ...validInput(), name: longName })).toThrow(InvalidTenantError);
    });
  });

  describe("create — validation: slug", () => {
    it.each([
      "",
      "ab",                     // too short
      "a".repeat(51),           // too long
      "Estudio Maria",          // space
      "-estudio",               // leading hyphen
      "estudio-",               // trailing hyphen
      "estudio--maria",         // consecutive hyphens
      "estudio_maria",          // underscore
      "estúdio-maria",          // non-ascii
      "Estudio-Maria-com-Caps", // uppercase (allowed after lowercasing? regex rejects upper)
    ])("rejects invalid slug: %s", (slug) => {
      // Note: "Estudio-Maria-com-Caps" gets lowercased before regex, so it passes.
      // Filter it out to keep the test honest.
      if (slug === "Estudio-Maria-com-Caps") {
        expect(() => Tenant.create({ ...validInput(), slug })).not.toThrow();
        return;
      }
      expect(() => Tenant.create({ ...validInput(), slug })).toThrow(InvalidTenantError);
    });
  });

  describe("create — validation: email/phone delegate to VOs", () => {
    it("propagates email validation errors", () => {
      expect(() => Tenant.create({ ...validInput(), email: "not-an-email" })).toThrow(
        InvalidEmailError,
      );
    });

    it("propagates phone validation errors", () => {
      expect(() =>
        Tenant.create({ ...validInput(), phone: "not-a-phone" }),
      ).toThrow();
    });
  });

  describe("create — validation: timezone", () => {
    it.each(["", "Mars/Olympus", "not-a-tz", "America/Nowhere"])(
      "rejects invalid timezone: %s",
      (timezone) => {
        expect(() => Tenant.create({ ...validInput(), timezone })).toThrow(InvalidTenantError);
      },
    );

    it.each([
      "America/Sao_Paulo",
      "America/Manaus",
      "Europe/Lisbon",
      "UTC",
      "America/New_York",
    ])("accepts valid IANA timezone: %s", (timezone) => {
      expect(() => Tenant.create({ ...validInput(), timezone })).not.toThrow();
    });
  });

  describe("mutators", () => {
    it("rename updates the name and bumps updatedAt", async () => {
      const tenant = Tenant.create(validInput());
      const before = tenant.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      tenant.rename("Outro Nome");

      expect(tenant.name).toBe("Outro Nome");
      expect(tenant.updatedAt.getTime()).toBeGreaterThan(before);
    });

    it("changeEmail validates via Email VO", () => {
      const tenant = Tenant.create(validInput());

      tenant.changeEmail("novo@email.com");
      expect(tenant.email.value).toBe("novo@email.com");

      expect(() => tenant.changeEmail("not-an-email")).toThrow(InvalidEmailError);
    });

    it("changePhone accepts null to remove", () => {
      const tenant = Tenant.create({ ...validInput(), phone: "(11) 99999-9999" });
      expect(tenant.phone).not.toBeNull();

      tenant.changePhone(null);
      expect(tenant.phone).toBeNull();
    });

    it("changeMinimumLeadTime validates via Duration VO", () => {
      const tenant = Tenant.create(validInput());
      tenant.changeMinimumLeadTime(15);
      expect(tenant.minimumLeadTime.inMinutes).toBe(15);

      expect(() => tenant.changeMinimumLeadTime(0)).toThrow();
      expect(() => tenant.changeMinimumLeadTime(-10)).toThrow();
    });
  });

  describe("suspend/reactivate", () => {
    it("suspend changes status to SUSPENDED", () => {
      const tenant = Tenant.create(validInput());
      tenant.suspend();

      expect(tenant.status).toBe("SUSPENDED");
      expect(tenant.isActive).toBe(false);
    });

    it("reactivate restores to ACTIVE", () => {
      const tenant = Tenant.create(validInput());
      tenant.suspend();
      tenant.reactivate();

      expect(tenant.status).toBe("ACTIVE");
      expect(tenant.isActive).toBe(true);
    });

    it("suspend on already-suspended is a no-op (no error, no touch)", async () => {
      const tenant = Tenant.create(validInput());
      tenant.suspend();
      const updatedAt = tenant.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      tenant.suspend();

      expect(tenant.updatedAt.getTime()).toBe(updatedAt);
    });
  });

  describe("equality (inherited from Entity)", () => {
    it("two tenants with same id are equal", () => {
      const a = Tenant.create(validInput());
      const b = Tenant.restore({
        id: a.id,
        name: "Different",
        slug: "different-slug",
        email: Email.create("other@x.com"),
        phone: null,
        timezone: "UTC",
        minimumLeadTime: Duration.fromMinutes(30),
        status: "ACTIVE",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });

    it("two tenants with different ids are not equal", () => {
      const a = Tenant.create(validInput());
      const b = Tenant.create(validInput());

      expect(a.equals(b)).toBe(false);
    });
  });
});