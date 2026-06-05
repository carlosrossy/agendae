import { Service } from "@/domain/entities/service";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";
import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { TenantNotActiveError } from "@/domain/errors/booking-policy.error";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type {
  CreateServiceInput,
  CreateServiceOutput,
} from "./create-service.types";

export class CreateServiceUseCase {
  constructor(
    private readonly serviceRepo: ServiceRepository,
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(input: CreateServiceInput): Promise<CreateServiceOutput> {
    let tenantId: ReturnType<typeof UniqueId.from>;
    try {
      tenantId = UniqueId.from(input.tenantId);
    } catch {
      return failure(new TenantNotFoundError(input.tenantId));
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      return failure(new TenantNotFoundError(input.tenantId));
    }

    if (!tenant.isActive) {
      return failure(new TenantNotActiveError());
    }

    try {
      const service = Service.create({
        tenantId: tenant.id,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        priceCents: input.priceCents,
        requiresPayment: input.requiresPayment ?? false,
      });

      await this.serviceRepo.save(service);

      return success(service);
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }
}