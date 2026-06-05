import type { Repository } from "./repository";
import type { Tenant } from "@/domain/entities/tenant";

export interface TenantRepository extends Repository<Tenant> {
  findBySlug(slug: string): Promise<Tenant | null>;
}