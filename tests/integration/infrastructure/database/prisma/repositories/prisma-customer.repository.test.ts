import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaCustomerRepository } from "@/infrastructure/database/prisma/repositories/prisma-customer.repository";
import { PrismaTenantRepository } from "@/infrastructure/database/prisma/repositories/prisma-tenant.repository";
import { Customer } from "@/domain/entities/customer";
import { Tenant } from "@/domain/entities/tenant";
import {
  prismaTest,
  cleanDatabase,
  disconnectPrismaTest,
} from "../../../../helpers/prisma-test";

describe("PrismaCustomerRepository (integration)", () => {
  const repository = new PrismaCustomerRepository(prismaTest);
  const tenantRepository = new PrismaTenantRepository(prismaTest);

  let tenant: Tenant;

  beforeEach(async () => {
    await cleanDatabase();
    // Customer has a FK to Tenant; create the parent first.
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

  function makeCustomer(
    overrides: Partial<{ email: string; name: string }> = {},
  ) {
    return Customer.create({
      tenantId: tenant.id,
      name: overrides.name ?? "João Cliente",
      email: overrides.email ?? "joao@cliente.com",
      phone: "11999998888",
    });
  }

  describe("save", () => {
    it("inserts a new customer", async () => {
      const customer = makeCustomer();

      await repository.save(customer);

      const found = await repository.findById(customer.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("João Cliente");
      expect(found?.email.value).toBe("joao@cliente.com");
      expect(found?.phone?.digits).toBe("11999998888");
    });

    it("updates an existing customer", async () => {
      const customer = makeCustomer();
      await repository.save(customer);

      customer.rename("João Renomeado");
      await repository.save(customer);

      const found = await repository.findById(customer.id);
      expect(found?.name).toBe("João Renomeado");
    });
  });

  describe("findByTenantAndEmail", () => {
    it("finds a customer by tenant + email", async () => {
      const customer = makeCustomer({ email: "found@cliente.com" });
      await repository.save(customer);

      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "found@cliente.com",
      );

      expect(found?.id).toBe(customer.id);
    });

    it("normalizes email before querying (trim + lowercase)", async () => {
      const customer = makeCustomer({ email: "casing@cliente.com" });
      await repository.save(customer);

      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "  CASING@Cliente.com  ",
      );

      expect(found?.id).toBe(customer.id);
    });

    it("does not leak a customer from another tenant", async () => {
      const other = Tenant.create({
        name: "Outro",
        slug: "outro",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      await tenantRepository.save(other);
      const theirs = Customer.create({
        tenantId: other.id,
        name: "Cliente Deles",
        email: "shared@cliente.com",
      });
      await repository.save(theirs);

      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "shared@cliente.com",
      );

      expect(found).toBeNull();
    });

    it("returns null when email doesn't exist", async () => {
      const found = await repository.findByTenantAndEmail(
        tenant.id,
        "ghost@cliente.com",
      );
      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the customer", async () => {
      const customer = makeCustomer();
      await repository.save(customer);

      await repository.delete(customer.id);

      const found = await repository.findById(customer.id);
      expect(found).toBeNull();
    });

    it("is idempotent (deleting non-existent is OK)", async () => {
      await expect(
        repository.delete("01HQK2X8VBPK4G3D2M7F5W9NXM" as never),
      ).resolves.not.toThrow();
    });
  });
});
