import type { Booking } from "@/domain/entities/booking";
import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UniqueId } from "@/shared/utils/id";
import type { PrismaClient } from "@prisma/client";
import { BookingMapper } from "@/infrastructure/database/prisma/mappers/booking.mapper";

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(booking: Booking): Promise<void> {
    const data = BookingMapper.toPersistence(booking);
    await this.prisma.booking.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: UniqueId): Promise<Booking | null> {
    const row = await this.prisma.booking.findUnique({ where: { id } });
    return row ? BookingMapper.toEntity(row) : null;
  }

  async findByProfessionalInRange(
    professionalId: UniqueId,
    from: Date,
    to: Date,
  ): Promise<Booking[]> {
    // Overlap test: a booking intersects [from, to) when it starts before `to`
    // and ends after `from`. Status is intentionally NOT filtered here — the
    // BookingPolicy decides which statuses block a slot (cancelled ones don't).
    const rows = await this.prisma.booking.findMany({
      where: {
        professionalId,
        startAt: { lt: to },
        endAt: { gt: from },
      },
    });
    return rows.map((row) => BookingMapper.toEntity(row));
  }

  async delete(id: UniqueId): Promise<void> {
    await this.prisma.booking.delete({ where: { id } }).catch((err) => {
      if (err?.code === "P2025") return;
      throw err;
    });
  }
}
