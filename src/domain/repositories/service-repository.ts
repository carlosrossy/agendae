import type { Repository } from "./repository";
import type { Service } from "@/domain/entities/service";
import type { UniqueId } from "@/shared/utils/id";

export interface ServiceRepository extends Repository<Service> {
  findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Service[]>;
}
