import { describe, it, expect, beforeEach } from "vitest";
import { CreateServiceUseCase } from "@/application/use-cases/service/create-service";
import { InMemoryServiceRepository } from "@/application/repositories/in-memory/in-memory-service-repository";
import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { Tenant } from "@/domain/entities/tenant";
import { Service } from "@/domain/entities/service";
import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { TenantNotActiveError } from "@/domain/errors/booking-policy.error";
import { InvalidServiceError } from "@/domain/errors/invalid-service.error";
import { InvalidDurationError } from "@/domain/errors/invalid-duration.error";
import { InvalidMoneyError } from "@/domain/errors/invalid-money.error";
import { UniqueId } from "@/shared/utils/id";

describe("CreateServiceUseCase", () => {
  let serviceRepo: InMemoryServiceRepository;
  let tenantRepo: InMemoryTenantRepository;
  let useCase: CreateServiceUseCase;
  let tenant: Tenant;

  beforeEach(() => {
    serviceRepo = new InMemoryServiceRepository();
    tenantRepo = new InMemoryTenantRepository();
    useCase = new CreateServiceUseCase(serviceRepo, tenantRepo);

    tenant = Tenant.create({
      name: "Estúdio Maria",
      slug: "estudio-maria",
      email: "contato@estudio.com",
      timezone: "America/Sao_Paulo",
    });
    tenantRepo.seed([tenant]);
  });

  describe("happy path", () => {
    it("creates a service and persists it", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Corte Masculino",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return; // narrow type for TS

      const service = result.value;
      expect(service).toBeInstanceOf(Service);
      expect(service.name).toBe("Corte Masculino");
      expect(service.duration.inMinutes).toBe(30);
      expect(service.price.cents).toBe(5000);
      expect(service.tenantId).toBe(tenant.id);
      expect(service.isActive).toBe(true);
      expect(service.requiresPayment).toBe(false);
    });

    it("persists the created service in the repository", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Corte Masculino",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const saved = await serviceRepo.findById(result.value.id);
      expect(saved).not.toBeNull();
      expect(saved?.equals(result.value)).toBe(true);
    });

    it("accepts optional description and requiresPayment", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Manicure",
        description: "Manicure completa com esmaltação",
        durationMinutes: 60,
        priceCents: 8000,
        requiresPayment: true,
      });

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;
      expect(result.value.description).toBe("Manicure completa com esmaltação");
      expect(result.value.requiresPayment).toBe(true);
    });
  });

  describe("tenant resolution", () => {
    it("fails with TenantNotFoundError when tenantId is not a valid ULID", async () => {
      const result = await useCase.execute({
        tenantId: "not-a-ulid",
        name: "Corte",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotFoundError);
    });

    it("fails with TenantNotFoundError when tenant doesn't exist", async () => {
      const nonExistentId = UniqueId.generate();

      const result = await useCase.execute({
        tenantId: nonExistentId,
        name: "Corte",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotFoundError);
    });

    it("fails with TenantNotActiveError when tenant is suspended", async () => {
      tenant.suspend();

      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Corte",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(TenantNotActiveError);
    });
  });

  describe("domain validation failures", () => {
    it("propagates InvalidServiceError for bad name", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "",
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidServiceError);
    });

    it("propagates InvalidDurationError for non-positive duration", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Corte",
        durationMinutes: 0,
        priceCents: 5000,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidDurationError);
    });

    it("propagates InvalidMoneyError for negative price", async () => {
      const result = await useCase.execute({
        tenantId: tenant.id,
        name: "Corte",
        durationMinutes: 30,
        priceCents: -100,
      });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidMoneyError);
    });

    it("does NOT persist when domain validation fails", async () => {
      await useCase.execute({
        tenantId: tenant.id,
        name: "", // bad input
        durationMinutes: 30,
        priceCents: 5000,
      });

      expect(serviceRepo.list()).toHaveLength(0);
    });
  });

  describe("multiple tenants — isolation check", () => {
    it("only finds services of the requested tenant", async () => {
      const otherTenant = Tenant.create({
        name: "Outro Estúdio",
        slug: "outro-estudio",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([otherTenant]);

      // Create one service for each tenant.
      await useCase.execute({
        tenantId: tenant.id,
        name: "Corte",
        durationMinutes: 30,
        priceCents: 5000,
      });
      await useCase.execute({
        tenantId: otherTenant.id,
        name: "Manicure",
        durationMinutes: 60,
        priceCents: 8000,
      });

      const mariaServices = await serviceRepo.findByTenant(tenant.id);
      const outroServices = await serviceRepo.findByTenant(otherTenant.id);

      expect(mariaServices).toHaveLength(1);
      expect(mariaServices[0]?.name).toBe("Corte");
      expect(outroServices).toHaveLength(1);
      expect(outroServices[0]?.name).toBe("Manicure");
    });
  });
});