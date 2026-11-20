/**
 * Private Object Storage Interface & Safety Controls (PRD §13, §18 and Docs/.agent/rules/.security.md)
 * Rules:
 * - All files remain strictly in private storage.
 * - Never expose permanent storage URLs or storage keys directly to the client.
 * - Storage keys must be server-generated UUIDs/hashes, never derived from user file names.
 * - Original uploads and cleaned outputs are stored separately.
 * - Signed URLs must be short-lived (default 900 seconds / 15 minutes).
 */

import { randomUUID } from "crypto";

export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes max
export const MAX_SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour ceiling

export interface StorageObjectMetadata {
  key: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageProvider {
  putObject(key: string, data: Buffer | Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

/**
 * In-memory private storage provider for local operation, tests, and development.
 */
export class MemoryStorageProvider implements StorageProvider {
  private storage = new Map<string, { data: Buffer; contentType: string }>();

  async putObject(key: string, data: Buffer | Uint8Array, contentType: string): Promise<void> {
    this.storage.set(key, {
      data: Buffer.isBuffer(data) ? data : Buffer.from(data),
      contentType,
    });
  }

  async getObject(key: string): Promise<Buffer> {
    const item = this.storage.get(key);
    if (!item) {
      throw new Error(`Storage key not found: ${key}`);
    }
    return item.data;
  }

  async deleteObject(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    if (!this.storage.has(key)) {
      throw new Error(`Storage key not found: ${key}`);
    }
    const expiry = sanitizeSignedUrlExpiry(expiresInSeconds);
    return `/api/files/download?key=${encodeURIComponent(key)}&expires=${Date.now() + expiry * 1000}`;
  }
}

let globalStorageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!globalStorageInstance) {
    globalStorageInstance = new MemoryStorageProvider();
  }
  return globalStorageInstance;
}

/**
 * Generates an unpredictable server-side storage key.
 * Never includes user-supplied filename to prevent path traversal and collisions.
 */
export function generateStorageKey(
  prefix: "uploads" | "canonical" | "safe-export",
  extension: string = "csv"
): string {
  const safeId = randomUUID();
  const timestamp = Date.now();
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "csv";
  return `${prefix}/${timestamp}-${safeId}.${safeExt}`;
}

/**
 * Validates requested signed URL expiration.
 */
export function sanitizeSignedUrlExpiry(seconds?: number): number {
  if (!seconds || seconds <= 0) {
    return DEFAULT_SIGNED_URL_EXPIRY_SECONDS;
  }
  return Math.min(seconds, MAX_SIGNED_URL_EXPIRY_SECONDS);
}
