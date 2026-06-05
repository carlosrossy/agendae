import type { User as UserRow } from "@prisma/client";
import { User } from "@/domain/entities/user";
import { Email } from "@/domain/value-objects/email";
import { UniqueId } from "@/shared/utils/id";

export const UserMapper = {
  toEntity(row: UserRow): User {
    return User.restore({
      id: UniqueId.from(row.id),
      tenantId: UniqueId.from(row.tenantId),
      name: row.name,
      email: Email.create(row.email),
      passwordHash: row.passwordHash,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: User): {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    passwordHash: string | null;
    role: "OWNER" | "STAFF" | "CUSTOMER";
    status: "ACTIVE" | "INVITED" | "DISABLED";
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      email: entity.email.value,
      passwordHash: entity.passwordHash,
      role: entity.role,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};