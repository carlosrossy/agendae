import type { Professional } from "@/domain/entities/professional";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient, Prisma } from "@prisma/client";
import { ProfessionalMapper } from "@/infrastructure/database/prisma/mappers/professional.mapper";

export class PrismaProfessionalRepository implements ProfessionalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(professional: Professional): Promise<void> {
    const data = ProfessionalMapper.toPersistence(professional);
    const serviceIds = [...professional.serviceIds];
    // Prisma's Json columns expect InputJsonValue. The mapper's typed
    // BusinessHoursJson shape lacks the index signature that InputJsonObject
    // requires, so it can't be assigned/cast directly — going through unknown
    // is the documented escape hatch for typed JSON at the persistence boundary.
    const row = {
      ...data,
      businessHours: data.businessHours as unknown as Prisma.InputJsonValue,
    };

    // The professional row and its service links must move together, so we
    // wrap them in a transaction. Link sync uses the "replace" strategy:
    // wipe all links for this professional and re-insert the current set.
    // Cheap here because a professional owns very few services, and it's
    // impossible to leave the join table inconsistent.
    await this.prisma.$transaction(async (tx) => {
      await tx.professional.upsert({
        where: { id: data.id },
        create: row,
        update: row,
      });

      await tx.professionalService.deleteMany({
        where: { professionalId: data.id },
      });

      if (serviceIds.length > 0) {
        await tx.professionalService.createMany({
          data: serviceIds.map((serviceId) => ({
            professionalId: data.id,
            serviceId,
            tenantId: data.tenantId,
          })),
        });
      }
    });
  }

  async findById(id: UniqueId): Promise<Professional | null> {
    const row = await this.prisma.professional.findUnique({
      where: { id },
      include: { services: true },
    });
    if (!row) return null;
    return ProfessionalMapper.toEntity(
      row,
      row.services.map((link) => link.serviceId),
    );
  }

  async findByTenant(
    tenantId: UniqueId,
    options?: { includeArchived?: boolean },
  ): Promise<Professional[]> {
    const includeArchived = options?.includeArchived ?? false;
    const rows = await this.prisma.professional.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { status: "ACTIVE" }),
      },
      include: { services: true },
    });
    return rows.map((row) =>
      ProfessionalMapper.toEntity(
        row,
        row.services.map((link) => link.serviceId),
      ),
    );
  }

  async findByUserId(userId: UniqueId): Promise<Professional | null> {
    const row = await this.prisma.professional.findUnique({
      where: { userId },
      include: { services: true },
    });
    if (!row) return null;
    return ProfessionalMapper.toEntity(
      row,
      row.services.map((link) => link.serviceId),
    );
  }

  async delete(id: UniqueId): Promise<void> {
    // professional_services has onDelete: Cascade on professionalId,
    // so removing the professional drops its links automatically.
    await this.prisma.professional.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}
