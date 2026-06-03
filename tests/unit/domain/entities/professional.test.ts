import { describe, it, expect } from "vitest";
import { Professional } from "@/domain/entities/professional";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";
import { InvalidProfessionalError } from "@/domain/errors/invalid-professional.error";

const tenantId = UniqueId.generate();
const serviceId1 = UniqueId.generate();
const serviceId2 = UniqueId.generate();
const userId = UniqueId.generate();

const validHours = () =>
  BusinessHours.create([
    { dayOfWeek: 1, start: "09:00", end: "18:00" },
    { dayOfWeek: 6, start: "09:00", end: "13:00" },
  ]);

const validInput = () => ({
  tenantId,
  name: "Maria Silva",
  bio: "Esteticista há 10 anos",
  businessHours: validHours(),
});

describe("Professional", () => {
  describe("create — happy path", () => {
    it("creates a professional with valid input", () => {
      const p = Professional.create(validInput());

      expect(p.name).toBe("Maria Silva");
      expect(p.bio).toBe("Esteticista há 10 anos");
      expect(p.tenantId).toBe(tenantId);
      expect(p.userId).toBeNull();
      expect(p.serviceIds).toEqual([]);
      expect(p.businessHours).toBeInstanceOf(BusinessHours);
      expect(p.status).toBe("ACTIVE");
      expect(p.isActive).toBe(true);
      expect(p.isBookable).toBe(false); // no services yet!
    });

    it("creates with linked user when provided", () => {
      const p = Professional.create({ ...validInput(), userId });
      expect(p.userId).toBe(userId);
    });

    it("creates with serviceIds when provided", () => {
      const p = Professional.create({
        ...validInput(),
        serviceIds: [serviceId1, serviceId2],
      });

      expect(p.serviceIds).toHaveLength(2);
      expect(p.serviceIds).toContain(serviceId1);
      expect(p.serviceIds).toContain(serviceId2);
      expect(p.isBookable).toBe(true);
    });

    it("dedupes serviceIds on create", () => {
      const p = Professional.create({
        ...validInput(),
        serviceIds: [serviceId1, serviceId1, serviceId2],
      });

      expect(p.serviceIds).toHaveLength(2);
    });

    it("trims name and bio", () => {
      const p = Professional.create({
        ...validInput(),
        name: "  Maria  ",
        bio: "  Bio aqui  ",
      });
      expect(p.name).toBe("Maria");
      expect(p.bio).toBe("Bio aqui");
    });

    it("treats empty/whitespace bio as null", () => {
      expect(Professional.create({ ...validInput(), bio: "" }).bio).toBeNull();
      expect(Professional.create({ ...validInput(), bio: "   " }).bio).toBeNull();
      expect(Professional.create({ ...validInput(), bio: null }).bio).toBeNull();
    });
  });

  describe("create — validation", () => {
    it.each(["", " ", "a"])("rejects name too short: %s", (name) => {
      expect(() => Professional.create({ ...validInput(), name })).toThrow(InvalidProfessionalError);
    });

    it("rejects name too long", () => {
      const longName = "a".repeat(101);
      expect(() => Professional.create({ ...validInput(), name: longName })).toThrow(
        InvalidProfessionalError,
      );
    });

    it("rejects bio too long", () => {
      const longBio = "a".repeat(501);
      expect(() => Professional.create({ ...validInput(), bio: longBio })).toThrow(
        InvalidProfessionalError,
      );
    });

    it("rejects when businessHours is not a BusinessHours instance", () => {
      expect(() =>
        Professional.create({
          ...validInput(),
          // @ts-expect-error — testing runtime validation
          businessHours: { dayOfWeek: 1 },
        }),
      ).toThrow(InvalidProfessionalError);
    });
  });

  describe("isBookable", () => {
    it("is false when ACTIVE but no services", () => {
      const p = Professional.create(validInput());
      expect(p.isBookable).toBe(false);
    });

    it("is true when ACTIVE and has services", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      expect(p.isBookable).toBe(true);
    });

    it("is false when ARCHIVED, even with services", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      p.archive();
      expect(p.isBookable).toBe(false);
    });
  });

  describe("performsService", () => {
    it("returns true for linked service", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      expect(p.performsService(serviceId1)).toBe(true);
    });

    it("returns false for unlinked service", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      expect(p.performsService(serviceId2)).toBe(false);
    });
  });

  describe("addService / removeService", () => {
    it("addService adds a new service", () => {
      const p = Professional.create(validInput());
      p.addService(serviceId1);
      expect(p.serviceIds).toEqual([serviceId1]);
    });

    it("addService is idempotent (adding same twice is no-op)", async () => {
      const p = Professional.create(validInput());
      p.addService(serviceId1);
      const t = p.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      p.addService(serviceId1);

      expect(p.serviceIds).toHaveLength(1);
      expect(p.updatedAt.getTime()).toBe(t); // no touch
    });

    it("removeService removes the service", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1, serviceId2] });
      p.removeService(serviceId1);
      expect(p.serviceIds).toEqual([serviceId2]);
    });

    it("removeService is idempotent (removing absent is no-op)", async () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      const t = p.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      p.removeService(serviceId2); // not present

      expect(p.serviceIds).toEqual([serviceId1]);
      expect(p.updatedAt.getTime()).toBe(t);
    });

    it("serviceIds getter returns a copy (mutating doesn't affect entity)", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      const list = p.serviceIds as UniqueId[];
      (list as UniqueId[]).push(serviceId2);

      expect(p.serviceIds).toHaveLength(1);
    });
  });

  describe("linkUser / unlinkUser", () => {
    it("linkUser sets userId", () => {
      const p = Professional.create(validInput());
      p.linkUser(userId);
      expect(p.userId).toBe(userId);
    });

    it("linkUser fails if already linked", () => {
      const p = Professional.create({ ...validInput(), userId });
      const otherUserId = UniqueId.generate();
      expect(() => p.linkUser(otherUserId)).toThrow(InvalidProfessionalError);
    });

    it("unlinkUser sets userId to null", () => {
      const p = Professional.create({ ...validInput(), userId });
      p.unlinkUser();
      expect(p.userId).toBeNull();
    });

    it("unlinkUser when not linked is no-op", async () => {
      const p = Professional.create(validInput()); // null userId
      const t = p.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 2));
      p.unlinkUser();

      expect(p.updatedAt.getTime()).toBe(t);
    });
  });

  describe("setBusinessHours", () => {
    it("replaces the schedule", () => {
      const p = Professional.create(validInput());
      const newHours = BusinessHours.create([
        { dayOfWeek: 2, start: "08:00", end: "12:00" },
      ]);

      p.setBusinessHours(newHours);

      expect(p.businessHours).toBe(newHours);
    });

    it("rejects non-BusinessHours input", () => {
      const p = Professional.create(validInput());
      expect(() =>
        // @ts-expect-error — testing runtime validation
        p.setBusinessHours({ windows: [] }),
      ).toThrow(InvalidProfessionalError);
    });
  });

  describe("rename / changeBio", () => {
    it("rename validates", () => {
      const p = Professional.create(validInput());
      p.rename("Outro Nome");
      expect(p.name).toBe("Outro Nome");

      expect(() => p.rename("a")).toThrow(InvalidProfessionalError);
    });

    it("changeBio accepts null", () => {
      const p = Professional.create(validInput());
      p.changeBio(null);
      expect(p.bio).toBeNull();
    });
  });

  describe("archive / unarchive", () => {
    it("archive sets status to ARCHIVED", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      p.archive();

      expect(p.status).toBe("ARCHIVED");
      expect(p.isBookable).toBe(false);
    });

    it("unarchive restores to ACTIVE", () => {
      const p = Professional.create({ ...validInput(), serviceIds: [serviceId1] });
      p.archive();
      p.unarchive();

      expect(p.status).toBe("ACTIVE");
      expect(p.isBookable).toBe(true);
    });
  });

  describe("equality (inherited)", () => {
    it("two professionals with same id are equal", () => {
      const a = Professional.create(validInput());
      const b = Professional.restore({
        id: a.id,
        tenantId: a.tenantId,
        userId: null,
        name: "Different",
        bio: null,
        businessHours: validHours(),
        serviceIds: [],
        status: "ACTIVE",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });

      expect(a.equals(b)).toBe(true);
    });
  });
});