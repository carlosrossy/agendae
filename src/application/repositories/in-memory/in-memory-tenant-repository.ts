import type { Tenant } from "@/domain/entities/tenant";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryTenantRepository implements TenantRepository {
  private readonly items = new Map<string, Tenant>();

  public seed(tenants: Tenant[]): void {
    for (const t of tenants) this.items.set(t.id, t);
  }

  public list(): Tenant[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(tenant: Tenant): Promise<void> {
    this.items.set(tenant.id, tenant);
  }

  async findById(id: UniqueId): Promise<Tenant | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    for (const t of this.items.values()) {
      if (t.slug === slug) return t;
    }
    return null;
  }
}