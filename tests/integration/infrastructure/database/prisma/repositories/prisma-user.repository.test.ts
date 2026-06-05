import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaUserRepository } from "@/infrastructure/database/prisma/repositories/prisma-user.repository";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { User } from "@/domain/entities/user";
import { Tenant } from "@/domain/entities/tenant";
import {
  prismaTest,
  cleanDatabase,
  disconnectPrismaTest,
} from "../../../../helpers/prisma-test";

describe("PrismaUserRepository (integration)", () => {
  const repository = new PrismaUserRepository(prismaTest);
  const tenantRepository = new PrismaTenantRepository(prismaTest);

  let tenant: Tenant;

  beforeEach(async () => {
    await cleanDatabase();
    // User has a FK to Tenant; create the parent first.
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

  function makeUser(overrides: Partial<{ email: string; name: string }> = {}) {
    return User.create({
      tenantId: tenant.id,
      name: overrides.name ?? "Maria Owner",
      email: overrides.email ?? "owner@estudio.com",
      passwordHash: "hashed-secret",
      role: "OWNER",
    });
  }

  describe("save", () => {
    it("inserts a new user", async () => {
      const user = makeUser();

      await repository.save(user);

      const found = await repository.findById(user.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Maria Owner");
      expect(found?.email.value).toBe("owner@estudio.com");
      expect(found?.role).toBe("OWNER");
    });

    it("updates an existing user", async () => {
      const user = makeUser();
      await repository.save(user);

      user.rename("Maria Renomeada");
      await repository.save(user);

      const found = await repository.findById(user.id);
      expect(found?.name).toBe("Maria Renomeada");
    });
  });

  describe("findByTenantAndEmail", () => {
    it("finds a user by tenant + email", async () => {
      const user = makeUser({ email: "found@estudio.com" });
      await repository.save(user);

      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "found@estudio.com",
      );

      expect(found?.id).toBe(user.id);
    });

    it("normalizes email before querying (trim + lowercase)", async () => {
      const user = makeUser({ email: "casing@estudio.com" });
      await repository.save(user);

      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "  CASING@Estudio.com  ",
      );

      expect(found?.id).toBe(user.id);
    });

    it("returns null when email doesn't exist in the tenant", async () => {
      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "ghost@estudio.com",
      );
      expect(found).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns null when id doesn't exist", async () => {
      const found = await repository.findById(
        "01HQK2X8VBPK4G3D2M7F5W9NXM" as never,
      );
      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the user", async () => {
      const user = makeUser();
      await repository.save(user);

      await repository.delete(user.id);

      const found = await repository.findById(user.id);
      expect(found).toBeNull();
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});
