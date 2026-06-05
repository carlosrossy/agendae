import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaServiceRepository } from "@/infrastructure/database/prisma/repositories/prisma-service.repository";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { Service } from "@/domain/entities/service";
import { Tenant } from "@/domain/entities/tenant";
import {
  prismaTest,
  cleanDatabase,
  disconnectPrismaTest,
} from "../../../../helpers/prisma-test";

describe("PrismaServiceRepository (integration)", () => {
  const repository = new PrismaServiceRepository(prismaTest);
  const tenantRepository = new PrismaTenantRepository(prismaTest);

  let tenant: Tenant;

  beforeEach(async () => {
    await cleanDatabase();
    // Service has a FK to Tenant; create the parent first.
    tenant = Tenant.create({
      name: "Estúdio Maria",
      slug: "estudio-maria",
      email: "maria@x.com",
      timezone: "America/Sao_Paulo",
    });
    await tenantRepository.save(tenant);
  });

  afterAll(async () => {
    await disconnectPrismaTest();
  });

  function makeService(overrides: Partial<{ name: string }> = {}) {
    return Service.create({
      tenantId: tenant.id,
      name: overrides.name ?? "Corte de cabelo",
      description: "Corte masculino completo",
      durationMinutes: 30,
      priceCents: 5000,
    });
  }

  describe("save", () => {
    it("inserts a new service", async () => {
      const service = makeService();

      await repository.save(service);

      const found = await repository.findById(service.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Corte de cabelo");
      expect(found?.duration.inMinutes).toBe(30);
      expect(found?.price.cents).toBe(5000);
    });

    it("updates an existing service", async () => {
      const service = makeService();
      await repository.save(service);

      service.rename("Corte premium");
      await repository.save(service);

      const found = await repository.findById(service.id);
      expect(found?.name).toBe("Corte premium");
    });
  });

  describe("findByTenant", () => {
    it("returns only ACTIVE services by default", async () => {
      const active = makeService({ name: "Ativo" });
      const archived = makeService({ name: "Arquivado" });
      archived.archive();
      await repository.save(active);
      await repository.save(archived);

      const result = await repository.findByTenant(tenant.id);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Ativo");
    });

    it("includes archived services when asked", async () => {
      const active = makeService({ name: "Ativo" });
      const archived = makeService({ name: "Arquivado" });
      archived.archive();
      await repository.save(active);
      await repository.save(archived);

      const result = await repository.findByTenant(tenant.id, {
        includeArchived: true,
      });

      expect(result).toHaveLength(2);
    });

    it("does not leak services from another tenant", async () => {
      const other = Tenant.create({
        name: "Outro",
        slug: "outro",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      await tenantRepository.save(other);

      const mine = makeService({ name: "Meu" });
      const theirs = Service.create({
        tenantId: other.id,
        name: "Deles",
        durationMinutes: 30,
        priceCents: 5000,
      });
      await repository.save(mine);
      await repository.save(theirs);

      const result = await repository.findByTenant(tenant.id);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Meu");
    });
  });

  describe("delete", () => {
    it("removes the service", async () => {
      const service = makeService();
      await repository.save(service);

      await repository.delete(service.id);

      const found = await repository.findById(service.id);
      expect(found).toBeNull();
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});
