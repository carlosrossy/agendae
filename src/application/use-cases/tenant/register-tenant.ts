import { Tenant } from "@/domain/entities/tenant";
import { User } from "@/domain/entities/user";
import { Professional } from "@/domain/entities/professional";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { success, failure } from "@/shared/utils/result";
import { SlugAlreadyTakenError } from "@/application/errors/tenant-errors";
import { EmailAlreadyTakenError } from "@/application/errors/user-errors";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import type {
  RegisterTenantInput,
  RegisterTenantOutput,
} from "./register-tenant.types";

export class RegisterTenantUseCase {
  private static readonly DEFAULT_SOLO_HOURS = BusinessHours.create([
    { dayOfWeek: 1, start: "09:00", end: "18:00" },
    { dayOfWeek: 2, start: "09:00", end: "18:00" },
    { dayOfWeek: 3, start: "09:00", end: "18:00" },
    { dayOfWeek: 4, start: "09:00", end: "18:00" },
    { dayOfWeek: 5, start: "09:00", end: "18:00" },
    { dayOfWeek: 6, start: "09:00", end: "13:00" },
  ]);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userRepo: UserRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterTenantInput): Promise<RegisterTenantOutput> {
    try {
      const existingTenant = await this.tenantRepo.findBySlug(input.tenantSlug);
      if (existingTenant) {
        return failure(new SlugAlreadyTakenError(input.tenantSlug));
      }

      const tenant = Tenant.create({
        name: input.tenantName,
        slug: input.tenantSlug,
        email: input.ownerEmail,
        timezone: input.timezone,
      });

      const existingUser = await this.userRepo.findByTenantAndEmail(
        tenant.id,
        input.ownerEmail,
      );
      if (existingUser) {
        return failure(new EmailAlreadyTakenError(input.ownerEmail));
      }

      const passwordHash = await this.hasher.hash(input.ownerPassword);

      const owner = User.create({
        tenantId: tenant.id,
        name: input.ownerName,
        email: input.ownerEmail,
        passwordHash,
        role: "OWNER",
      });

      let professional: Professional | null = null;
      if (input.isSolo) {
        professional = Professional.create({
          tenantId: tenant.id,
          userId: owner.id,
          name: input.ownerName,
          businessHours: RegisterTenantUseCase.DEFAULT_SOLO_HOURS,
        });
      }

      await this.tenantRepo.save(tenant);
      await this.userRepo.save(owner);
      if (professional) {
        await this.professionalRepo.save(professional);
      }

      return success({ tenant, owner, professional });
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }
}