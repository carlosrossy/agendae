import type { User } from "@/domain/entities/user";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryUserRepository implements UserRepository {
  private readonly items = new Map<string, User>();

  public seed(users: User[]): void {
    for (const u of users) this.items.set(u.id, u);
  }

  public list(): User[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async findById(id: UniqueId): Promise<User | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findByTenantAndEmail(
    tenantId: UniqueId,
    email: string,
  ): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const u of this.items.values()) {
      if (u.tenantId === tenantId && u.email.value === normalized) {
        return u;
      }
    }
    return null;
  }
}