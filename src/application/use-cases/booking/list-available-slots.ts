import { TimeSlot } from "@/domain/value-objects/time-slot";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";
import { TenantNotFoundError } from "@/application/errors/tenant-errors";
import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { ServiceNotFoundError } from "@/application/errors/service-errors";
import {
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotBookableError,
  TenantNotActiveError,
} from "@/domain/errors/booking-policy.error";
import type { TenantRepository } from "@/domain/repositories/tenant-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type { ServiceRepository } from "@/domain/repositories/service-repository";
import type { BookingRepository } from "@/domain/repositories/booking-repository";
import type {
  ListAvailableSlotsInput,
  ListAvailableSlotsOutput,
} from "./list-available-slots.types";

export class ListAvailableSlotsUseCase {
  private static readonly DEFAULT_GRANULARITY = 30;

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly bookingRepo: BookingRepository,
  ) {}

  async execute(input: ListAvailableSlotsInput): Promise<ListAvailableSlotsOutput> {
    const now = input.now ?? new Date();
    const granularity = input.granularityMinutes ?? ListAvailableSlotsUseCase.DEFAULT_GRANULARITY;

    if (!Number.isInteger(granularity) || granularity <= 0) {
      return failure(
        new Error("granularityMinutes must be a positive integer.") as never,
      );
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

    const tenant = await this.tenantRepo.findById(professional.tenantId);
    if (!tenant) {
      return failure(new TenantNotFoundError(professional.tenantId));
    }
    if (!tenant.isActive) {
      return failure(new TenantNotActiveError());
    }
    if (!professional.isBookable) {
      return failure(new ProfessionalNotBookableError());
    }
    if (!professional.performsService(service.id)) {
      return failure(new ProfessionalDoesNotPerformServiceError());
    }

    const dayStart = new Date(
      Date.UTC(
        input.date.getUTCFullYear(),
        input.date.getUTCMonth(),
        input.date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.bookingRepo.findByProfessionalInRange(
      professional.id,
      dayStart,
      dayEnd,
    );

    const dayOfWeek = dayStart.getUTCDay();
    const windows = professional.businessHours
      .listWindows()
      .filter((w) => w.dayOfWeek === dayOfWeek);

    const durationMs = service.duration.inMinutes * 60_000;
    const stepMs = granularity * 60_000;
    const leadMs = tenant.minimumLeadTime.inMinutes * 60_000;
    const minStartMs = now.getTime() + leadMs;

    const result: TimeSlot[] = [];

    for (const w of windows) {
      const windowStartMs = dayStart.getTime() + w.startMinutes * 60_000;
      const windowEndMs = dayStart.getTime() + w.endMinutes * 60_000;

      for (
        let candidateStartMs = windowStartMs;
        candidateStartMs + durationMs <= windowEndMs;
        candidateStartMs += stepMs
      ) {
        const candidateEndMs = candidateStartMs + durationMs;

        if (candidateStartMs < minStartMs) continue;

        const slot = TimeSlot.create(
          new Date(candidateStartMs),
          new Date(candidateEndMs),
        );

        const conflicts = existing.some(
          (b) => !b.isTerminal && b.timeSlot.overlaps(slot),
        );
        if (conflicts) continue;

        result.push(slot);
      }
    }

    result.sort((a, b) => a.start.getTime() - b.start.getTime());

    return success({ slots: result });
  }
}