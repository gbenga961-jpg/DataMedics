/**
 * Secure Session Management & Cookie Handling (SECURITY.md)
 * Issues tamper-proof HMAC-SHA256 signed tokens for authentication cookies.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getConfig } from "@/lib/config";
import { SessionUser } from "./index";

export const SESSION_COOKIE_NAME = "datamedics_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  user: SessionUser;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || "datamedics-development-secret-key-32-chars-min";
  return secret;
}

/**
 * Signs a session payload and returns a base64url encoded token: <payload_b64>.<signature_b64>
 */
export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    user,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");

  const secret = getSessionSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest("base64url");

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies and decodes a signed session token. Returns null if invalid or expired.
 */
export function verifySessionToken(token: string): SessionUser | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signatureB64] = parts;
  const secret = getSessionSecret();

  const hmac = createHmac("sha256", secret);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest("base64url");

  const sigBuffer = Buffer.from(signatureB64);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(payloadStr);

    if (Date.now() > payload.expiresAt) {
      return null; // Expired session
    }

    return payload.user;
  } catch {
    return null;
  }
}
