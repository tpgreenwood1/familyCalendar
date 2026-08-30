import bcrypt from "bcryptjs";

/**
 * Better Auth's default password hashing is scrypt, incompatible with the bcrypt hashes
 * already stored for existing users (DesignSpec.md §6.1 — migrate without losing data or
 * forcing password resets). Wiring bcrypt in as Better Auth's hash/verify keeps old and new
 * accounts on the same algorithm.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
