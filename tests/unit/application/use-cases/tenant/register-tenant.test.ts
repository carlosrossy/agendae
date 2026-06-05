import { describe, it, expect, beforeEach } from "vitest";
import { RegisterTenantUseCase } from "@/application/use-cases/tenant/register-tenant";
import { InMemoryTenantRepository } from "@/application/repositories/in-memory/in-memory-tenant-repository";
import { InMemoryUserRepository } from "@/application/repositories/in-memory/in-memory-user-repository";
import { InMemoryProfessionalRepository } from "@/application/repositories/in-memory/in-memory-professional-repository";
import { FakePasswordHasher } from "@/application/ports/in-memory/fake-password-hasher";
import { Tenant } from "@/domain/entities/tenant";
import { User } from "@/domain/entities/user";
import { Professional } from "@/domain/entities/professional";
import { SlugAlreadyTakenError } from "@/application/errors/tenant-errors";
import { InvalidTenantError } from "@/domain/errors/invalid-tenant.error";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

describe("RegisterTenantUseCase", () => {
  let tenantRepo: InMemoryTenantRepository;
  let userRepo: InMemoryUserRepository;
  let professionalRepo: InMemoryProfessionalRepository;
  let hasher: FakePasswordHasher;
  let useCase: RegisterTenantUseCase;

  beforeEach(() => {
    tenantRepo = new InMemoryTenantRepository();
    userRepo = new InMemoryUserRepository();
    professionalRepo = new InMemoryProfessionalRepository();
    hasher = new FakePasswordHasher();
    useCase = new RegisterTenantUseCase(tenantRepo, userRepo, professionalRepo, hasher);
  });

  const validInput = () => ({
    tenantName: "Estúdio Maria",
    tenantSlug: "estudio-maria",
    timezone: "America/Sao_Paulo",
    ownerName: "Maria Silva",
    ownerEmail: "maria@estudio.com",
    ownerPassword: "supersecret123",
    isSolo: true,
  });

  describe("happy path — solo professional", () => {
    it("creates tenant, owner user, and linked professional", async () => {
      const result = await useCase.execute(validInput());

      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const { tenant, owner, professional } = result.value;

      expect(tenant).toBeInstanceOf(Tenant);
      expect(tenant.name).toBe("Estúdio Maria");
      expect(tenant.slug).toBe("estudio-maria");

      expect(owner).toBeInstanceOf(User);
      expect(owner.role).toBe("OWNER");
      expect(owner.tenantId).toBe(tenant.id);
      expect(owner.email.value).toBe("maria@estudio.com");

      expect(professional).not.toBeNull();
      expect(professional).toBeInstanceOf(Professional);
      expect(professional?.tenantId).toBe(tenant.id);
      expect(professional?.userId).toBe(owner.id);
      expect(professional?.name).toBe("Maria Silva");
    });

    it("hashes the password (does not store plain text)", async () => {
      const result = await useCase.execute(validInput());
      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const { owner } = result.value;
      expect(owner.passwordHash).not.toBe("supersecret123");
      expect(owner.passwordHash).toBe("hashed::supersecret123");
    });

    it("persists all entities to their repositories", async () => {
      const result = await useCase.execute(validInput());
      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const { tenant, owner, professional } = result.value;

      expect(await tenantRepo.findById(tenant.id)).not.toBeNull();
      expect(await userRepo.findById(owner.id)).not.toBeNull();
      expect(await professionalRepo.findById(professional!.id)).not.toBeNull();
    });

    it("the created professional has default business hours covering weekdays", async () => {
      const result = await useCase.execute(validInput());
      if (!result.isSuccess()) return;
      const { professional } = result.value;

      // Monday should be open.
      expect(professional?.businessHours.isOpenOn(1)).toBe(true);
      // Sunday should be closed.
      expect(professional?.businessHours.isOpenOn(0)).toBe(false);
    });
  });

  describe("happy path — team (NOT solo)", () => {
    it("does NOT create a professional when isSolo=false", async () => {
      const result = await useCase.execute({ ...validInput(), isSolo: false });
      expect(result.isSuccess()).toBe(true);
      if (!result.isSuccess()) return;

      const { tenant, owner, professional } = result.value;

      expect(tenant).toBeInstanceOf(Tenant);
      expect(owner).toBeInstanceOf(User);
      expect(professional).toBeNull();

      // Repository confirms no professional was saved.
      expect(professionalRepo.list()).toHaveLength(0);
    });
  });

  describe("slug uniqueness", () => {
    it("fails when slug is already taken", async () => {
      // Pre-seed an existing tenant with the same slug.
      const existing = Tenant.create({
        name: "Outro",
        slug: "estudio-maria",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([existing]);

      const result = await useCase.execute(validInput());

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(SlugAlreadyTakenError);
    });

    it("does NOT persist anything when slug is taken", async () => {
      const existing = Tenant.create({
        name: "Outro",
        slug: "estudio-maria",
        email: "outro@x.com",
        timezone: "America/Sao_Paulo",
      });
      tenantRepo.seed([existing]);

      await useCase.execute(validInput());

      // Only the pre-seeded tenant should exist.
      expect(tenantRepo.list()).toHaveLength(1);
      expect(userRepo.list()).toHaveLength(0);
      expect(professionalRepo.list()).toHaveLength(0);
    });
  });

  describe("domain validation", () => {
    it("propagates InvalidTenantError for bad slug", async () => {
      const result = await useCase.execute({ ...validInput(), tenantSlug: "Has Spaces!" });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidTenantError);
    });

    it("propagates InvalidEmailError for bad owner email", async () => {
      const result = await useCase.execute({ ...validInput(), ownerEmail: "not-an-email" });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidEmailError);
    });

    it("propagates InvalidTenantError for bad timezone", async () => {
      const result = await useCase.execute({ ...validInput(), timezone: "Mars/Olympus" });

      expect(result.isFailure()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidTenantError);
    });

    it("does NOT persist when domain validation fails", async () => {
      await useCase.execute({ ...validInput(), tenantSlug: "Has Spaces!" });

      expect(tenantRepo.list()).toHaveLength(0);
      expect(userRepo.list()).toHaveLength(0);
      expect(professionalRepo.list()).toHaveLength(0);
    });
  });

  describe("isolation across tenants", () => {
    it("two different tenants can coexist", async () => {
      const r1 = await useCase.execute(validInput());
      const r2 = await useCase.execute({
        ...validInput(),
        tenantName: "Outro Estúdio",
        tenantSlug: "outro-estudio",
        ownerName: "Bia",
        ownerEmail: "bia@outro.com",
        isSolo: false,
      });

      expect(r1.isSuccess()).toBe(true);
      expect(r2.isSuccess()).toBe(true);
      expect(tenantRepo.list()).toHaveLength(2);
      expect(userRepo.list()).toHaveLength(2);
      expect(professionalRepo.list()).toHaveLength(1);
    });
  });
});