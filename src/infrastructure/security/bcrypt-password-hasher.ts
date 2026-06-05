import bcrypt from "bcryptjs";
import type { PasswordHasher } from "@/application/ports/password-hasher";

/**
 * Production implementation of the PasswordHasher port using bcryptjs.
 *
 * The cost factor (salt rounds) is injectable so tests can run with a cheap
 * value while production uses a stronger one. 12 is a sensible default in 2026
 * (~250ms per hash on commodity hardware) — high enough to slow brute force,
 * low enough to not block request handlers.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  private static readonly DEFAULT_ROUNDS = 12;

  constructor(
    private readonly rounds: number = BcryptPasswordHasher.DEFAULT_ROUNDS,
  ) {}

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
