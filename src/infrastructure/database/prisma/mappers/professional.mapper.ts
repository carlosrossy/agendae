import type { Professional as ProfessionalRow } from "@prisma/client";
import { Professional } from "@/domain/entities/professional";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";

interface BusinessHoursJson {
  windows: Array<{
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
  }>;
}

export const ProfessionalMapper = {
  toEntity(row: ProfessionalRow, serviceIds: string[]): Professional {
    const json = row.businessHours as unknown as BusinessHoursJson;
    const businessHours = BusinessHours.restore(json.windows);

    return Professional.restore({
      id: UniqueId.from(row.id),
      tenantId: UniqueId.from(row.tenantId),
      userId: row.userId ? UniqueId.from(row.userId) : null,
      name: row.name,
      bio: row.bio,
      businessHours,
      serviceIds: serviceIds.map((id) => UniqueId.from(id)),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: Professional): {
    id: string;
    tenantId: string;
    userId: string | null;
    name: string;
    bio: string | null;
    businessHours: BusinessHoursJson;
    status: "ACTIVE" | "ARCHIVED";
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      userId: entity.userId,
      name: entity.name,
      bio: entity.bio,
      businessHours: {
        windows: entity.businessHours.listWindows().map((w) => ({
          dayOfWeek: w.dayOfWeek,
          startMinutes: w.startMinutes,
          endMinutes: w.endMinutes,
        })),
      },
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};