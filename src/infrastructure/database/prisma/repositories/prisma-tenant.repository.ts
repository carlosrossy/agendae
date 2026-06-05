import type { Tenant } from "@/domain/entities/tenant";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient } from "@prisma/client";
import { TenantMapper } from "@/infrastructure/database/prisma/mappers/tenant.mapper";

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(tenant: Tenant): Promise<void> {
    const data = TenantMapper.toPersistence(tenant);
    await this.prisma.tenant.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: UniqueId): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
    return row ? TenantMapper.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { slug } });
    return row ? TenantMapper.toEntity(row) : null;
  }

  async delete(id: UniqueId): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}