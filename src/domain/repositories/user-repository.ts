import type { Repository } from "./repository";
import type { User } from "@/domain/entities/user";
import type { UniqueId } from "@/shared/utils/id";

export interface UserRepository extends Repository<User> {
  findByTenantAndEmail(tenantId: UniqueId, email: string): Promise<User | null>;
}