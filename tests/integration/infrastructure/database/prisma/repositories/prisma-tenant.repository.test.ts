import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { Tenant } from "@/domain/entities/tenant";
import { prismaTest, cleanDatabase, disconnectPrismaTest } from "../../../../helpers/prisma-test";

describe("PrismaTenantRepository (integration)", () => {
  const repository = new PrismaTenantRepository(prismaTest);

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrismaTest();
  });

  describe("save", () => {
    it("inserts a new tenant", async () => {
      const tenant = Tenant.create({
        name: "Estúdio Maria",
        slug: "estudio-maria",
        email: "maria@x.com",
        timezone: "America/Sao_Paulo",
      });

      await repository.save(tenant);

      const found = await repository.findById(tenant.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Estúdio Maria");
      expect(found?.slug).toBe("estudio-maria");
    });

    it("updates an existing tenant", async () => {
      const tenant = Tenant.create({
        name: "Original",
        slug: "original",
        email: "a@a.com",
        timezone: "America/Sao_Paulo",
      });

      await repository.save(tenant);
      tenant.rename("Renomeado");
      await repository.save(tenant);

      const found = await repository.findById(tenant.id);
      expect(found?.name).toBe("Renomeado");
    });
  });

  describe("findBySlug", () => {
    it("finds a tenant by slug", async () => {
      const tenant = Tenant.create({
        name: "Estúdio",
        slug: "estudio-unico",
        email: "a@a.com",
        timezone: "America/Sao_Paulo",
      });
      await repository.save(tenant);

      const found = await repository.findBySlug("estudio-unico");

      expect(found).not.toBeNull();
      expect(found?.id).toBe(tenant.id);
    });

    it("returns null when slug doesn't exist", async () => {
      const found = await repository.findBySlug("ghost");
      expect(found).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns null when id doesn't exist", async () => {
      const found = await repository.findById("01HQK2X8VBPK4G3D2M7F5W9NXM" as never);
      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the tenant", async () => {
      const tenant = Tenant.create({
        name: "Pra Deletar",
        slug: "pra-deletar",
        email: "a@a.com",
        timezone: "America/Sao_Paulo",
      });
      await repository.save(tenant);

      await repository.delete(tenant.id);

      const found = await repository.findById(tenant.id);
      expect(found).toBeNull();
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});