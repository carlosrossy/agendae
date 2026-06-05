import { describe, it, expect } from "vitest";
import { BcryptPasswordHasher } from "@/infrastructure/security/bcrypt-password-hasher";

describe("BcryptPasswordHasher", () => {
  // Low cost factor keeps the unit test fast; production uses the default (12).
  const hasher = new BcryptPasswordHasher(4);

  it("produces a hash that differs from the plaintext", async () => {
    const hash = await hasher.hash("s3nh4-secreta");

    expect(hash).not.toBe("s3nh4-secreta");
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash signature
  });

  it("compare() returns true for the correct password", async () => {
    const hash = await hasher.hash("s3nh4-secreta");

    await expect(hasher.compare("s3nh4-secreta", hash)).resolves.toBe(true);
  });

  it("compare() returns false for a wrong password", async () => {
    const hash = await hasher.hash("s3nh4-secreta");

    await expect(hasher.compare("senha-errada", hash)).resolves.toBe(false);
  });

  it("uses a random salt: same password yields different hashes", async () => {
    const a = await hasher.hash("mesma-senha");
    const b = await hasher.hash("mesma-senha");

    expect(a).not.toBe(b);
    // ...but both still validate against the original password.
    await expect(hasher.compare("mesma-senha", a)).resolves.toBe(true);
    await expect(hasher.compare("mesma-senha", b)).resolves.toBe(true);
  });

  it("a hash made by one instance verifies on another (cost factor is embedded)", async () => {
    const strong = new BcryptPasswordHasher(6);
    const hash = await strong.hash("portátil");

    // A different instance (rounds=4) can still verify it.
    await expect(hasher.compare("portátil", hash)).resolves.toBe(true);
  });
});
