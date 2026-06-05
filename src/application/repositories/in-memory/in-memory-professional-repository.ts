import type { Professional } from "@/domain/entities/professional";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryProfessionalRepository implements ProfessionalRepository {
  private readonly items = new Map<string, Professional>();

  public seed(professionals: Professional[]): void {
    for (const p of professionals) this.items.set(p.id, p);
  }

  public list(): Professional[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(professional: Professional): Promise<void> {
    this.items.set(professional.id, professional);
  }

  async findById(id: UniqueId): Promise<Professional | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Professional[]> {
    const includeArchived = options?.includeArchived ?? false;
    const result: Professional[] = [];
    for (const p of this.items.values()) {
      if (p.tenantId !== tenantId) continue;
      if (!includeArchived && p.isArchived) continue;
      result.push(p);
    }
    return result;
  }

  async findByUserId(userId: UniqueId): Promise<Professional | null> {
    for (const p of this.items.values()) {
      if (p.userId === userId) return p;
    }
    return null;
  }
}