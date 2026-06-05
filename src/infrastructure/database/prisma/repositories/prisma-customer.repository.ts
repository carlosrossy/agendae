import type { Customer } from "@/domain/entities/customer";
import type { CustomerRepository } from "@/domain/repositories/customer-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient } from "@prisma/client";
import { CustomerMapper } from "@/infrastructure/database/prisma/mappers/customer.mapper";

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(customer: Customer): Promise<void> {
    const data = CustomerMapper.toPersistence(customer);
    await this.prisma.customer.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: UniqueId): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    return row ? CustomerMapper.toEntity(row) : null;
  }

  async findByTenantAndEmail(
    tenantId: UniqueId,
    email: string,
  ): Promise<Customer | null> {
    const normalized = email.trim().toLowerCase();
    const row = await this.prisma.customer.findUnique({
      where: { customer_tenant_email_unique: { tenantId, email: normalized } },
    });
    return row ? CustomerMapper.toEntity(row) : null;
  }

  async delete(id: UniqueId): Promise<void> {
    await this.prisma.customer.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}
