import type { UniqueId } from "@/shared/utils/id";

export interface Repository<TEntity> {
  save(entity: TEntity): Promise<void>;
  findById(id: UniqueId): Promise<TEntity | null>;
  delete(id: UniqueId): Promise<void>;
}