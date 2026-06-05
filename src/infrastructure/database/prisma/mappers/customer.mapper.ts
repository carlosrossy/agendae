import type { Customer as CustomerRow } from "@prisma/client";
import { Customer } from "@/domain/entities/customer";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { UniqueId } from "@/shared/utils/id";

export const CustomerMapper = {
  toEntity(row: CustomerRow): Customer {
    return Customer.restore({
      id: UniqueId.from(row.id),
      tenantId: UniqueId.from(row.tenantId),
      userId: row.userId ? UniqueId.from(row.userId) : null,
      name: row.name,
      email: Email.create(row.email),
      phone: row.phone ? Phone.create(row.phone) : null,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: Customer): {
    id: string;
    tenantId: string;
    userId: string | null;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      userId: entity.userId,
      name: entity.name,
      email: entity.email.value,
      phone: entity.phone?.digits ?? null,
      notes: entity.notes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};