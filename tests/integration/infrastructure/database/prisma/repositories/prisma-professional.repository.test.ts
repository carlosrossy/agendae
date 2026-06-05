import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaProfessionalRepository } from "@/infrastructure/database/prisma/repositories/prisma-professional.repository";
import { PrismaServiceRepository } from "@/infrastructure/database/prisma/repositories/prisma-service.repository";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { Professional } from "@/domain/entities/professional";
import { Service } from "@/domain/entities/service";
import { Tenant } from "@/domain/entities/tenant";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import {
  prismaTest,
  cleanDatabase,
  disconnectPrismaTest,
} from "../../../../helpers/prisma-test";

describe("PrismaProfessionalRepository (integration)", () => {
  const repository = new PrismaProfessionalRepository(prismaTest);
  const serviceRepository = new PrismaServiceRepository(prismaTest);
  const tenantRepository = new PrismaTenantRepository(prismaTest);

  let tenant: Tenant;
  let serviceA: Service;
  let serviceB: Service;

  const hours = () =>
    BusinessHours.create([{ dayOfWeek: 1, start: "09:00", end: "18:00" }]);

  beforeEach(async () => {
    await cleanDatabase();
    tenant = Tenant.create({
      name: "Estúdio Maria",
      slug: "estudio-maria",
      email: "maria@x.com",
      timezone: "America/Sao_Paulo",
    });
    await tenantRepository.save(tenant);

    // Services must exist before being linked (FK on professional_services).
    serviceA = Service.create({
      tenantId: tenant.id,
      name: "Corte",
      durationMinutes: 30,
      priceCents: 5000,
    });
    serviceB = Service.create({
      tenantId: tenant.id,
      name: "Barba",
      durationMinutes: 20,
      priceCents: 3000,
    });
    await serviceRepository.save(serviceA);
    await serviceRepository.save(serviceB);
  });

  afterAll(async () => {
    await disconnectPrismaTest();
  });

  function makeProfessional(serviceIds = [serviceA.id]) {
    return Professional.create({
      tenantId: tenant.id,
      name: "Maria Pro",
      businessHours: hours(),
      serviceIds,
    });
  }

  describe("save", () => {
    it("inserts a professional with its service links", async () => {
      const pro = makeProfessional([serviceA.id, serviceB.id]);

      await repository.save(pro);

      const found = await repository.findById(pro.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Maria Pro");
      expect([...(found?.serviceIds ?? [])].sort()).toEqual(
        [serviceA.id, serviceB.id].sort(),
      );
    });

    it("re-syncs service links on update (adds new, drops removed)", async () => {
      const pro = makeProfessional([serviceA.id]);
      await repository.save(pro);

      // Swap: drop A, add B.
      pro.removeService(serviceA.id);
      pro.addService(serviceB.id);
      await repository.save(pro);

      const found = await repository.findById(pro.id);
      expect([...(found?.serviceIds ?? [])]).toEqual([serviceB.id]);

      // The dropped link must be gone from the join table, not orphaned.
      const links = await prismaTest.professionalService.findMany({
        where: { professionalId: pro.id },
      });
      expect(links).toHaveLength(1);
      expect(links[0]?.serviceId).toBe(serviceB.id);
    });

    it("supports a professional with no services", async () => {
      const pro = makeProfessional([]);

      await repository.save(pro);

      const found = await repository.findById(pro.id);
      expect(found?.serviceIds).toHaveLength(0);
    });
  });

  describe("findByTenant", () => {
    it("returns only ACTIVE professionals by default", async () => {
      const active = makeProfessional();
      const archived = makeProfessional();
      archived.archive();
      await repository.save(active);
      await repository.save(archived);

      const result = await repository.findByTenant(tenant.id);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(active.id);
    });

    it("includes archived when asked", async () => {
      const active = makeProfessional();
      const archived = makeProfessional();
      archived.archive();
      await repository.save(active);
      await repository.save(archived);

      const result = await repository.findByTenant(tenant.id, {
        includeArchived: true,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("findByUserId", () => {
    it("finds a professional linked to a user", async () => {
      const userId = tenant.id; // any 26-char ULID-shaped id works for the FK-less lookup
      const pro = Professional.create({
        tenantId: tenant.id,
        userId,
        name: "Solo",
        businessHours: hours(),
      });
      // userId references users(id); create the user row first.
      await prismaTest.user.create({
        data: {
          id: userId,
          tenantId: tenant.id,
          name: "Solo User",
          email: "solo@x.com",
          passwordHash: "h",
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      await repository.save(pro);

      const found = await repository.findByUserId(userId);

      expect(found?.id).toBe(pro.id);
    });

    it("returns null when no professional is linked to the user", async () => {
      const found = await repository.findByUserId(
        "01HQK2X8VBPK4G3D2M7F5W9NXM" as never,
      );
      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the professional and cascades its links", async () => {
      const pro = makeProfessional([serviceA.id, serviceB.id]);
      await repository.save(pro);

      await repository.delete(pro.id);

      const found = await repository.findById(pro.id);
      expect(found).toBeNull();

      const links = await prismaTest.professionalService.findMany({
        where: { professionalId: pro.id },
      });
      expect(links).toHaveLength(0);
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});
