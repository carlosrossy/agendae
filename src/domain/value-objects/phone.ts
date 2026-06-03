import { ValueObject } from "@/shared/utils/value-object";
import { InvalidPhoneError } from "@/domain/errors/invalid-phone.error";

interface PhoneProps {
  digits: string;
}

export class Phone extends ValueObject<PhoneProps> {
  private constructor(props: PhoneProps) {
    super(props);
  }

  public static create(input: string): Phone {
    if (typeof input !== "string") {
      throw new InvalidPhoneError(String(input));
    }

    let digits = input.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("55")) {
      digits = digits.slice(2);
    } else if (digits.length === 12 && digits.startsWith("55")) {
      digits = digits.slice(2);
    }

    if (!Phone.isValidBrazilianNumber(digits)) {
      throw new InvalidPhoneError(input);
    }

    return new Phone({ digits });
  }

  private static isValidBrazilianNumber(digits: string): boolean {
    if (digits.length === 11) {
      const ddd = digits.slice(0, 2);
      const firstAfterDdd = digits[2];
      return Phone.isValidDdd(ddd) && firstAfterDdd === "9";
    }

    if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const firstAfterDdd = digits[2];
      return (
        Phone.isValidDdd(ddd) &&
        firstAfterDdd !== undefined &&
        firstAfterDdd !== "9" &&
        firstAfterDdd !== "0" &&
        firstAfterDdd !== "1"
      );
    }

    return false;
  }

  private static isValidDdd(ddd: string): boolean {
    if (ddd.length !== 2) return false;
    const value = Number(ddd);
    return Number.isInteger(value) && value >= 11 && value <= 99;
  }

  public get digits(): string {
    return this.props.digits;
  }

  public get isMobile(): boolean {
    return this.props.digits.length === 11;
  }

  public get isFixed(): boolean {
    return this.props.digits.length === 10;
  }

  public format(): string {
    const d = this.props.digits;
    const ddd = d.slice(0, 2);

    if (this.isMobile) {
      return `(${ddd}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }

    return `(${ddd}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }

  public override toString(): string {
    return this.format();
  }
}