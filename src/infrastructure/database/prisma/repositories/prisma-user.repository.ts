import type { User } from "@/domain/entities/user";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient } from "@prisma/client";
import { UserMapper } from "@/infrastructure/database/prisma/mappers/user.mapper";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);
    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: UniqueId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? UserMapper.toEntity(row) : null;
  }

  async findByTenantAndEmail(
    tenantId: UniqueId,
    email: string,
  ): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const row = await this.prisma.user.findUnique({
      where: { tenant_email_unique: { tenantId, email: normalized } },
    });
    return row ? UserMapper.toEntity(row) : null;
  }

  async delete(id: UniqueId): Promise<void> {
    await this.prisma.user.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}
