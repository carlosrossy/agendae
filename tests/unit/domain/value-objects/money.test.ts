import { describe, it, expect } from "vitest";
import { Money } from "@/domain/value-objects/money";
import { InvalidMoneyError } from "@/domain/errors/invalid-money.error";

describe("Money", () => {
  describe("fromCents", () => {
    it("should create Money with the given cents", () => {
      const m = Money.fromCents(2510);

      expect(m.cents).toBe(2510);
      expect(m.currency).toBe("BRL");
    });

    it("should default to BRL currency", () => {
      const m = Money.fromCents(100);

      expect(m.currency).toBe("BRL");
    });

    it("should allow zero", () => {
      const m = Money.fromCents(0);

      expect(m.cents).toBe(0);
      expect(m.isZero()).toBe(true);
    });

    it.each([1.5, 100.7, Number.NaN])(
      "should reject non-integer cents: %s",
      (value) => {
        expect(() => Money.fromCents(value)).toThrow(InvalidMoneyError);
      },
    );

    it.each([-1, -100])(
      "should reject negative cents: %s",
      (value) => {
        expect(() => Money.fromCents(value)).toThrow(InvalidMoneyError);
      },
    );
  });

  describe("fromAmount", () => {
    it("should convert amount to cents", () => {
      const m = Money.fromAmount(25.1);

      expect(m.cents).toBe(2510);
    });

    it("should handle floating-point inputs safely", () => {
      const m = Money.fromAmount(0.1 + 0.2);

      expect(m.cents).toBe(30);
    });

    it("should document the float-imprecision trap when using fromAmount", () => {
      // 1.005 looks like it should become 101 cents, but in IEEE-754 floating
      // point, 1.005 is actually 1.00499999... So 1.005 * 100 = 100.49999...
      // which rounds DOWN to 100. This is exactly why we prefer `fromCents`
      // when precision matters — `fromAmount` is for display-derived inputs only.
      const m = Money.fromAmount(1.005);

      expect(m.cents).toBe(100);
    });

    it("should reject non-finite amounts", () => {
      expect(() => Money.fromAmount(Number.NaN)).toThrow(InvalidMoneyError);
      expect(() => Money.fromAmount(Number.POSITIVE_INFINITY)).toThrow(
        InvalidMoneyError,
      );
    });
  });

  describe("arithmetic", () => {
    it("should add two Money values", () => {
      const a = Money.fromCents(2510);
      const b = Money.fromCents(1490);

      const sum = a.plus(b);

      expect(sum.cents).toBe(4000);
    });

    it("should NOT mutate operands on add", () => {
      const a = Money.fromCents(100);
      const b = Money.fromCents(200);

      a.plus(b);

      expect(a.cents).toBe(100);
      expect(b.cents).toBe(200);
    });

    it("should subtract two Money values", () => {
      const a = Money.fromCents(5000);
      const b = Money.fromCents(1500);

      const diff = a.minus(b);

      expect(diff.cents).toBe(3500);
    });

    it("should reject subtraction that would go negative", () => {
      const a = Money.fromCents(100);
      const b = Money.fromCents(500);

      expect(() => a.minus(b)).toThrow(InvalidMoneyError);
    });

    it("should multiply by a factor", () => {
      const m = Money.fromCents(1000);

      expect(m.multiply(3).cents).toBe(3000);
      expect(m.multiply(0.5).cents).toBe(500);
      expect(m.multiply(0).cents).toBe(0);
    });

    it("should round multiplication result to nearest cent", () => {
      const m = Money.fromCents(333);

      expect(m.multiply(0.1).cents).toBe(33);
    });

    it("should reject negative multiplication factor", () => {
      const m = Money.fromCents(100);

      expect(() => m.multiply(-1)).toThrow(InvalidMoneyError);
    });
  });

  describe("currency safety", () => {
    it("should reject arithmetic between different currencies", () => {
      const brl = Money.fromCents(100, "BRL");
      const usd = Money.fromCents(100, "USD" as never);

      expect(() => brl.plus(usd)).toThrow(InvalidMoneyError);
      expect(() => brl.minus(usd)).toThrow(InvalidMoneyError);
      expect(() => brl.isGreaterThan(usd)).toThrow(InvalidMoneyError);
    });
  });

  describe("comparison", () => {
    it("should compare with isGreaterThan", () => {
      const big = Money.fromCents(1000);
      const small = Money.fromCents(500);

      expect(big.isGreaterThan(small)).toBe(true);
      expect(small.isGreaterThan(big)).toBe(false);
    });

    it("should compare with isLessThan", () => {
      const big = Money.fromCents(1000);
      const small = Money.fromCents(500);

      expect(small.isLessThan(big)).toBe(true);
      expect(big.isLessThan(small)).toBe(false);
    });

    it("isZero should be true only for zero", () => {
      expect(Money.fromCents(0).isZero()).toBe(true);
      expect(Money.fromCents(1).isZero()).toBe(false);
    });
  });

  describe("equality (inherited)", () => {
    it("should treat same cents + same currency as equal", () => {
      const a = Money.fromCents(2510);
      const b = Money.fromCents(2510);

      expect(a.equals(b)).toBe(true);
    });

    it("should treat different cents as not equal", () => {
      const a = Money.fromCents(2510);
      const b = Money.fromCents(2520);

      expect(a.equals(b)).toBe(false);
    });
  });

  describe("format", () => {
    it("should format BRL with currency symbol", () => {
      const m = Money.fromCents(2510);
      expect(m.format()).toMatch(/R\$\s?25,10/);
    });

    it("should format zero", () => {
      const m = Money.fromCents(0);

      expect(m.format()).toMatch(/R\$\s?0,00/);
    });

    it("should format large values with thousand separator", () => {
      const m = Money.fromCents(123456789);

      expect(m.format()).toMatch(/R\$\s?1\.234\.567,89/);
    });
  });
});