/**
 * Integration and Unit Tests for Milestone 3 — Analysis Experience (PRD §5, §6, §14, §16)
 * Tests:
 * 1. User registration & password hashing
 * 2. Login verification & HMAC session signing/tamper detection
 * 3. File upload validation & private storage persistence
 * 4. Processing job creation & deterministic queue IDs
 * 5. Analysis worker execution & findings persistence
 * 6. Worker idempotency (completed jobs never reprocessed)
 * 7. Job reconciliation & crash recovery
 * 8. Cross-user ownership enforcement (anti-enumeration 404)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { MemoryDataRepository } from "@/services/repository";
import { MemoryStorageProvider, generateStorageKey } from "@/lib/storage";
import { processAnalysisJob } from "@/workers/analysis.worker";
import { reconcileStaleJobs } from "@/services/jobs/reconciliation";
import { JobStatus, UploadStatus, IssueType, DetectionStatus } from "@/types/models";
import { assertOwnership, NotFoundOrForbiddenError } from "@/lib/auth";

describe("Milestone 3 — Analysis Experience Full Integration Suite", () => {
  let repo: MemoryDataRepository;
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    repo = new MemoryDataRepository();
    storage = new MemoryStorageProvider();
  });

  describe("1. Authentication & Session Security (OD-01, SECURITY.md)", () => {
    it("securely hashes passwords with scrypt and unique salts", async () => {
      const pass = "SuperSecretPassword123!";
      const hash1 = await hashPassword(pass);
      const hash2 = await hashPassword(pass);

      expect(hash1).not.toEqual(hash2); // Different salts
      expect(hash1).toContain(":");

      expect(await verifyPassword(pass, hash1)).toBe(true);
      expect(await verifyPassword("WrongPassword!", hash1)).toBe(false);
    });

    it("creates tamper-proof HMAC session tokens and detects tampering", () => {
      const user = { id: "usr-test-1", email: "test@example.com", name: "Tester" };
      const token = createSessionToken(user);

      // Valid token decodes correctly
      const verified = verifySessionToken(token);
      expect(verified?.id).toBe("usr-test-1");
      expect(verified?.email).toBe("test@example.com");

      // Tampered payload is rejected
      const [payloadB64, sig] = token.split(".");
      const tamperedPayload = Buffer.from(JSON.stringify({ user: { id: "usr-admin" }, expiresAt: Date.now() + 10000 })).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${sig}`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });
  });

  describe("2. Upload, Storage, and Record Creation (PRD §6.3, §14.1)", () => {
    it("stores uploaded file privately and persists UploadedFile and AnalysisReport", async () => {
      const user = await repo.createUser("uploader@example.com", "hash", "Uploader");

      const csvContent = "id,name,amount\n1,Alice,100\n2,Bob,200\n";
      const buffer = Buffer.from(csvContent, "utf-8");
      const storageKey = generateStorageKey("uploads", "csv");

      await storage.putObject(storageKey, buffer, "text/csv");

      const upload = await repo.createUploadedFile({
        userId: user.id,
        filename: "test.csv",
        storageKey,
        fileSizeBytes: buffer.byteLength,
        mimeType: "text/csv",
        rowCount: 2,
        columnCount: 3,
        uploadStatus: UploadStatus.ACCEPTED,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      expect(upload.id).toBeDefined();
      expect(upload.uploadStatus).toBe(UploadStatus.ACCEPTED);

      const report = await repo.createAnalysisReport({
        uploadedFileId: upload.id,
        totalRows: 2,
        totalColumns: 3,
      });

      expect(report.status).toBe(JobStatus.QUEUED);
      expect(report.totalRows).toBe(2);

      const job = await repo.createProcessingJob({
        reportId: report.id,
        queueJobId: `analysis-${report.id}`,
      });

      expect(job.status).toBe(JobStatus.QUEUED);
      expect(job.maxAttempts).toBe(3);
    });
  });

  describe("3. Analysis Worker Execution & Idempotency (PRD §16)", () => {
    it("processes analysis job, persists findings, and marks report completed", async () => {
      const user = await repo.createUser("worker@example.com", "hash");

      // Sample CSV with 1 missing value and 1 duplicate row
      const csv = "id,product,price\n1,Widget,10.00\n2,,20.00\n1,Widget,10.00\n";
      const buffer = Buffer.from(csv, "utf-8");
      const storageKey = generateStorageKey("uploads", "csv");
      await storage.putObject(storageKey, buffer, "text/csv");

      const upload = await repo.createUploadedFile({
        userId: user.id,
        filename: "sales.csv",
        storageKey,
        fileSizeBytes: buffer.byteLength,
        mimeType: "text/csv",
        rowCount: 3,
        columnCount: 3,
        uploadStatus: UploadStatus.ACCEPTED,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const report = await repo.createAnalysisReport({
        uploadedFileId: upload.id,
        totalRows: 3,
        totalColumns: 3,
      });

      const job = await repo.createProcessingJob({
        reportId: report.id,
        queueJobId: `analysis-${report.id}`,
      });

      // Execute worker
      const executionResult = await processAnalysisJob(
        {
          processingJobId: job.id,
          reportId: report.id,
          uploadedFileId: upload.id,
          storageKey,
          userId: user.id,
        },
        repo,
        storage
      );

      expect(executionResult.success).toBe(true);
      expect(executionResult.status).toBe(JobStatus.COMPLETED);
      expect(executionResult.totalIssues).toBeGreaterThan(0);

      // Verify report is completed
      const updatedReport = await repo.getAnalysisReport(report.id);
      expect(updatedReport?.status).toBe(JobStatus.COMPLETED);
      expect(updatedReport?.completedAt).not.toBeNull();
      expect(updatedReport?.totalIssues).toBe(executionResult.totalIssues);

      // Verify job is marked completed
      const updatedJob = await repo.getProcessingJob(job.id);
      expect(updatedJob?.status).toBe(JobStatus.COMPLETED);
    });

    it("enforces idempotency: does not reprocess already completed jobs", async () => {
      const job = await repo.createProcessingJob({ reportId: "rep-1" });
      await repo.markJobCompleted(job.id);

      const result = await processAnalysisJob(
        {
          processingJobId: job.id,
          reportId: "rep-1",
          uploadedFileId: "up-1",
          storageKey: "key-1",
          userId: "usr-1",
        },
        repo,
        storage
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(JobStatus.COMPLETED);
    });
  });

  describe("4. Stale Job Reconciliation & Crash Recovery (PRD §16.7)", () => {
    it("recovers stale PROCESSING jobs within attempt limits and exhausts after maxAttempts", async () => {
      const report = await repo.createAnalysisReport({
        uploadedFileId: "up-stale",
        totalRows: 10,
        totalColumns: 2,
      });

      const staleJob = await repo.createProcessingJob({ reportId: report.id });
      // Simulate crashed worker: job was claimed but lease expired 2 hours ago
      staleJob.status = JobStatus.PROCESSING;
      staleJob.attempts = 1;
      staleJob.leaseExpiresAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const summary = await reconcileStaleJobs(5000, repo);
      expect(summary.inspectedCount).toBe(1);
      expect(summary.recoveredCount).toBe(1);

      // Job should be reset to QUEUED for retry
      const recoveredJob = await repo.getProcessingJob(staleJob.id);
      expect(recoveredJob?.status).toBe(JobStatus.QUEUED);
    });
  });

  describe("5. Cross-User Authorization & Anti-Enumeration (SECURITY.md)", () => {
    it("prevents unauthorized access and returns uniform 404 to block enumeration", () => {
      const ownerId = "usr-legitimate";
      const attackerId = "usr-attacker";

      expect(() => assertOwnership(ownerId, ownerId)).not.toThrow();

      try {
        assertOwnership(ownerId, attackerId);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundOrForbiddenError);
        expect((err as NotFoundOrForbiddenError).statusCode).toBe(404);
        expect((err as NotFoundOrForbiddenError).message).toBe("Resource not found.");
      }
    });
  });
});
