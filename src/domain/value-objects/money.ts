import { ValueObject } from "@/shared/utils/value-object";
import { InvalidMoneyError } from "@/domain/errors/invalid-money.error";

export type Currency = "BRL";

interface MoneyProps {
  cents: number;
  currency: Currency;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  public static fromCents(cents: number, currency: Currency = "BRL"): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError(
        `Money must be created with an integer number of cents, received ${cents}.`,
      );
    }
    if (cents < 0) {
      throw new InvalidMoneyError(
        `Money cannot be negative, received ${cents} cents.`,
      );
    }

    return new Money({ cents, currency });
  }

  public static fromAmount(amount: number, currency: Currency = "BRL"): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidMoneyError(
        `Amount must be a finite number, received ${amount}.`,
      );
    }
    const cents = Math.round(amount * 100);

    return Money.fromCents(cents, currency);
  }

  public get cents(): number {
    return this.props.cents;
  }

  public get amount(): number {
    return this.props.cents / 100;
  }

  public get currency(): Currency {
    return this.props.currency;
  }

  public plus(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  public minus(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.cents - other.cents;
    if (result < 0) {
      throw new InvalidMoneyError(
        `Subtraction would result in negative Money: ${this.cents} - ${other.cents}.`,
      );
    }
    return Money.fromCents(result, this.currency);
  }

  public multiply(factor: number): Money {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new InvalidMoneyError(
        `Multiplication factor must be a non-negative finite number, received ${factor}.`,
      );
    }
    return Money.fromCents(Math.round(this.cents * factor), this.currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents > other.cents;
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents < other.cents;
  }

  public isZero(): boolean {
    return this.cents === 0;
  }

  public format(): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: this.currency,
    }).format(this.amount);
  }

  public override toString(): string {
    return this.format();
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        `Cannot operate on different currencies: ${this.currency} vs ${other.currency}.`,
      );
    }
  }
}