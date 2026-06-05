import type { Tenant as TenantRow } from "@prisma/client";
import { Tenant } from "@/domain/entities/tenant";
import { Duration } from "@/domain/value-objects/duration";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { UniqueId } from "@/shared/utils/id";

export const TenantMapper = {
  toEntity(row: TenantRow): Tenant {
    return Tenant.restore({
      id: UniqueId.from(row.id),
      name: row.name,
      slug: row.slug,
      email: Email.create(row.email),
      phone: row.phone ? Phone.create(row.phone) : null,
      timezone: row.timezone,
      minimumLeadTime: Duration.fromMinutes(row.minimumLeadTimeMinutes),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: Tenant): {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone: string | null;
    timezone: string;
    minimumLeadTimeMinutes: number;
    status: "ACTIVE" | "SUSPENDED";
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      email: entity.email.value,
      phone: entity.phone?.digits ?? null,
      timezone: entity.timezone,
      minimumLeadTimeMinutes: entity.minimumLeadTime.inMinutes,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};