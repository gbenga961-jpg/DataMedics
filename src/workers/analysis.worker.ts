/**
 * Analysis Worker Implementation (PRD §16, §20 and background-job-reliability skill)
 * - PostgreSQL is authoritative source of truth.
 * - Idempotent execution (completed jobs are never reprocessed).
 * - Max 3 attempts with safe backoff delays.
 * - Heartbeat and lease management.
 * - Safe logging (no raw CSV, no secrets).
 */

import { getDataRepository } from "@/services/repository";
import { getStorageProvider } from "@/lib/storage";
import { parseCsv } from "@/engine/csv/parser";
import { runDataQualityAnalysis } from "@/engine/detection/aggregator";
import { JobStatus, IssueType, DetectionStatus } from "@/types/models";
import { AnalysisJobPayload } from "@/types/jobs";

const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface WorkerExecutionResult {
  success: boolean;
  jobId: string;
  reportId: string;
  status: JobStatus;
  totalIssues?: number;
  errorCode?: string;
}

/**
 * Executes a single analysis job in accordance with PRD §16.5 and §16.6.
 */
export async function processAnalysisJob(
  payload: AnalysisJobPayload,
  customRepo?: ReturnType<typeof getDataRepository>,
  customStorage?: ReturnType<typeof getStorageProvider>
): Promise<WorkerExecutionResult> {
  const repo = customRepo ?? getDataRepository();
  const storage = customStorage ?? getStorageProvider();
  const startTime = Date.now();

  const job = await repo.getProcessingJob(payload.processingJobId);
  if (!job) {
    return {
      success: false,
      jobId: payload.processingJobId,
      reportId: payload.reportId,
      status: JobStatus.FAILED,
      errorCode: "JOB_RECORD_NOT_FOUND",
    };
  }

  // 1. Idempotency check: A completed job must not be processed again
  if (job.status === JobStatus.COMPLETED) {
    return {
      success: true,
      jobId: job.id,
      reportId: payload.reportId,
      status: JobStatus.COMPLETED,
    };
  }

  // 2. Atomically claim job and set lease
  const claimed = await repo.claimProcessingJob(job.id, LEASE_DURATION_MS);
  if (!claimed) {
    return {
      success: false,
      jobId: job.id,
      reportId: payload.reportId,
      status: job.status,
      errorCode: "UNABLE_TO_CLAIM_JOB",
    };
  }

  // Update report to PROCESSING
  await repo.updateReportStatus(payload.reportId, JobStatus.PROCESSING);

  try {
    // 3. Retrieve source file privately
    const fileBuffer = await storage.getObject(payload.storageKey);

    // 4. Parse CSV safely
    const parsed = parseCsv(fileBuffer);

    // 5. Run data-quality detection rules
    const { summary, detailedFindings, totalIssueInstances } = runDataQualityAnalysis(
      parsed.headers,
      parsed.rows
    );

    // 6. Persist findings
    await repo.createDataQualityIssues(
      detailedFindings.map((df) => ({
        reportId: payload.reportId,
        issueType: df.issueType,
        affectedColumn: df.affectedColumn,
        issueCount: df.issueCount,
        title: df.title,
        description: df.description,
        recommendation: df.recommendation,
        detectionStatus: df.detectionStatus,
        detectedPattern: df.detectedPattern,
        matchingValueCount: df.matchingValueCount ?? 0,
        nonMatchingValueCount: df.nonMatchingValueCount ?? 0,
        unclassifiedValueCount: df.unclassifiedValueCount ?? 0,
        totalNonEmptyValueCount: df.totalNonEmptyValueCount ?? 0,
        matchPercentage: df.matchPercentage ?? null,
        recognisedPatterns: null,
        details: (df.details as Record<string, unknown>) ?? null,
      }))
    );

    // 7. Mark report and job completed
    await repo.updateReportStatus(
      payload.reportId,
      JobStatus.COMPLETED,
      totalIssueInstances
    );
    await repo.markJobCompleted(job.id);

    return {
      success: true,
      jobId: job.id,
      reportId: payload.reportId,
      status: JobStatus.COMPLETED,
      totalIssues: totalIssueInstances,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown analysis failure";
    const isPermanent = errorMsg.includes("not found") || errorMsg.includes("MALFORMED");

    const failureOutcome = await repo.markJobFailed(
      job.id,
      isPermanent ? "PERMANENT_ANALYSIS_ERROR" : "TEMPORARY_PROCESSING_ERROR",
      !isPermanent
    );

    await repo.updateReportStatus(
      payload.reportId,
      failureOutcome.shouldRetry ? JobStatus.QUEUED : JobStatus.FAILED,
      0,
      isPermanent ? "PERMANENT_ERROR" : "PROCESSING_RETRY"
    );

    return {
      success: false,
      jobId: job.id,
      reportId: payload.reportId,
      status: failureOutcome.shouldRetry ? JobStatus.QUEUED : JobStatus.FAILED,
      errorCode: failureOutcome.shouldRetry ? "RETRY_SCHEDULED" : "FINAL_FAILURE",
    };
  }
}
