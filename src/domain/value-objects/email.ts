import { ValueObject } from "@/shared/utils/value-object";
import { InvalidEmailError } from "@/domain/errors/invalid-email.error";

interface EmailProps {
  value: string;
}

/**
 * Email Value Object.
 *
 * Encapsulates the rules for a valid email address.
 * Always stored in lowercase for case-insensitive comparison.
 *
 * @example
 * const email = Email.create("Carlos@Gmail.com"); // stored as "carlos@gmail.com"
 * email.value; // "carlos@gmail.com"
 *
 * @throws {InvalidEmailError} if the value is not a valid email format.
 */
export class Email extends ValueObject<EmailProps> {
  // Practical RFC-5322-ish regex. Good enough for 99% of real-world cases.
  // For 100%, you'd need to actually send a verification email.
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();

    if (!Email.EMAIL_REGEX.test(trimmed)) {
      throw new InvalidEmailError(value);
    }

    return new Email({ value: trimmed });
  }

  public get value(): string {
    return this.props.value;
  }

  public override toString(): string {
    return this.props.value;
  }
}
