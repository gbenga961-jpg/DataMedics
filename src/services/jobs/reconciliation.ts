/**
 * Job Reconciliation & Crash Recovery (PRD §16.4, §16.7)
 * - Detects stale PROCESSING jobs with expired leases.
 * - Respects retry limits and resets to QUEUED only if attempts remain.
 * - Never resets completed jobs.
 */

import { getDataRepository } from "@/services/repository";
import { JobStatus } from "@/types/models";

export interface ReconciliationSummary {
  inspectedCount: number;
  recoveredCount: number;
  failedCount: number;
}

export async function reconcileStaleJobs(
  staleGracePeriodMs: number = 60000,
  customRepo?: ReturnType<typeof getDataRepository>
): Promise<ReconciliationSummary> {
  const repo = customRepo ?? getDataRepository();
  const threshold = new Date(Date.now() - staleGracePeriodMs);

  const staleJobs = await repo.listStaleProcessingJobs(threshold);
  let recoveredCount = 0;
  let failedCount = 0;

  for (const job of staleJobs) {
    if (job.status === JobStatus.COMPLETED) {
      continue; // Inviolable rule: Never reset a completed job
    }

    if (job.attempts < job.maxAttempts) {
      // Re-enqueue
      await repo.markJobFailed(job.id, "WORKER_CRASH_OR_TIMEOUT", true);
      await repo.updateReportStatus(job.reportId, JobStatus.QUEUED, undefined, "RECOVERED_AFTER_TIMEOUT");
      recoveredCount++;
    } else {
      // Max attempts exhausted
      await repo.markJobFailed(job.id, "MAX_ATTEMPTS_EXHAUSTED", false);
      await repo.updateReportStatus(job.reportId, JobStatus.FAILED, undefined, "ATTEMPTS_EXHAUSTED");
      failedCount++;
    }
  }

  return {
    inspectedCount: staleJobs.length,
    recoveredCount,
    failedCount,
  };
}

/**
 * Reconcile stale CleaningRun records (PRD §16.7)
 * Mirrors the analysis-job reconciliation pattern for CleaningRun.
 */
export async function reconcileStaleCleaningRuns(
  staleGracePeriodMs: number = 60000,
  customRepo?: ReturnType<typeof getDataRepository>
): Promise<ReconciliationSummary> {
  const repo = customRepo ?? getDataRepository();
  const threshold = new Date(Date.now() - staleGracePeriodMs);

  const staleRuns = await repo.listStaleCleaningRuns(threshold);
  let recoveredCount = 0;
  let failedCount = 0;

  for (const run of staleRuns) {
    if (run.status === JobStatus.COMPLETED) {
      continue; // Inviolable: never reset a completed run
    }

    if (run.attempts < run.maxAttempts) {
      await repo.markCleaningRunFailed(run.id, "WORKER_CRASH_OR_TIMEOUT", true);
      recoveredCount++;
    } else {
      await repo.markCleaningRunFailed(run.id, "MAX_ATTEMPTS_EXHAUSTED", false);
      failedCount++;
    }
  }

  return {
    inspectedCount: staleRuns.length,
    recoveredCount,
    failedCount,
  };
}
