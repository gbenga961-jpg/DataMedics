/**
 * Job & Queue Service Boundaries (PRD §16, §17)
 */

export interface JobService {
  enqueueAnalysisJob(processingJobId: string, reportId: string, uploadedFileId: string, storageKey: string, userId: string): Promise<void>;
  enqueueCleaningJob(cleaningRunId: string, reportId: string, userId: string, idempotencyKey: string, fingerprint: string): Promise<void>;
}
