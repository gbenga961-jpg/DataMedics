/**
 * Password Hashing & Verification (Docs/.agent/rules/.security.md and OD-01)
 * Uses standard Node.js crypto (scrypt) with cryptographically secure salts.
 * Zero unapproved third-party dependencies.
 */

import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Hashes a plaintext password using crypto.scrypt.
 * Output format: <salt_hex>:<hash_hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored <salt_hex>:<hash_hex> string
 * using constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, keyHex] = parts;
  const originalKey = Buffer.from(keyHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  if (originalKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(originalKey, derivedKey);
}
