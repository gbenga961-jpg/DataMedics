/**
 * File Management Service Boundaries (PRD §13)
 * Handles upload persistence, private object coordination and ownership verification.
 */

export interface FileService {
  saveOriginalUpload(userId: string, filename: string, data: Buffer): Promise<{ fileId: string; storageKey: string }>;
  getOriginalFile(fileId: string, userId: string): Promise<Buffer>;
}
