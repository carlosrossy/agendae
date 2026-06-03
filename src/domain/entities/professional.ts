import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { BusinessHours } from "@/domain/value-objects/business-hours";
import { InvalidProfessionalError } from "@/domain/errors/invalid-professional.error";

export type ProfessionalStatus = "ACTIVE" | "ARCHIVED";

export interface ProfessionalProps extends EntityProps {
  tenantId: UniqueId;
  userId: UniqueId | null;
  name: string;
  bio: string | null;
  businessHours: BusinessHours;
  serviceIds: UniqueId[];
  status: ProfessionalStatus;
}

export interface CreateProfessionalInput {
  tenantId: UniqueId;
  userId?: UniqueId | null;
  name: string;
  bio?: string | null;
  businessHours: BusinessHours;
  serviceIds?: UniqueId[];
}

export class Professional extends Entity<ProfessionalProps> {
  private static readonly MIN_NAME = 2;
  private static readonly MAX_NAME = 100;
  private static readonly MAX_BIO = 500;

  private constructor(props: ProfessionalProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateProfessionalInput): Professional {
    const name = Professional.validateName(input.name);
    const bio = Professional.validateBio(input.bio);

    if (!(input.businessHours instanceof BusinessHours)) {
      throw new InvalidProfessionalError(
        "Professional must be created with a BusinessHours value object.",
      );
    }

    const serviceIds = Professional.dedupeServiceIds(input.serviceIds ?? []);

    const now = new Date();
    return new Professional({
      id: UniqueId.generate(),
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      name,
      bio,
      businessHours: input.businessHours,
      serviceIds,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: ProfessionalProps): Professional {
    return new Professional(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Validators
  // ─────────────────────────────────────────────────────────────

  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new InvalidProfessionalError("Professional name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < Professional.MIN_NAME || trimmed.length > Professional.MAX_NAME) {
      throw new InvalidProfessionalError(
        `Professional name must be between ${Professional.MIN_NAME} and ${Professional.MAX_NAME} characters.`,
      );
    }
    return trimmed;
  }

  private static validateBio(bio: string | null | undefined): string | null {
    if (bio === null || bio === undefined) return null;
    if (typeof bio !== "string") {
      throw new InvalidProfessionalError("Professional bio must be a string.");
    }
    const trimmed = bio.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > Professional.MAX_BIO) {
      throw new InvalidProfessionalError(
        `Professional bio must be at most ${Professional.MAX_BIO} characters.`,
      );
    }
    return trimmed;
  }

  private static dedupeServiceIds(ids: UniqueId[]): UniqueId[] {
    return Array.from(new Set(ids));
  }

  // ─────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────

  public get tenantId(): UniqueId {
    return this.props.tenantId;
  }

  public get userId(): UniqueId | null {
    return this.props.userId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get bio(): string | null {
    return this.props.bio;
  }

  public get businessHours(): BusinessHours {
    return this.props.businessHours;
  }

  public get serviceIds(): ReadonlyArray<UniqueId> {
    return [...this.props.serviceIds];
  }

  public get status(): ProfessionalStatus {
    return this.props.status;
  }

  public get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  public get isArchived(): boolean {
    return this.props.status === "ARCHIVED";
  }

  public get isBookable(): boolean {
    return this.isActive && this.props.serviceIds.length > 0;
  }

  public performsService(serviceId: UniqueId): boolean {
    return this.props.serviceIds.includes(serviceId);
  }

  // ─────────────────────────────────────────────────────────────
  // Mutators
  // ─────────────────────────────────────────────────────────────

  public rename(newName: string): void {
    this.props.name = Professional.validateName(newName);
    this.touch();
  }

  public changeBio(newBio: string | null): void {
    this.props.bio = Professional.validateBio(newBio);
    this.touch();
  }

  public setBusinessHours(newHours: BusinessHours): void {
    if (!(newHours instanceof BusinessHours)) {
      throw new InvalidProfessionalError(
        "setBusinessHours requires a BusinessHours value object.",
      );
    }
    this.props.businessHours = newHours;
    this.touch();
  }

  public linkUser(userId: UniqueId): void {
    if (this.props.userId !== null) {
      throw new InvalidProfessionalError(
        "Professional already has a linked user. Unlink first.",
      );
    }
    this.props.userId = userId;
    this.touch();
  }

  public unlinkUser(): void {
    if (this.props.userId === null) return;
    this.props.userId = null;
    this.touch();
  }


  public addService(serviceId: UniqueId): void {
    if (this.props.serviceIds.includes(serviceId)) return;
    this.props.serviceIds = [...this.props.serviceIds, serviceId];
    this.touch();
  }

  public removeService(serviceId: UniqueId): void {
    const next = this.props.serviceIds.filter((id) => id !== serviceId);
    if (next.length === this.props.serviceIds.length) return;
    this.props.serviceIds = next;
    this.touch();
  }

  public archive(): void {
    if (this.props.status === "ARCHIVED") return;
    this.props.status = "ARCHIVED";
    this.touch();
  }

  public unarchive(): void {
    if (this.props.status === "ACTIVE") return;
    this.props.status = "ACTIVE";
    this.touch();
  }
}