/**
 * Server-side cleaning request fingerprint (PRD §16)
 *
 * The fingerprint is generated entirely on the server.
 * It is never accepted from client input.
 *
 * Purpose: detect when a client reuses an idempotency key with a different
 * payload (different reportId or different operations) and reject with 409.
 *
 * Algorithm: SHA-256 of a canonical JSON representation of reportId + sorted operations.
 */

import { createHash } from "crypto";
import { CleaningOperation } from "@/types/models";

/**
 * Generate a deterministic SHA-256 fingerprint for a cleaning request.
 * Operations are sorted to canonical order before hashing so that
 * { TRIM, BLANK } and { BLANK, TRIM } produce the same fingerprint
 * (operation selection, not order, defines the request identity).
 */
export function generateRequestFingerprint(
  reportId: string,
  operations: CleaningOperation[]
): string {
  const canonical = {
    reportId,
    // Sort operations alphabetically for canonical representation
    operations: [...operations].sort(),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
