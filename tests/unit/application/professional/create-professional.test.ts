import { describe, it, expect, beforeEach } from "vitest";
import { CreateProfessionalUseCase } from "@/application/use-cases/professional/create-professional";

import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";
import { InMemoryServiceRepository } from "@/application/repositories/in-memory/in-memory-service-repository";

import { Tenant } from "@/domain/entities/tenant";
import { User } from "@/domain/entities/user";
import { Service } from "@/domain/entities/service";
import { Professional } from "@/domain/entities/professional";
import { UniqueId } from "@/shared/utils/id";

import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";

const makeSetup = () => {
  const tenantRepo = new InMemoryTenantRepository();
  const userRepo = new InMemoryUserRepository();
  const professionalRepo = new InMemoryProfessionalRepository();
  const serviceRepo = new InMemoryServiceRepository();

  const useCase = new CreateProfessionalUseCase(
    tenantRepo, userRepo, professionalRepo, serviceRepo,
  );

  const tenant = Tenant.create({
    name: "Estúdio Maria",
    slug: "estudio-maria",
    email: "maria@x.com",
    timezone: "America/Sao_Paulo",
  });
  tenantRepo.seed([tenant]);

  const owner = User.create({
    tenantId: tenant.id,
    name: "Maria Owner",
    email: "owner@x.com",
    passwordHash: "hashed::pwd",
    role: "OWNER",
  });
  userRepo.seed([owner]);

  const service = Service.create({
    tenantId: tenant.id,
    name: "Corte",
    durationMinutes: 30,
    priceCents: 5000,
  });
  serviceRepo.seed([service]);

  return { useCase, tenantRepo, userRepo, professionalRepo, serviceRepo, tenant, owner, service };
};

const validInput = (overrides: Record<string, unknown> = {}) => ({
  actorUserId: "", // filled in tests
  tenantId: "",
  name: "Bia",
  businessHours: [
    { dayOfWeek: 1, start: "09:00", end: "18:00" },
    { dayOfWeek: 6, start: "09:00", end: "13:00" },
  ],
  serviceIds: [] as string[],
  ...overrides,
});

describe("CreateProfessionalUseCase", () => {
  describe("happy path", () => {
    it("creates a professional", async () => {
      const { useCase, tenant, owner, professionalRepo } = makeSetup();

      const result = await useCase.execute(
        validInput({ actorUserId: owner.id, tenantId: tenant.id }),
      );

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      expect(result.value.professional).toBeInstanceOf(Professional);
      expect(result.value.professional.name).toBe("Bia");
      expect(result.value.professional.businessHours.isOpenOn(1)).toBe(true);
      expect(result.value.professional.businessHours.isOpenOn(0)).toBe(false); // Sunday
      expect(professionalRepo.list()).toHaveLength(1);
    });

    it("creates with linked services", async () => {
      const { useCase, tenant, owner, service } = makeSetup();

      const result = await useCase.execute(
        validInput({
          actorUserId: owner.id,
          tenantId: tenant.id,
          serviceIds: [service.id],
        }),
      );

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;
      expect(result.value.professional.serviceIds).toEqual([service.id]);
      expect(result.value.professional.isBookable).toBe(true);
    });
  });

  describe("authorization", () => {
    it("fails when actor is not OWNER", async () => {
      const { useCase, tenant, userRepo } = makeSetup();

      const staff = User.create({
        tenantId: tenant.id,
        name: "Staff",
        email: "staff@x.com",
        passwordHash: "hashed::pwd",
        role: "STAFF",
      });
      userRepo.seed([staff]);

      const result = await useCase.execute(
        validInput({ actorUserId: staff.id, tenantId: tenant.id }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });

    it("fails when actor is OWNER of a different tenant", async () => {
      const { useCase, tenant, userRepo, tenantRepo } = makeSetup();

      const otherTenant = Tenant.create({
        name: "Outro",
        slug: "outro",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([otherTenant]);

      const otherOwner = User.create({
        tenantId: otherTenant.id,
        name: "Outro Owner",
        email: "other-owner@x.com",
        passwordHash: "hashed::pwd",
        role: "OWNER",
      });
      userRepo.seed([otherOwner]);

      const result = await useCase.execute(
        validInput({ actorUserId: otherOwner.id, tenantId: tenant.id }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });

    it("fails when actor user doesn't exist", async () => {
      const { useCase, tenant } = makeSetup();

      const result = await useCase.execute(
        validInput({ actorUserId: UniqueId.generate(), tenantId: tenant.id }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(UnauthorizedBookingActionError);
    });
  });

  describe("tenant resolution", () => {
    it("fails when tenant doesn't exist", async () => {
      const { useCase, owner } = makeSetup();

      const result = await useCase.execute(
        validInput({ actorUserId: owner.id, tenantId: UniqueId.generate() }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotFoundError);
    });
  });

  describe("service validation", () => {
    it("fails when serviceId doesn't exist", async () => {
      const { useCase, tenant, owner } = makeSetup();

      const result = await useCase.execute(
        validInput({
          actorUserId: owner.id,
          tenantId: tenant.id,
          serviceIds: [UniqueId.generate()],
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ServiceNotFoundError);
    });

    it("fails when service belongs to a different tenant (cross-tenant guard)", async () => {
      const { useCase, tenant, owner, serviceRepo, tenantRepo } = makeSetup();

      const otherTenant = Tenant.create({
        name: "Outro",
        slug: "outro",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([otherTenant]);

      const otherService = Service.create({
        tenantId: otherTenant.id,
        name: "Outro Serviço",
        durationMinutes: 30,
        priceCents: 5000,
      });
      serviceRepo.seed([otherService]);

      const result = await useCase.execute(
        validInput({
          actorUserId: owner.id,
          tenantId: tenant.id,
          serviceIds: [otherService.id], // service from OTHER tenant
        }),
      );

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(ServiceNotFoundError);
    });
  });
});