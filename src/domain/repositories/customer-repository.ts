import type { Repository } from "./repository";
import type { Customer } from "@/domain/entities/customer";
import type { UniqueId } from "@/shared/utils/id";

export interface CustomerRepository extends Repository<Customer> {
  findByTenantAndEmail(tenantId: UniqueId, email: string): Promise<Customer | null>;
}