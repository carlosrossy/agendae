import type { Service } from "@/domain/entities/service";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient } from "@prisma/client";
import { ServiceMapper } from "@/infrastructure/database/prisma/mappers/service.mapper";

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(service: Service): Promise<void> {
    const data = ServiceMapper.toPersistence(service);
    await this.prisma.service.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: UniqueId): Promise<Service | null> {
    const row = await this.prisma.service.findUnique({ where: { id } });
    return row ? ServiceMapper.toEntity(row) : null;
  }

  async findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Service[]> {
    const includeArchived = options?.includeArchived ?? false;
    const rows = await this.prisma.service.findMany({
      where: {
        tenantId,
        // When archived ones are excluded, only ACTIVE rows come back.
        ...(includeArchived ? {} : { status: "ACTIVE" }),
      },
    });
    return rows.map((row) => ServiceMapper.toEntity(row));
  }

  async delete(id: UniqueId): Promise<void> {
    await this.prisma.service.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}
