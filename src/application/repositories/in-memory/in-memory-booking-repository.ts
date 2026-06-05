import type { Booking } from "@/domain/entities/booking";
import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type { UniqueId } from "@/shared/utils/id";

export class InMemoryBookingRepository implements BookingRepository {
  private readonly items = new Map<string, Booking>();

  public seed(bookings: Booking[]): void {
    for (const b of bookings) this.items.set(b.id, b);
  }

  public list(): Booking[] {
    return Array.from(this.items.values());
  }

  public clear(): void {
    this.items.clear();
  }

  async save(booking: Booking): Promise<void> {
    this.items.set(booking.id, booking);
  }

  async findById(id: UniqueId): Promise<Booking | null> {
    return this.items.get(id) ?? null;
  }

  async delete(id: UniqueId): Promise<void> {
    this.items.delete(id);
  }

  async findByProfessionalInRange(
    professionalId: UniqueId,
    from: Date,
    to: Date,
  ): Promise<Booking[]> {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const result: Booking[] = [];

    for (const b of this.items.values()) {
      if (b.professionalId !== professionalId) continue;

      // Booking overlaps the range if it starts before `to` and ends after `from`.
      const startMs = b.timeSlot.start.getTime();
      const endMs = b.timeSlot.end.getTime();
      if (startMs < toMs && endMs > fromMs) {
        result.push(b);
      }
    }

    return result;
  }
}