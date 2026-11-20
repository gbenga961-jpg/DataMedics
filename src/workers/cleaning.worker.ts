/**
 * DataMedics Cleaning Worker (PRD §9, §11, §16, §18, §20)
 *
 * Publication sequence (PRD §11.3):
 * 1.  Load CleaningRun from repository (authoritative state source)
 * 2.  Guard: already COMPLETED → idempotent success
 * 3.  Guard: attempts >= maxAttempts → mark FAILED permanently
 * 4.  Atomically claim the job (increment attempts, set lease)
 * 5.  Load original CSV from private storage via report → upload → storageKey
 * 6.  Parse original CSV (read-only — source file is NEVER modified)
 * 7.  Execute the 3 approved operations in fixed order
 * 8.  Generate & validate canonical CSV output
 * 9.  Generate & validate spreadsheet-safe export representation (J04)
 * 10. Store both canonical and safe-export objects in private storage
 * 11. Confirm physical storage persistence
 * 12. Create CleanedFile record with 30-day retention and protection counts
 * 13. Run post-cleaning detection on cleaned output
 * 14. Persist CleaningResultIssue records (isolated from DataQualityIssue)
 * 15. Mark CleaningRun COMPLETED with full metrics
 *
 * On any unrecoverable error: markCleaningRunFailed with appropriate errorCode.
 * On transient error: markCleaningRunFailed with canRetry=true.
 */

import { getDataRepository, DataRepository } from "@/services/repository";
import { getStorageProvider, StorageProvider, generateStorageKey } from "@/lib/storage";
import { JobStatus, CleaningOperation, IssueType, DetectionStatus } from "@/types/models";
import { CleaningOptions } from "@/types/cleaning";
import { parseCsv } from "@/engine/csv/parser";
import { executeCleaning } from "@/engine/cleaning/runner";
import { serializeToCanonicalCsv } from "@/engine/cleaning/serializer";
import { neutralizeFormulas, generateCleanedFilename } from "@/engine/export";
import { runDataQualityAnalysis } from "@/engine/detection/aggregator";
import { CleaningJobPayload } from "@/types/jobs";

const LEASE_DURATION_MS = 5 * 60 * 1000; // 5-minute lease per attempt
const CLEANED_FILE_RETENTION_DAYS = 30; // PRD §21.5

