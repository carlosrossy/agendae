import type { Customer } from "@/domain/entities/customer";
import type { CustomerRepository } from "@/domain/repositories/customer-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly items = new Map<string, Customer>();

  public seed(customers: Customer[]): void {
    for (const c of customers) this.items.set(c.id, c);
  }

  public list(): Customer[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(customer: Customer): Promise<void> {
    this.items.set(customer.id, customer);
  }

  async findById(id: UniqueId): Promise<Customer | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findByTenantAndEmail(
    tenantId: UniqueId,
    email: string,
  ): Promise<Customer | null> {
    const normalized = email.trim().toLowerCase();
    for (const c of this.items.values()) {
      if (c.tenantId === tenantId && c.email.value === normalized) {
        return c;
      }
    }
    return null;
  }
}