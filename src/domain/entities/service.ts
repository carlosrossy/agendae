import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { Duration } from "@/domain/value-objects/duration";
import { Money } from "@/domain/value-objects/money";
import { InvalidServiceError } from "@/domain/errors/invalid-service.error";

export type ServiceStatus = "ACTIVE" | "ARCHIVED";

export interface ServiceProps extends EntityProps {
  tenantId: UniqueId;
  name: string;
  description: string | null;
  duration: Duration;
  price: Money;
  requiresPayment: boolean;
  status: ServiceStatus;
}

export interface CreateServiceInput {
  tenantId: UniqueId;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  requiresPayment?: boolean;
}

export class Service extends Entity<ServiceProps> {
  private static readonly MIN_NAME = 2;
  private static readonly MAX_NAME = 100;
  private static readonly MAX_DESCRIPTION = 500;

  private constructor(props: ServiceProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateServiceInput): Service {
    const name = Service.validateName(input.name);
    const description = Service.validateDescription(input.description);
    const duration = Duration.fromMinutes(input.durationMinutes);
    const price = Money.fromCents(input.priceCents);

    const now = new Date();
    return new Service({
      id: UniqueId.generate(),
      tenantId: input.tenantId,
      name,
      description,
      duration,
      price,
      requiresPayment: input.requiresPayment ?? false,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: ServiceProps): Service {
    return new Service(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Validators
  // ─────────────────────────────────────────────────────────────

  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new InvalidServiceError("Service name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < Service.MIN_NAME || trimmed.length > Service.MAX_NAME) {
      throw new InvalidServiceError(
        `Service name must be between ${Service.MIN_NAME} and ${Service.MAX_NAME} characters.`,
      );
    }
    return trimmed;
  }

  private static validateDescription(description: string | null | undefined): string | null {
    if (description === null || description === undefined) return null;
    if (typeof description !== "string") {
      throw new InvalidServiceError("Service description must be a string.");
    }
    const trimmed = description.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > Service.MAX_DESCRIPTION) {
      throw new InvalidServiceError(
        `Service description must be at most ${Service.MAX_DESCRIPTION} characters.`,
      );
    }
    return trimmed;
  }

  // ─────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────

  public get tenantId(): UniqueId {
    return this.props.tenantId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get description(): string | null {
    return this.props.description;
  }

  public get duration(): Duration {
    return this.props.duration;
  }

  public get price(): Money {
    return this.props.price;
  }

  public get requiresPayment(): boolean {
    return this.props.requiresPayment;
  }

  public get status(): ServiceStatus {
    return this.props.status;
  }

  public get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  public get isArchived(): boolean {
    return this.props.status === "ARCHIVED";
  }

  public get isBookable(): boolean {
    return this.props.status === "ACTIVE";
  }

  // ─────────────────────────────────────────────────────────────
  // Mutators
  // ─────────────────────────────────────────────────────────────

  public rename(newName: string): void {
    this.props.name = Service.validateName(newName);
    this.touch();
  }

  public changeDescription(newDescription: string | null): void {
    this.props.description = Service.validateDescription(newDescription);
    this.touch();
  }

  public changeDuration(newDurationMinutes: number): void {
    this.props.duration = Duration.fromMinutes(newDurationMinutes);
    this.touch();
  }

  public changePrice(newPriceCents: number): void {
    this.props.price = Money.fromCents(newPriceCents);
    this.touch();
  }

  public setRequiresPayment(value: boolean): void {
    if (this.props.requiresPayment === value) return;
    this.props.requiresPayment = value;
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