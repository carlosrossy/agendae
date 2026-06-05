import type { Service as ServiceRow } from "@prisma/client";
import { Service } from "@/domain/entities/service";
import { Duration } from "@/domain/value-objects/duration";
import { Money } from "@/domain/value-objects/money";
import { UniqueId } from "@/shared/utils/id";

export const ServiceMapper = {
  toEntity(row: ServiceRow): Service {
    return Service.restore({
      id: UniqueId.from(row.id),
      tenantId: UniqueId.from(row.tenantId),
      name: row.name,
      description: row.description,
      duration: Duration.fromMinutes(row.durationMinutes),
      price: Money.fromCents(row.priceCents),
      requiresPayment: row.requiresPayment,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: Service): {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    requiresPayment: boolean;
    status: "ACTIVE" | "ARCHIVED";
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description,
      durationMinutes: entity.duration.inMinutes,
      priceCents: entity.price.cents,
      requiresPayment: entity.requiresPayment,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};