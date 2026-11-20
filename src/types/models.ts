/**
 * DataMedics Core Data Models & Enums (PRD §15)
 * Version 1 approved baseline: 8 core models.
 */

export enum UploadStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  DELETED = "DELETED",
}

export enum JobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum IssueType {
  MISSING_VALUES = "MISSING_VALUES",
  EXACT_DUPLICATE_ROWS = "EXACT_DUPLICATE_ROWS",
  INCONSISTENT_FORMATS = "INCONSISTENT_FORMATS",
  UNNECESSARY_WHITESPACE = "UNNECESSARY_WHITESPACE",
}

export enum DetectionStatus {
  DETECTED = "DETECTED",
  NONE_DETECTED = "NONE_DETECTED",
  NOT_ASSESSED = "NOT_ASSESSED",
}

export enum CleaningOperation {
  TRIM_WHITESPACE = "TRIM_WHITESPACE",
  REMOVE_BLANK_ROWS = "REMOVE_BLANK_ROWS",
  REMOVE_DUPLICATE_ROWS = "REMOVE_DUPLICATE_ROWS",
}

export enum DeletionStatus {
  NOT_SCHEDULED = "NOT_SCHEDULED",
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadedFile {
  id: string;
  userId: string;
  filename: string;
  storageKey: string;
  fileSizeBytes: number;
  mimeType: string;
  rowCount: number | null;
  columnCount: number | null;
  uploadStatus: UploadStatus;
  uploadedAt: Date;
  expiresAt: Date | null;
  deletionRequestedAt: Date | null;
  deletionStatus: DeletionStatus;
  fileDeletedAt: Date | null;
  deletedAt: Date | null;
}

export interface AnalysisReport {
  id: string;
  uploadedFileId: string;
  status: JobStatus;
  analysisDate: Date;
  completedAt: Date | null;
  totalIssues: number;
  totalRows: number;
  totalColumns: number;
  ruleVersion: string;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataQualityIssue {
  id: string;
  reportId: string;
  issueType: IssueType;
  affectedColumn: string;
  issueCount: number;
  title: string;
  description: string;
  recommendation: string;
  detectionStatus: DetectionStatus;
  detectedPattern: string | null;
  matchingValueCount: number;
  nonMatchingValueCount: number;
  unclassifiedValueCount: number;
  totalNonEmptyValueCount: number;
  matchPercentage: number | null;
  recognisedPatterns: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ProcessingJob {
  id: string;
  reportId: string;
  queueJobId: string | null;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CleaningRun {
  id: string;
  userId: string;
  reportId: string;
  queueJobId: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string;
  status: JobStatus;
  selectedOperations: CleaningOperation[];
  attempts: number;
  maxAttempts: number;
  originalRowCount: number;
  finalRowCount: number | null;
  whitespaceCellsTrimmed: number;
  blankRowsRemoved: number;
  duplicateRowsRemoved: number;
  exportProtectedValueCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CleanedFile {
  id: string;
  cleaningRunId: string;
  filename: string;
  canonicalStorageKey: string;
  safeExportStorageKey: string;
  fileSizeBytes: number;
  rowCount: number;
  columnCount: number;
  exportProtectedValueCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  deletionRequestedAt: Date | null;
  deletionStatus: DeletionStatus;
  canonicalFileDeletedAt: Date | null;
  safeExportFileDeletedAt: Date | null;
  fileDeletedAt: Date | null;
}

export interface CleaningResultIssue {
  id: string;
  cleaningRunId: string;
  issueType: IssueType;
  affectedColumn: string;
  issueCount: number;
  recommendation: string;
  detectionStatus: DetectionStatus;
  detectedPattern: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}
