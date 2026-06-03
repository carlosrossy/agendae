import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { Email } from "@/domain/value-objects/email";
import { InvalidUserError } from "@/domain/errors/invalid-user.error";

export type UserRole = "OWNER" | "STAFF" | "CUSTOMER";
export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED";

export interface UserProps extends EntityProps {
  tenantId: UniqueId;
  name: string;
  email: Email;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface CreateUserInput {
  tenantId: UniqueId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface InviteUserInput {
  tenantId: UniqueId;
  name: string;
  email: string;
  role: UserRole;
}

export class User extends Entity<UserProps> {
  private static readonly MIN_NAME = 2;
  private static readonly MAX_NAME = 100;

  private constructor(props: UserProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateUserInput): User {
    const name = User.validateName(input.name);
    const email = Email.create(input.email);
    User.assertPasswordHash(input.passwordHash);

    const now = new Date();
    return new User({
      id: UniqueId.generate(),
      tenantId: input.tenantId,
      name,
      email,
      passwordHash: input.passwordHash,
      role: input.role,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static invite(input: InviteUserInput): User {
    const name = User.validateName(input.name);
    const email = Email.create(input.email);

    const now = new Date();
    return new User({
      id: UniqueId.generate(),
      tenantId: input.tenantId,
      name,
      email,
      passwordHash: null,
      role: input.role,
      status: "INVITED",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: UserProps): User {
    return new User(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Validators
  // ─────────────────────────────────────────────────────────────

  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new InvalidUserError("User name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < User.MIN_NAME || trimmed.length > User.MAX_NAME) {
      throw new InvalidUserError(
        `User name must be between ${User.MIN_NAME} and ${User.MAX_NAME} characters.`,
      );
    }
    return trimmed;
  }

  private static assertPasswordHash(hash: string): void {
    if (typeof hash !== "string" || hash.length === 0) {
      throw new InvalidUserError("Password hash is required.");
    }
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

  public get email(): Email {
    return this.props.email;
  }

  public get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  public get role(): UserRole {
    return this.props.role;
  }

  public get status(): UserStatus {
    return this.props.status;
  }

  public get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  public get isOwner(): boolean {
    return this.props.role === "OWNER";
  }

  public get isStaff(): boolean {
    return this.props.role === "STAFF";
  }

  public get isCustomer(): boolean {
    return this.props.role === "CUSTOMER";
  }

  // ─────────────────────────────────────────────────────────────
  // Mutators
  // ─────────────────────────────────────────────────────────────

  public rename(newName: string): void {
    this.props.name = User.validateName(newName);
    this.touch();
  }

  public changeEmail(newEmail: string): void {
    this.props.email = Email.create(newEmail);
    this.touch();
  }

  public setPasswordHash(newHash: string): void {
    User.assertPasswordHash(newHash);
    this.props.passwordHash = newHash;
    if (this.props.status === "INVITED") {
      this.props.status = "ACTIVE";
    }
    this.touch();
  }

  public disable(): void {
    if (this.props.status === "DISABLED") return;
    this.props.status = "DISABLED";
    this.touch();
  }

  public reactivate(): void {
    if (this.props.status === "ACTIVE") return;
    if (this.props.passwordHash === null) {
      throw new InvalidUserError(
        "Cannot reactivate a user without a password. Use setPasswordHash first.",
      );
    }
    this.props.status = "ACTIVE";
    this.touch();
  }

  public promoteToOwner(): void {
    if (this.props.role === "OWNER") return;
    this.props.role = "OWNER";
    this.touch();
  }

  public demoteToStaff(): void {
    if (this.props.role === "STAFF") return;
    if (this.props.role === "CUSTOMER") {
      throw new InvalidUserError("Cannot demote a CUSTOMER to STAFF.");
    }
    this.props.role = "STAFF";
    this.touch();
  }
}