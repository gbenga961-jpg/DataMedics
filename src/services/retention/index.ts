/**
 * Retention & Deletion Service (PRD §21, Amendment J06)
 *
 * Implements retention policies and safe deletion coordination:
 * 1. Successful original file: 30 days after successful analysis completion.
 * 2. Permanently failed original file: 7 days after final permanent failure.
 * 3. Cleaned output objects: 30 days after creation.
 * 4. Multiple reports per upload:
 *    - Active or retry-eligible analysis blocks deletion.
 *    - At least one success -> 30 days from most recent success.
 *    - All fail -> 7 days from final failure.
 * 5. Safe deletion workflow:
 *    - Mark PENDING in DB.
 *    - Confirm no active job requires the file.
 *    - Request deletion from private storage.
 *    - Confirm physical deletion before marking COMPLETED.
 *    - Retry temporary failures without premature completion.
 *    - Track canonical and safe-export objects separately.
 *    - Preserve permitted historical metadata.
 */

import { getDataRepository, DataRepository } from "@/services/repository";
import { getStorageProvider, StorageProvider } from "@/lib/storage";
import { JobStatus, DeletionStatus, UploadedFile, CleanedFile } from "@/types/models";

export const SUCCESSFUL_ANALYSIS_RETENTION_DAYS = 30;
export const FAILED_ANALYSIS_RETENTION_DAYS = 7;
export const CLEANED_FILE_RETENTION_DAYS = 30;

export interface ExpiryEvaluationResult {
  uploadId: string;
  isEligibleForDeletion: boolean;
  blockedReason?: string;
  applicableRetentionDays?: number;
  newExpiresAt?: Date;
}

export interface DeletionExecutionSummary {
  inspectedUploads: number;
  deletedUploads: number;
  failedUploads: number;
  inspectedCleanedFiles: number;
  deletedCleanedFiles: number;
  failedCleanedFiles: number;
}

/**
 * Evaluates an upload and its associated analysis reports to determine the
 * authoritative retention expiration and whether it is safe to delete.
 * PRD §21.4 (Multiple analysis reports per upload)
 */
