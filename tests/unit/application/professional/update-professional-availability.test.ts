import { describe, it, expect } from "vitest";
import { UpdateProfessionalAvailabilityUseCase } from "@/application/use-cases/professional/update-professional-availability";

import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";

import { Tenant } from "@/domain/entities/tenant";
import { User } from "@/domain/entities/user";
import { Professional } from "@/domain/entities/professional";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";

import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";
import { InvalidBusinessHoursError } from "@/domain/errors/invalid-business-hours.error";

const makeSetup = () => {
  const userRepo = new InMemoryUserRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const useCase = new UpdateProfessionalAvailabilityUseCase(professionalRepo, userRepo);

  const tenant = Tenant.create({
    name: "Estúdio",
    slug: "estudio",
    email: "a@a.com",
    timezone: "America/Sao_Paulo",
  });

  const owner = User.create({
    tenantId: tenant.id,
    name: "Owner",
    email: "owner@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  userRepo.seed([owner]);

  const professional = Professional.create({
    tenantId: tenant.id,
    name: "Bia",
    businessHours: BusinessHours.create([
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
    ]),
  });
  professionalRepo.seed([professional]);

  return { useCase, professional, owner, tenant, userRepo };
};

describe("UpdateProfessionalAvailabilityUseCase", () => {
  describe("happy path", () => {
    it("replaces the schedule", async () => {
      const { useCase, professional, owner } = makeSetup();

      // Before: only Monday open.
      expect(professional.businessHours.isOpenOn(1)).toBe(true);
      expect(professional.businessHours.isOpenOn(2)).toBe(false);

      const result = await useCase.execute({
        actorUserId: owner.id,
        professionalId: professional.id,
        businessHours: [
          { dayOfWeek: 2, start: "08:00", end: "12:00" }, // Tuesday morning
          { dayOfWeek: 3, start: "14:00", end: "18:00" }, // Wednesday afternoon
        ],
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const hours = result.value.professional.businessHours;
      expect(hours.isOpenOn(1)).toBe(false); // Monday no longer
      expect(hours.isOpenOn(2)).toBe(true);
      expect(hours.isOpenOn(3)).toBe(true);
    });
  });

  describe("authorization", () => {
    it("fails when actor is not OWNER", async () => {
      const { useCase, professional, userRepo, tenant } = makeSetup();

      const staff = User.create({
        tenantId: tenant.id,
        name: "Staff",
        email: "staff@x.com",
        passwordHash: "hashed::pwd",
        role: "STAFF",
      });
      userRepo.seed([staff]);

      const result = await useCase.execute({
        actorUserId: staff.id,
        professionalId: professional.id,
        businessHours: [{ dayOfWeek: 1, start: "09:00", end: "18:00" }],
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });

    it("fails when OWNER is from a different tenant", async () => {
      const { useCase, professional, userRepo } = makeSetup();

      const otherOwner = User.create({
        tenantId: UniqueId.generate(),
        name: "Outro Owner",
        email: "outro@x.com",
        passwordHash: "hashed::pwd",
        role: "OWNER",
      });
      userRepo.seed([otherOwner]);

      const result = await useCase.execute({
        actorUserId: otherOwner.id,
        professionalId: professional.id,
        businessHours: [{ dayOfWeek: 1, start: "09:00", end: "18:00" }],
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });
  });

  describe("not found", () => {
    it("fails when professional doesn't exist", async () => {
      const { useCase, owner } = makeSetup();

      const result = await useCase.execute({
        actorUserId: owner.id,
        professionalId: UniqueId.generate(),
        businessHours: [{ dayOfWeek: 1, start: "09:00", end: "18:00" }],
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ProfessionalNotFoundError);
    });
  });

  describe("domain validation", () => {
    it("propagates InvalidBusinessHoursError for bad schedule", async () => {
      const { useCase, professional, owner } = makeSetup();

      const result = await useCase.execute({
        actorUserId: owner.id,
        professionalId: professional.id,
        businessHours: [
          { dayOfWeek: 1, start: "09:00", end: "12:00" },
          { dayOfWeek: 1, start: "11:00", end: "14:00" }, // overlaps
        ],
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidBusinessHoursError);
    });
  });
});