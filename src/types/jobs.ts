/**
 * DataMedics Background Queue & Reliability Types (PRD §16 and background-job-reliability skill)
 */

export const ANALYSIS_QUEUE_NAME = "analysis-jobs";
export const CLEANING_QUEUE_NAME = "cleaning-jobs";
export const EXPIRY_QUEUE_NAME = "expiry-jobs";

export interface AnalysisJobPayload {
  processingJobId: string;
  reportId: string;
  uploadedFileId: string;
  storageKey: string;
  userId: string;
}

export interface CleaningJobPayload {
  cleaningRunId: string;
  reportId: string;
  userId: string;
  idempotencyKey: string;
  requestFingerprint: string;
}

export interface ExpiryJobPayload {
  uploadedFileId?: string;
  cleanedFileId?: string;
  targetDate: string;
}

export interface WorkerLeaseInfo {
  lastHeartbeatAt: Date;
  leaseExpiresAt: Date;
  workerId: string;
}