export async function evaluateUploadRetention(
  upload: UploadedFile,
  repo: DataRepository = getDataRepository()
): Promise<ExpiryEvaluationResult> {
  // If already deleted, not eligible
  if (upload.fileDeletedAt || upload.deletionStatus === DeletionStatus.COMPLETED) {
    return { uploadId: upload.id, isEligibleForDeletion: false, blockedReason: "ALREADY_DELETED" };
  }

  const reports = await repo.getReportsByUpload(upload.id);
  if (reports.length === 0) {
    const isExpired = upload.expiresAt ? upload.expiresAt <= new Date() : false;
    return {
      uploadId: upload.id,
      isEligibleForDeletion: isExpired,
      blockedReason: isExpired ? undefined : "NO_REPORTS_PENDING_INITIAL_ANALYSIS",
    };
  }

  // Check all processing jobs across all reports
  let hasActiveOrRetryEligibleJob = false;
  let hasSuccessfulReport = false;
  let latestSuccessCompletedAt: Date | null = null;
  let latestFinalFailureAt: Date | null = null;
  let allReportsFailed = true;

  for (const report of reports) {
    const job = await repo.getProcessingJobByReport(report.id);
    if (job) {
      // Active job
      if (job.status === JobStatus.PROCESSING) {
        hasActiveOrRetryEligibleJob = true;
      }
      // Retry-eligible job
      if (job.status === JobStatus.QUEUED && job.attempts < job.maxAttempts) {
        hasActiveOrRetryEligibleJob = true;
      }
    }

    // Check cleaning runs that might still need the source
    const cleaningRuns = await repo.getCleaningRunsByReport(report.id);
    for (const run of cleaningRuns) {
      if (run.status === JobStatus.PROCESSING || (run.status === JobStatus.QUEUED && run.attempts < run.maxAttempts)) {
        hasActiveOrRetryEligibleJob = true;
      }
    }

    if (report.status === JobStatus.COMPLETED && report.completedAt) {
      hasSuccessfulReport = true;
      allReportsFailed = false;
      if (!latestSuccessCompletedAt || report.completedAt > latestSuccessCompletedAt) {
        latestSuccessCompletedAt = report.completedAt;
      }
    } else if (report.status !== JobStatus.FAILED) {
      allReportsFailed = false;
    } else if (job && job.status === JobStatus.FAILED && job.finishedAt) {
      if (!latestFinalFailureAt || job.finishedAt > latestFinalFailureAt) {
        latestFinalFailureAt = job.finishedAt;
      }
    }
  }

  // Active or retry-eligible jobs strictly block deletion (PRD §21.4)
  if (hasActiveOrRetryEligibleJob) {
    return {
      uploadId: upload.id,
      isEligibleForDeletion: false,
      blockedReason: "ACTIVE_OR_RETRY_ELIGIBLE_JOB",
    };
  }

  // If at least one analysis succeeded: 30 days from most recent completion
  if (hasSuccessfulReport && latestSuccessCompletedAt) {
    const expiresAt = new Date(
      latestSuccessCompletedAt.getTime() + SUCCESSFUL_ANALYSIS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const now = new Date();
    return {
      uploadId: upload.id,
      isEligibleForDeletion: expiresAt <= now,
      applicableRetentionDays: SUCCESSFUL_ANALYSIS_RETENTION_DAYS,
      newExpiresAt: expiresAt,
    };
  }

  // If all analyses permanently failed: 7 days from final failure (PRD §21.3)
  if (allReportsFailed && latestFinalFailureAt) {
    const expiresAt = new Date(
      latestFinalFailureAt.getTime() + FAILED_ANALYSIS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const now = new Date();
    return {
      uploadId: upload.id,
      isEligibleForDeletion: expiresAt <= now,
      applicableRetentionDays: FAILED_ANALYSIS_RETENTION_DAYS,
      newExpiresAt: expiresAt,
    };
  }

  // Standard fallback to upload.expiresAt
  const isExpired = upload.expiresAt ? upload.expiresAt <= new Date() : false;
  return {
    uploadId: upload.id,
    isEligibleForDeletion: isExpired,
  };
}

/**
 * Safely executes physical deletion of an expired original file.
 * PRD §21.6:
 * - Mark PENDING before storage deletion.
 * - Confirm physical deletion before marking COMPLETED.
 * - If storage deletion fails, mark FAILED and do not report completed.
 */
export async function deleteExpiredUpload(
  upload: UploadedFile,
  repo: DataRepository = getDataRepository(),
  storage: StorageProvider = getStorageProvider()
): Promise<boolean> {
  // Verify no active job needs it right now
  const evaluation = await evaluateUploadRetention(upload, repo);
  if (!evaluation.isEligibleForDeletion) {
    return false;
  }

  // 1. Mark deletion pending in DB
  await repo.markUploadDeletionPending(upload.id);

  // 2. Request physical deletion from object storage
  try {
    await storage.deleteObject(upload.storageKey);
  } catch {
    // Record failed state; do not report deletion as complete
    await repo.markUploadDeletionFailed(upload.id);
    return false;
  }

  // 3. Mark deletion completed in DB only after storage confirms success
  await repo.markUploadDeleted(upload.id);
  return true;
}

/**
 * Safely executes physical deletion of an expired cleaned file.
 * Tracks canonical and safe-export objects separately (PRD §21.5, §21.6).
 */
export async function deleteExpiredCleanedFile(
  file: CleanedFile,
  repo: DataRepository = getDataRepository(),
  storage: StorageProvider = getStorageProvider()
): Promise<boolean> {
  // If already fully deleted
  if (file.fileDeletedAt || file.deletionStatus === DeletionStatus.COMPLETED) {
    return false;
  }

  // 1. Mark deletion pending in DB
  await repo.markCleanedFileDeletionPending(file.id);

  let canonicalSuccess = false;
  let safeSuccess = false;

  // 2. Delete canonical object if not already deleted
  if (!file.canonicalFileDeletedAt) {
    try {
      await storage.deleteObject(file.canonicalStorageKey);
      await repo.markCleanedFileDeleted(file.id, "canonical");
      canonicalSuccess = true;
    } catch {
      await repo.markCleanedFileDeletionFailed(file.id);
    }
  } else {
    canonicalSuccess = true;
  }

  // 3. Delete safe-export object if different key and not already deleted
  if (!file.safeExportFileDeletedAt) {
    if (file.safeExportStorageKey === file.canonicalStorageKey) {
      // Points to same key — already deleted
      await repo.markCleanedFileDeleted(file.id, "safe-export");
      safeSuccess = true;
    } else {
      try {
        await storage.deleteObject(file.safeExportStorageKey);
        await repo.markCleanedFileDeleted(file.id, "safe-export");
        safeSuccess = true;
      } catch {
        await repo.markCleanedFileDeletionFailed(file.id);
      }
    }
  } else {
    safeSuccess = true;
  }

  return canonicalSuccess && safeSuccess;
}

/**
 * Runs a complete retention inspection and deletion pass.
 * Can be run periodically by the expiry worker or on schedule.
 */
export async function processRetentionAndDeletion(
  now: Date = new Date(),
  customRepo?: DataRepository,
  customStorage?: StorageProvider
): Promise<DeletionExecutionSummary> {
  const repo = customRepo ?? getDataRepository();
  const storage = customStorage ?? getStorageProvider();

  let inspectedUploads = 0;
  let deletedUploads = 0;
  let failedUploads = 0;
  let inspectedCleanedFiles = 0;
  let deletedCleanedFiles = 0;
  let failedCleanedFiles = 0;

  // 1. Process expired uploads
  const expiredUploads = await repo.listExpiredUploads(now);
  inspectedUploads = expiredUploads.length;

  for (const upload of expiredUploads) {
    const success = await deleteExpiredUpload(upload, repo, storage);
    if (success) {
      deletedUploads++;
    } else {
      failedUploads++;
    }
  }

  // 2. Process expired cleaned files
  const expiredCleaned = await repo.listExpiredCleanedFiles(now);
  inspectedCleanedFiles = expiredCleaned.length;

  for (const cleaned of expiredCleaned) {
    const success = await deleteExpiredCleanedFile(cleaned, repo, storage);
    if (success) {
      deletedCleanedFiles++;
    } else {
      failedCleanedFiles++;
    }
  }

  return {
    inspectedUploads,
    deletedUploads,
    failedUploads,
    inspectedCleanedFiles,
    deletedCleanedFiles,
    failedCleanedFiles,
  };
}
