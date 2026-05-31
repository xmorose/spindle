import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== KEYLEN) return false;
    const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), KEYLEN);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
