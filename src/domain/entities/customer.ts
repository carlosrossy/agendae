import { Entity, type EntityProps } from "@/shared/utils/entity";
import { UniqueId } from "@/shared/utils/id";
import { Email } from "@/domain/value-objects/email";
import { Phone } from "@/domain/value-objects/phone";
import { InvalidCustomerError } from "@/domain/errors/invalid-customer.error";

export interface CustomerProps extends EntityProps {
  tenantId: UniqueId;
  userId: UniqueId | null;
  name: string;
  email: Email;
  phone: Phone | null;
  notes: string | null;
}

export interface CreateCustomerInput {
  tenantId: UniqueId;
  userId?: UniqueId | null;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

export class Customer extends Entity<CustomerProps> {
  private static readonly MIN_NAME = 2;
  private static readonly MAX_NAME = 100;
  private static readonly MAX_NOTES = 1000;

  private constructor(props: CustomerProps) {
    super(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────

  public static create(input: CreateCustomerInput): Customer {
    const name = Customer.validateName(input.name);
    const email = Email.create(input.email);
    const phone = input.phone ? Phone.create(input.phone) : null;
    const notes = Customer.validateNotes(input.notes);

    const now = new Date();
    return new Customer({
      id: UniqueId.generate(),
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      name,
      email,
      phone,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: CustomerProps): Customer {
    return new Customer(props);
  }

  // ─────────────────────────────────────────────────────────────
  // Validators
  // ─────────────────────────────────────────────────────────────

  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new InvalidCustomerError("Customer name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < Customer.MIN_NAME || trimmed.length > Customer.MAX_NAME) {
      throw new InvalidCustomerError(
        `Customer name must be between ${Customer.MIN_NAME} and ${Customer.MAX_NAME} characters.`,
      );
    }
    return trimmed;
  }

  private static validateNotes(notes: string | null | undefined): string | null {
    if (notes === null || notes === undefined) return null;
    if (typeof notes !== "string") {
      throw new InvalidCustomerError("Customer notes must be a string.");
    }
    const trimmed = notes.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > Customer.MAX_NOTES) {
      throw new InvalidCustomerError(
        `Customer notes must be at most ${Customer.MAX_NOTES} characters.`,
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

  public get userId(): UniqueId | null {
    return this.props.userId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get email(): Email {
    return this.props.email;
  }

  public get phone(): Phone | null {
    return this.props.phone;
  }

  public get notes(): string | null {
    return this.props.notes;
  }

  public get isRegistered(): boolean {
    return this.props.userId !== null;
  }

  // ─────────────────────────────────────────────────────────────
  // Mutators
  // ─────────────────────────────────────────────────────────────

  public rename(newName: string): void {
    this.props.name = Customer.validateName(newName);
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

  public changeNotes(newNotes: string | null): void {
    this.props.notes = Customer.validateNotes(newNotes);
    this.touch();
  }

  public linkUser(userId: UniqueId): void {
    if (this.props.userId !== null) {
      throw new InvalidCustomerError(
        "Customer already has a linked user. Unlink first.",
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
}