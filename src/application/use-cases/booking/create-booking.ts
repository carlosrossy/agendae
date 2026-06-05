import { Booking } from "@/domain/entities/booking";
import { Customer } from "@/domain/entities/customer";
import { TimeSlot } from "@/domain/value-objects/time-slot";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";
import { BookingPolicy } from "@/domain/services/booking-policy";

import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";

import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { CustomerRepository } from "@/domain/repositories/customer-repository";
import type { BookingRepository } from "@/domain/repositories/booking-repository";

import type {
  CreateBookingInput,
  CreateBookingOutput,
} from "./create-booking.types";

export class CreateBookingUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly bookingRepo: BookingRepository,
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingOutput> {
    try {
      const now = input.now ?? new Date();

      const tenant = await this.tenantRepo.findBySlug(input.tenantSlug);
      if (!tenant) {
        return failure(new TenantNotFoundError(input.tenantSlug));
      }

      let professionalId: UniqueId;
      let serviceId: UniqueId;
      try {
        professionalId = UniqueId.from(input.professionalId);
        serviceId = UniqueId.from(input.serviceId);
      } catch {
        return failure(new ProfessionalNotFoundError(input.professionalId));
      }

      const professional = await this.professionalRepo.findById(professionalId);
      if (!professional) {
        return failure(new ProfessionalNotFoundError(input.professionalId));
      }

      const service = await this.serviceRepo.findById(serviceId);
      if (!service) {
        return failure(new ServiceNotFoundError(input.serviceId));
      }

      if (professional.tenantId !== tenant.id || service.tenantId !== tenant.id) {
        return failure(new ProfessionalNotFoundError(input.professionalId));
      }

      const timeSlot = TimeSlot.fromDuration(input.startAt, service.duration);

      const dayStart = new Date(
        Date.UTC(
          input.startAt.getUTCFullYear(),
          input.startAt.getUTCMonth(),
          input.startAt.getUTCDate(),
          0, 0, 0, 0,
        ),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const existingBookings = await this.bookingRepo.findByProfessionalInRange(
        professional.id,
        dayStart,
        dayEnd,
      );

      const policyResult = BookingPolicy.canBeScheduled({
        tenant,
        professional,
        serviceId: service.id,
        timeSlot,
        existingBookings,
        now,
      });
      if (policyResult.isFailure()) {
        return failure(policyResult.value);
      }

      const normalizedEmail = input.customerEmail.trim().toLowerCase();
      let customer = await this.customerRepo.findByTenantAndEmail(
        tenant.id,
        normalizedEmail,
      );

      if (!customer) {
        customer = Customer.create({
          tenantId: tenant.id,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone ?? null,
        });
      }

      const booking = Booking.create({
        tenantId: tenant.id,
        customerId: customer.id,
        professionalId: professional.id,
        serviceId: service.id,
        timeSlot,
        price: service.price,
        notes: input.notes ?? null,
        now,
      });

      await this.customerRepo.save(customer);
      await this.bookingRepo.save(booking);

      const domainEvents = booking.pullDomainEvents();

      return success({ booking, customer, domainEvents });
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }
}