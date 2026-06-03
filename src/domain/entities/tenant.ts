import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { Duration } from "@/domain/value-objects/duration";
import { InvalidTenantError } from "@/domain/errors/invalid-tenant.error";

export type TenantStatus = "ACTIVE" | "SUSPENDED";

export interface TenantProps extends EntityProps {
  name: string;
  slug: string;
  email: Email;
  phone: Phone | null;
  timezone: string;
  minimumLeadTime: Duration;
  status: TenantStatus;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  timezone: string;
  minimumLeadTimeMinutes?: number;
}

export class Tenant extends Entity<TenantProps> {
  private static readonly SLUG_REGEX =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  private static readonly MIN_NAME = 2;
  private static readonly MAX_NAME = 100;
  private static readonly MIN_SLUG = 3;
  private static readonly MAX_SLUG = 50;
  private static readonly DEFAULT_LEAD_MINUTES = 60;

  private constructor(props: TenantProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateTenantInput): Tenant {
    const name = Tenant.validateName(input.name);
    const slug = Tenant.validateSlug(input.slug);
    const email = Email.create(input.email);
    const phone = input.phone ? Phone.create(input.phone) : null;
    Tenant.validateTimezone(input.timezone);

    const minimumLeadTime = Duration.fromMinutes(
      input.minimumLeadTimeMinutes ?? Tenant.DEFAULT_LEAD_MINUTES,
    );

    const now = new Date();

    return new Tenant({
      id: UniqueId.generate(),
      name,
      slug,
      email,
      phone,
      timezone: input.timezone,
      minimumLeadTime,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Static validators (kept private to the class)
  // ─────────────────────────────────────────────────────────────

  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new InvalidTenantError("Tenant name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < Tenant.MIN_NAME || trimmed.length > Tenant.MAX_NAME) {
      throw new InvalidTenantError(
        `Tenant name must be between ${Tenant.MIN_NAME} and ${Tenant.MAX_NAME} characters.`,
      );
    }
    return trimmed;
  }

  private static validateSlug(slug: string): string {
    if (typeof slug !== "string") {
      throw new InvalidTenantError("Tenant slug must be a string.");
    }
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length < Tenant.MIN_SLUG || trimmed.length > Tenant.MAX_SLUG) {
      throw new InvalidTenantError(
        `Tenant slug must be between ${Tenant.MIN_SLUG} and ${Tenant.MAX_SLUG} characters.`,
      );
    }
    if (!Tenant.SLUG_REGEX.test(trimmed)) {
      throw new InvalidTenantError(
        `Tenant slug "${slug}" is invalid. Use only lowercase letters, numbers and hyphens (no leading/trailing or repeated hyphens).`,
      );
    }
    return trimmed;
  }

  private static validateTimezone(timezone: string): void {
    if (typeof timezone !== "string" || timezone.length === 0) {
      throw new InvalidTenantError("Tenant timezone is required.");
    }
    // Use Intl to validate IANA timezone names without external dependencies.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      throw new InvalidTenantError(`Tenant timezone "${timezone}" is not a valid IANA timezone.`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────

  public get name(): string {
    return this.props.name;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get email(): Email {
    return this.props.email;
  }

  public get phone(): Phone | null {
    return this.props.phone;
  }

  public get timezone(): string {
    return this.props.timezone;
  }

  public get minimumLeadTime(): Duration {
    return this.props.minimumLeadTime;
  }

  public get status(): TenantStatus {
    return this.props.status;
  }

  public get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  // ─────────────────────────────────────────────────────────────
  // Mutators (controlled state changes)
  // ─────────────────────────────────────────────────────────────

  public rename(newName: string): void {
    this.props.name = Tenant.validateName(newName);
    this.touch();
  }

  public changeEmail(newEmail: string): void {
    this.props.email = Email.create(newEmail);
    this.touch();
  }

  public changePhone(newPhone: string | null): void {
    this.props.phone = newPhone ? Phone.create(newPhone) : null;
    this.touch();
  }

  public changeMinimumLeadTime(newLeadTimeMinutes: number): void {
    this.props.minimumLeadTime = Duration.fromMinutes(newLeadTimeMinutes);
    this.touch();
  }

  public suspend(): void {
    if (this.props.status === "SUSPENDED") return;
    this.props.status = "SUSPENDED";
    this.touch();
  }

  public reactivate(): void {
    if (this.props.status === "ACTIVE") return;
    this.props.status = "ACTIVE";
    this.touch();
  }
}