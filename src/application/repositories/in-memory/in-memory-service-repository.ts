import type { Service } from "@/domain/entities/service";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryServiceRepository implements ServiceRepository {
  private readonly items = new Map<string, Service>();

  public seed(services: Service[]): void {
    for (const s of services) this.items.set(s.id, s);
  }

  public list(): Service[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(service: Service): Promise<void> {
    this.items.set(service.id, service);
  }

  async findById(id: UniqueId): Promise<Service | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Service[]> {
    const includeArchived = options?.includeArchived ?? false;
    const result: Service[] = [];
    for (const s of this.items.values()) {
      if (s.tenantId !== tenantId) continue;
      if (!includeArchived && s.isArchived) continue;
      result.push(s);
    }
    return result;
  }
}