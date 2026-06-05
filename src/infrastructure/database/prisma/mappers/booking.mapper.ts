import type { Booking as BookingRow } from "@prisma/client";
import { Booking } from "@/domain/entities/booking";
import { Money } from "@/domain/value-objects/money";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { UniqueId } from "@/shared/utils/id";

export const BookingMapper = {
  toEntity(row: BookingRow): Booking {
    return Booking.restore({
      id: UniqueId.from(row.id),
      tenantId: UniqueId.from(row.tenantId),
      customerId: UniqueId.from(row.customerId),
      professionalId: UniqueId.from(row.professionalId),
      serviceId: UniqueId.from(row.serviceId),
      timeSlot: TimeSlot.create(row.startAt, row.endAt),
      price: Money.fromCents(row.priceCents),
      status: row.status,
      cancellationReason: row.cancellationReason,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(entity: Booking): {
    id: string;
    tenantId: string;
    customerId: string;
    professionalId: string;
    serviceId: string;
    startAt: Date;
    endAt: Date;
    priceCents: number;
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
    cancellationReason: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      customerId: entity.customerId,
      professionalId: entity.professionalId,
      serviceId: entity.serviceId,
      startAt: entity.timeSlot.start,
      endAt: entity.timeSlot.end,
      priceCents: entity.price.cents,
      status: entity.status,
      cancellationReason: entity.cancellationReason,
      notes: entity.notes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};