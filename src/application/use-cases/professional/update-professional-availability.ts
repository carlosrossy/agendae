import { BusinessHours } from "@/domain/value-objects/business-hours";
import { UniqueId } from "@/shared/utils/id";
import { success, failure } from "@/shared/utils/result";

import { ProfessionalNotFoundError } from "@/application/errors/professional-errors";
import { UnauthorizedBookingActionError } from "@/application/errors/booking-errors";

import type { Result } from "@/shared/utils/result";
import type { ApplicationError } from "@/application/errors/application-error";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { ProfessionalRepository } from "@/domain/repositories/professional-repository";
import type {
  UpdateProfessionalAvailabilityInput,
  UpdateProfessionalAvailabilityOutput,
} from "./update-professional-availability.types";

export class UpdateProfessionalAvailabilityUseCase {
  constructor(
    private readonly professionalRepo: ProfessionalRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(
    input: UpdateProfessionalAvailabilityInput,
  ): Promise<UpdateProfessionalAvailabilityOutput> {
    try {
      let professionalId: UniqueId;
      try {
        professionalId = UniqueId.from(input.professionalId);
      } catch {
        return failure(new ProfessionalNotFoundError(input.professionalId));
      }

      const professional = await this.professionalRepo.findById(professionalId);
      if (!professional) {
        return failure(new ProfessionalNotFoundError(input.professionalId));
      }

      const authResult = await this.authorizeOwner(input.actorUserId, professional.tenantId);
      if (authResult.isFailure()) {
        return failure(authResult.value);
      }

      const newHours = BusinessHours.create(
        input.businessHours.map((w) => ({
          dayOfWeek: w.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          start: w.start,
          end: w.end,
        })),
      );

      professional.setBusinessHours(newHours);

      await this.professionalRepo.save(professional);

      return success({ professional });
    } catch (err) {
      if (err instanceof Error) {
        return failure(err as never);
      }
      throw err;
    }
  }

  private async authorizeOwner(
    actorUserId: string,
    tenantId: UniqueId,
  ): Promise<Result<ApplicationError, true>> {
    let userId: UniqueId;
    try {
      userId = UniqueId.from(actorUserId);
    } catch {
      return failure(new UnauthorizedBookingActionError("Invalid actor id."));
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      return failure(new UnauthorizedBookingActionError("Actor user not found."));
    }
    if (user.role !== "OWNER" || user.tenantId !== tenantId) {
      return failure(
        new UnauthorizedBookingActionError("Only OWNERs of this tenant can perform this action."),
      );
    }
    return success(true);
  }
}