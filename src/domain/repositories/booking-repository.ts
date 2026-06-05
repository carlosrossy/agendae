import type { Repository } from "./repository";
import type { Booking } from "@/domain/entities/booking";
import type { UniqueId } from "@/shared/utils/id";

export interface BookingRepository extends Repository<Booking> {
  findByProfessionalInRange(
    professionalId: UniqueId,
    from: Date,
    to: Date,
  ): Promise<Booking[]>;
}