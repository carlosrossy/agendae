import { Professional } from "@/domain/entities/professional";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";

import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";

import type { Result } from "@/shared/utils/result";
import type { ApplicationError } from "@/application/errors/application-error";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type {
  CreateProfessionalInput,
  CreateProfessionalOutput,
} from "./create-professional.types";

export class CreateProfessionalUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userRepo: UserRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly serviceRepo: ServiceRepository,
  ) {}

  async execute(input: CreateProfessionalInput): Promise<CreateProfessionalOutput> {
    try {
      let tenantId: UniqueId;
      try {
        tenantId = UniqueId.from(input.tenantId);
      } catch {
        return failure(new TenantNotFoundError(input.tenantId));
      }

      const tenant = await this.tenantRepo.findById(tenantId);
      if (!tenant) return failure(new TenantNotFoundError(input.tenantId));

      const authResult = await this.authorizeOwner(input.actorUserId, tenant.id);
      if (authResult.isFailure()) {
        return failure(authResult.value);
      }

      const validatedServiceIds: UniqueId[] = [];
      if (input.serviceIds?.length) {
        for (const rawId of input.serviceIds) {
          let serviceId: UniqueId;
          try {
            serviceId = UniqueId.from(rawId);
          } catch {
            return failure(new ServiceNotFoundError(rawId));
          }

          const service = await this.serviceRepo.findById(serviceId);
          if (!service || service.tenantId !== tenant.id) {
            return failure(new ServiceNotFoundError(rawId));
          }

          validatedServiceIds.push(serviceId);
        }
      }

      const businessHours = BusinessHours.create(
        input.businessHours.map((w) => ({
          dayOfWeek: w.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          start: w.start,
          end: w.end,
        })),
      );

      const professional = Professional.create({
        tenantId: tenant.id,
        name: input.name,
        bio: input.bio ?? null,
        businessHours,
        serviceIds: validatedServiceIds,
      });

      await this.professionalRepo.save(professional);

      return success({ professional });
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }

  private async authorizeOwner(
    actorUserId: string,
    tenantId: UniqueId,
  ): Promise<Result<ApplicationError, true>> {
    let userId: UniqueId;
    try {
      userId = UniqueId.from(actorUserId);
    } catch {
      return failure(new UnauthorizedBookingActionError("Invalid actor id."));
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      return failure(new UnauthorizedBookingActionError("Actor user not found."));
    }
    if (user.role !== "OWNER" || user.tenantId !== tenantId) {
      return failure(
        new UnauthorizedBookingActionError("Only OWNERs of this tenant can perform this action."),
      );
    }
    return success(true);
  }
}