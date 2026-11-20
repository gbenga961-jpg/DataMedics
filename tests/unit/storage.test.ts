import { describe, it, expect } from "vitest";
import {
  generateStorageKey,
  sanitizeSignedUrlExpiry,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
} from "@/lib/storage";

describe("Private Object Storage Safety Controls (PRD §13, §18)", () => {
  it("generates separate keys with distinct prefixes for uploads, canonical, and safe-export", () => {
    const uploadKey = generateStorageKey("uploads", "csv");
    const canonicalKey = generateStorageKey("canonical", "csv");
    const safeExportKey = generateStorageKey("safe-export", "csv");

    expect(uploadKey).toMatch(/^uploads\/\d+-[0-9a-f-]{36}\.csv$/);
    expect(canonicalKey).toMatch(/^canonical\/\d+-[0-9a-f-]{36}\.csv$/);
    expect(safeExportKey).toMatch(/^safe-export\/\d+-[0-9a-f-]{36}\.csv$/);

    expect(uploadKey).not.toEqual(canonicalKey);
    expect(canonicalKey).not.toEqual(safeExportKey);
  });

  it("sanitizes dangerous characters in file extensions", () => {
    const maliciousExtKey = generateStorageKey("uploads", "../evil.exe");
    expect(maliciousExtKey).not.toContain("..");
    const fileName = maliciousExtKey.replace(/^uploads\//, "");
    expect(fileName).not.toContain("/");
    expect(maliciousExtKey).toMatch(/^uploads\/\d+-[0-9a-f-]{36}\.[a-zA-Z0-9]+$/);
  });

  it("enforces signed URL expiration boundaries", () => {
    expect(sanitizeSignedUrlExpiry()).toBe(DEFAULT_SIGNED_URL_EXPIRY_SECONDS);
    expect(sanitizeSignedUrlExpiry(-10)).toBe(DEFAULT_SIGNED_URL_EXPIRY_SECONDS);
    expect(sanitizeSignedUrlExpiry(300)).toBe(300);
    expect(sanitizeSignedUrlExpiry(7200)).toBe(MAX_SIGNED_URL_EXPIRY_SECONDS); // Capped at 1 hour
  });
});