export async function processCleaningJob(
  payload: CleaningJobPayload,
  customRepo?: DataRepository,
  customStorage?: StorageProvider
): Promise<void> {
  const repo = customRepo ?? getDataRepository();
  const storage = customStorage ?? getStorageProvider();

  const { cleaningRunId } = payload;

  // ── Step 1: Load CleaningRun ─────────────────────────────────────────────
  const run = await repo.getCleaningRun(cleaningRunId);
  if (!run) {
    throw new Error(`CleaningRun not found: ${cleaningRunId}`);
  }

  // ── Step 2: Idempotency guard ────────────────────────────────────────────
  if (run.status === JobStatus.COMPLETED) {
    return; // Already done — safe to return
  }

  // ── Step 3: Attempt limit guard ──────────────────────────────────────────
  if (run.attempts >= run.maxAttempts) {
    await repo.markCleaningRunFailed(run.id, "MAX_ATTEMPTS_EXHAUSTED", false);
    return;
  }

  // ── Step 4: Claim the job ────────────────────────────────────────────────
  const claimed = await repo.claimCleaningRun(run.id, LEASE_DURATION_MS);
  if (!claimed) {
    return;
  }

  try {
    // ── Step 5: Load original file ─────────────────────────────────────────
    const report = await repo.getAnalysisReport(run.reportId);
    if (!report) {
      await repo.markCleaningRunFailed(run.id, "REPORT_NOT_FOUND", false);
      return;
    }

    const upload = await repo.getUploadedFile(report.uploadedFileId);
    if (!upload) {
      await repo.markCleaningRunFailed(run.id, "UPLOAD_NOT_FOUND", false);
      return;
    }

    // Check if source upload has expired or been deleted
    if (upload.fileDeletedAt || (upload.expiresAt && upload.expiresAt < new Date())) {
      await repo.markCleaningRunFailed(run.id, "SOURCE_FILE_EXPIRED_OR_DELETED", false);
      return;
    }

    let originalBuffer: Buffer;
    try {
      originalBuffer = await storage.getObject(upload.storageKey);
    } catch {
      await repo.markCleaningRunFailed(run.id, "SOURCE_FILE_NOT_FOUND", false);
      return;
    }

    // ── Step 6: Parse original CSV (read-only) ─────────────────────────────
    let originalHeaders: string[];
    let originalRows: string[][];

    try {
      const parseResult = parseCsv(originalBuffer);
      originalHeaders = parseResult.headers;
      originalRows = parseResult.rows;
    } catch {
      await repo.markCleaningRunFailed(run.id, "PARSE_FAILED", false);
      return;
    }

    // ── Step 7: Execute cleaning operations ───────────────────────────────
    const options: CleaningOptions = {
      trimWhitespace: run.selectedOperations.includes(CleaningOperation.TRIM_WHITESPACE),
      removeBlankRows: run.selectedOperations.includes(CleaningOperation.REMOVE_BLANK_ROWS),
      removeDuplicateRows: run.selectedOperations.includes(CleaningOperation.REMOVE_DUPLICATE_ROWS),
    };

    const { outputHeaders, outputRows, metrics } = executeCleaning(
      originalHeaders,
      originalRows,
      options
    );

    // ── Step 8: Generate & validate canonical CSV output ───────────────────
    const canonicalCsvString = serializeToCanonicalCsv(outputHeaders, outputRows);
    const canonicalBuffer = Buffer.from(canonicalCsvString, "utf-8");

    // Validate canonical output
    try {
      const canonicalCheck = parseCsv(canonicalBuffer);
      if (
        canonicalCheck.headers.length !== outputHeaders.length ||
        canonicalCheck.rows.length !== outputRows.length
      ) {
        throw new Error("Canonical CSV validation row/column count mismatch");
      }
    } catch {
      await repo.markCleaningRunFailed(run.id, "CANONICAL_OUTPUT_VALIDATION_FAILED", false);
      return;
    }

    // ── Step 9: Generate & validate spreadsheet-safe export (J04) ──────────
    const { safeHeaders, safeRows, exportProtectedValueCount } = neutralizeFormulas(
      outputHeaders,
      outputRows
    );
    metrics.exportProtectedValueCount = exportProtectedValueCount;

    const safeCsvString = serializeToCanonicalCsv(safeHeaders, safeRows);
    const safeBuffer = Buffer.from(safeCsvString, "utf-8");

    // Validate spreadsheet-safe output
    try {
      const safeCheck = parseCsv(safeBuffer);
      if (
        safeCheck.headers.length !== safeHeaders.length ||
        safeCheck.rows.length !== safeRows.length
      ) {
        throw new Error("Safe export CSV validation row/column count mismatch");
      }
    } catch {
      await repo.markCleaningRunFailed(run.id, "SAFE_OUTPUT_VALIDATION_FAILED", false);
      return;
    }

    // ── Step 10 & 11: Store both final objects privately & confirm ─────────
    const canonicalKey = generateStorageKey("canonical", "csv");
    const safeExportKey = generateStorageKey("safe-export", "csv");

    await storage.putObject(canonicalKey, canonicalBuffer, "text/csv");
    await storage.putObject(safeExportKey, safeBuffer, "text/csv");

    // Confirm both objects are accessible in storage
    try {
      await storage.getObject(canonicalKey);
      await storage.getObject(safeExportKey);
    } catch {
      await repo.markCleaningRunFailed(run.id, "STORAGE_CONFIRMATION_FAILED", true);
      return;
    }

    // ── Step 12: Create CleanedFile record ────────────────────────────────
    const cleanFilename = generateCleanedFilename(upload.filename);
    const expiresAt = new Date(Date.now() + CLEANED_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    await repo.createCleanedFile({
      cleaningRunId: run.id,
      filename: cleanFilename,
      canonicalStorageKey: canonicalKey,
      safeExportStorageKey: safeExportKey,
      fileSizeBytes: safeBuffer.length,
      rowCount: outputRows.length,
      columnCount: outputHeaders.length,
      exportProtectedValueCount,
      expiresAt,
    });

    // ── Step 13: Run post-cleaning detection on canonical output ──────────
    const analysisResult = runDataQualityAnalysis(outputHeaders, outputRows);

    // ── Step 14: Persist CleaningResultIssue records ──────────────────────
    const resultIssues = analysisResult.detailedFindings.map((finding) => ({
      cleaningRunId: run.id,
      issueType: finding.issueType as IssueType,
      affectedColumn: finding.affectedColumn,
      issueCount: finding.issueCount,
      recommendation: finding.recommendation,
      detectionStatus: finding.detectionStatus as DetectionStatus,
      detectedPattern: finding.detectedPattern ?? null,
      details: finding.details ?? null,
    }));

    if (resultIssues.length > 0) {
      await repo.createCleaningResultIssues(resultIssues);
    }

    // ── Step 15: Mark CleaningRun COMPLETED ───────────────────────────────
    await repo.markCleaningRunCompleted(run.id, metrics);
  } catch (error: unknown) {
    const errorCode =
      error instanceof Error ? error.message.slice(0, 100) : "UNEXPECTED_ERROR";
    await repo.markCleaningRunFailed(run.id, errorCode, true);
  }
}
