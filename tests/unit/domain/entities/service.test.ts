import { describe, it, expect } from "vitest";
import { Service } from "@/domain/entities/service";
import { Duration } from "@/domain/value-objects/duration";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";
import { InvalidServiceError } from "@/domain/errors/invalid-service.error";
import { InvalidDurationError } from "@/domain/errors/invalid-duration.error";
import { InvalidMoneyError } from "@/domain/errors/invalid-money.error";

const tenantId = UniqueId.generate();

const validInput = () => ({
  tenantId,
  name: "Corte Masculino",
  description: "Corte completo com lavagem e finalização",
  durationMinutes: 30,
  priceCents: 5000,
});

describe("Service", () => {
  describe("create — happy path", () => {
    it("creates a service with valid input", () => {
      const s = Service.create(validInput());

      expect(s.name).toBe("Corte Masculino");
      expect(s.description).toBe("Corte completo com lavagem e finalização");
      expect(s.duration).toBeInstanceOf(Duration);
      expect(s.duration.inMinutes).toBe(30);
      expect(s.price).toBeInstanceOf(Money);
      expect(s.price.cents).toBe(5000);
      expect(s.requiresPayment).toBe(false);
      expect(s.status).toBe("ACTIVE");
      expect(s.isActive).toBe(true);
      expect(s.isBookable).toBe(true);
      expect(s.tenantId).toBe(tenantId);
    });

    it("assigns a generated id", () => {
      const s = Service.create(validInput());
      expect(s.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("accepts null description", () => {
      const s = Service.create({ ...validInput(), description: null });
      expect(s.description).toBeNull();
    });

    it("treats empty description string as null", () => {
      const s = Service.create({ ...validInput(), description: "" });
      expect(s.description).toBeNull();
    });

    it("treats whitespace-only description as null", () => {
      const s = Service.create({ ...validInput(), description: "   " });
      expect(s.description).toBeNull();
    });

    it("trims description whitespace", () => {
      const s = Service.create({ ...validInput(), description: "  Hello  " });
      expect(s.description).toBe("Hello");
    });

    it("can be created with requiresPayment=true", () => {
      const s = Service.create({ ...validInput(), requiresPayment: true });
      expect(s.requiresPayment).toBe(true);
    });
  });

  describe("create — validation: name", () => {
    it.each(["", " ", "a"])("rejects name too short: %s", (name) => {
      expect(() => Service.create({ ...validInput(), name })).toThrow(InvalidServiceError);
    });

    it("rejects name too long", () => {
      const longName = "a".repeat(101);
      expect(() => Service.create({ ...validInput(), name: longName })).toThrow(InvalidServiceError);
    });

    it("trims name", () => {
      const s = Service.create({ ...validInput(), name: "  Corte  " });
      expect(s.name).toBe("Corte");
    });
  });

  describe("create — validation: description", () => {
    it("rejects description too long", () => {
      const longDescription = "a".repeat(501);
      expect(() =>
        Service.create({ ...validInput(), description: longDescription }),
      ).toThrow(InvalidServiceError);
    });
  });

  describe("create — validation delegates to VOs", () => {
    it("propagates Duration errors", () => {
      expect(() =>
        Service.create({ ...validInput(), durationMinutes: 0 }),
      ).toThrow(InvalidDurationError);

      expect(() =>
        Service.create({ ...validInput(), durationMinutes: -10 }),
      ).toThrow(InvalidDurationError);
    });

    it("propagates Money errors", () => {
      expect(() =>
        Service.create({ ...validInput(), priceCents: -100 }),
      ).toThrow(InvalidMoneyError);

      expect(() =>
        Service.create({ ...validInput(), priceCents: 1.5 }),
      ).toThrow(InvalidMoneyError);
    });

    it("accepts zero price", () => {
      const s = Service.create({ ...validInput(), priceCents: 0 });
      expect(s.price.cents).toBe(0);
      expect(s.price.isZero()).toBe(true);
    });
  });

  describe("mutators", () => {
    it("rename validates", () => {
      const s = Service.create(validInput());
      s.rename("Outro Nome");
      expect(s.name).toBe("Outro Nome");

      expect(() => s.rename("a")).toThrow(InvalidServiceError);
    });

    it("changeDescription accepts null", () => {
      const s = Service.create(validInput());
      s.changeDescription(null);
      expect(s.description).toBeNull();
    });

    it("changeDuration validates via Duration VO", () => {
      const s = Service.create(validInput());
      s.changeDuration(60);
      expect(s.duration.inMinutes).toBe(60);

      expect(() => s.changeDuration(0)).toThrow(InvalidDurationError);
    });

    it("changePrice validates via Money VO", () => {
      const s = Service.create(validInput());
      s.changePrice(7500);
      expect(s.price.cents).toBe(7500);

      expect(() => s.changePrice(-1)).toThrow(InvalidMoneyError);
    });

    it("setRequiresPayment toggles flag", () => {
      const s = Service.create(validInput());
      expect(s.requiresPayment).toBe(false);

      s.setRequiresPayment(true);
      expect(s.requiresPayment).toBe(true);

      s.setRequiresPayment(false);
      expect(s.requiresPayment).toBe(false);
    });

    it("setRequiresPayment with same value is no-op", async () => {
      const s = Service.create(validInput());
      const t = s.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      s.setRequiresPayment(false);

      expect(s.updatedAt.getTime()).toBe(t);
    });
  });

  describe("archive / unarchive", () => {
    it("archive changes status to ARCHIVED", () => {
      const s = Service.create(validInput());
      s.archive();

      expect(s.status).toBe("ARCHIVED");
      expect(s.isArchived).toBe(true);
      expect(s.isActive).toBe(false);
      expect(s.isBookable).toBe(false);
    });

    it("unarchive restores to ACTIVE", () => {
      const s = Service.create(validInput());
      s.archive();
      s.unarchive();

      expect(s.status).toBe("ACTIVE");
      expect(s.isBookable).toBe(true);
    });

    it("archive on already-ARCHIVED is no-op", async () => {
      const s = Service.create(validInput());
      s.archive();
      const t = s.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      s.archive();

      expect(s.updatedAt.getTime()).toBe(t);
    });
  });

  describe("equality (inherited)", () => {
    it("two services with same id are equal", () => {
      const a = Service.create(validInput());
      const b = Service.restore({
        id: a.id,
        tenantId: a.tenantId,
        name: "Different",
        description: null,
        duration: Duration.fromMinutes(15),
        price: Money.fromCents(100),
        requiresPayment: false,
        status: "ACTIVE",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });

    it("two services with different ids are not equal", () => {
      const a = Service.create(validInput());
      const b = Service.create(validInput());

      expect(a.equals(b)).toBe(false);
    });
  });
});