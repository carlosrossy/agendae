import type { Repository } from "./repository";
import type { Professional } from "@/domain/entities/professional";
import type { UniqueId } from "@/shared/utils/id";

export interface ProfessionalRepository extends Repository<Professional> {
  findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Professional[]>;

  findByUserId(userId: UniqueId): Promise<Professional | null>;
}