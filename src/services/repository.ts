/**
 * DataMedics Authoritative Data Repository (PRD §15, §16)
 * PostgreSQL is the authoritative source for application states.
 * Provides durable records for all 8 approved core models.
 */

import {
  User,
  UploadedFile,
  AnalysisReport,
  DataQualityIssue,
  ProcessingJob,
  CleaningRun,
  CleanedFile,
  CleaningResultIssue,
  UploadStatus,
  JobStatus,
  DeletionStatus,
  CleaningOperation,
} from "@/types/models";
import { CleaningMetrics } from "@/types/cleaning";
import { randomUUID } from "crypto";

export interface DataRepository {
  // User operations
  createUser(email: string, passwordHash: string, name?: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;

  // Upload operations
  createUploadedFile(data: {
    userId: string;
    filename: string;
    storageKey: string;
    fileSizeBytes: number;
    mimeType: string;
    rowCount: number;
    columnCount: number;
    uploadStatus: UploadStatus;
    expiresAt: Date;
  }): Promise<UploadedFile>;
  getUploadedFile(id: string): Promise<UploadedFile | null>;
  listUploadedFilesByUser(userId: string): Promise<UploadedFile[]>;

  // Analysis Report operations
  createAnalysisReport(data: {
    uploadedFileId: string;
    totalRows: number;
    totalColumns: number;
  }): Promise<AnalysisReport>;
  getAnalysisReport(id: string): Promise<AnalysisReport | null>;
  listReportsByUser(userId: string): Promise<AnalysisReport[]>;
  updateReportStatus(
    id: string,
    status: JobStatus,
    totalIssues?: number,
    failureCode?: string
  ): Promise<AnalysisReport>;

  // Data Quality Issue operations
  createDataQualityIssues(issues: Array<Omit<DataQualityIssue, "id" | "createdAt">>): Promise<DataQualityIssue[]>;
  getIssuesByReport(reportId: string): Promise<DataQualityIssue[]>;

  // Processing Job operations
  createProcessingJob(data: {
    reportId: string;
    queueJobId?: string;
  }): Promise<ProcessingJob>;
  getProcessingJob(id: string): Promise<ProcessingJob | null>;
  getProcessingJobByReport(reportId: string): Promise<ProcessingJob | null>;
  claimProcessingJob(jobId: string, leaseDurationMs: number): Promise<boolean>;
  updateJobHeartbeat(jobId: string, leaseDurationMs: number): Promise<void>;
  markJobCompleted(jobId: string): Promise<void>;
  markJobFailed(jobId: string, errorCode: string, canRetry: boolean): Promise<{ shouldRetry: boolean; nextAttempt: number }>;
  listStaleProcessingJobs(leaseExpiredBefore: Date): Promise<ProcessingJob[]>;

  // ── CleaningRun operations ────────────────────────────────────────────────
  createCleaningRun(data: {
    userId: string;
    reportId: string;
    selectedOperations: CleaningOperation[];
    originalRowCount: number;
    idempotencyKey?: string;
    requestFingerprint: string;
    queueJobId?: string;
  }): Promise<CleaningRun>;
  getCleaningRun(id: string): Promise<CleaningRun | null>;
  getCleaningRunByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<CleaningRun | null>;
  claimCleaningRun(id: string, leaseDurationMs: number): Promise<boolean>;
  updateCleaningRunHeartbeat(id: string, leaseDurationMs: number): Promise<void>;
  markCleaningRunCompleted(id: string, metrics: CleaningMetrics): Promise<void>;
  markCleaningRunFailed(
    id: string,
    errorCode: string,
    canRetry: boolean
  ): Promise<{ shouldRetry: boolean; nextAttempt: number }>;
  listStaleCleaningRuns(leaseExpiredBefore: Date): Promise<CleaningRun[]>;

  // ── CleanedFile operations ────────────────────────────────────────────────
  createCleanedFile(data: {
    cleaningRunId: string;
    filename: string;
    canonicalStorageKey: string;
    safeExportStorageKey: string;
    fileSizeBytes: number;
    rowCount: number;
    columnCount: number;
    exportProtectedValueCount: number;
    expiresAt: Date | null;
  }): Promise<CleanedFile>;
  getCleanedFile(id: string): Promise<CleanedFile | null>;
  getCleanedFileByRun(cleaningRunId: string): Promise<CleanedFile | null>;

  // ── Retention & Deletion operations (PRD §21, Amendment J06) ─────────────
  updateUploadExpiry(uploadId: string, expiresAt: Date): Promise<void>;
  markUploadDeletionPending(uploadId: string): Promise<void>;
  markUploadDeleted(uploadId: string): Promise<void>;
  markUploadDeletionFailed(uploadId: string): Promise<void>;
  listExpiredUploads(now: Date): Promise<UploadedFile[]>;
  getReportsByUpload(uploadedFileId: string): Promise<AnalysisReport[]>;
  getProcessingJobsByUpload(uploadedFileId: string): Promise<ProcessingJob[]>;
  getCleaningRunsByReport(reportId: string): Promise<CleaningRun[]>;
  listExpiredCleanedFiles(now: Date): Promise<CleanedFile[]>;
  markCleanedFileDeletionPending(cleanedFileId: string): Promise<void>;
  markCleanedFileDeleted(
    cleanedFileId: string,
    target: "canonical" | "safe-export" | "both"
  ): Promise<void>;
  markCleanedFileDeletionFailed(cleanedFileId: string): Promise<void>;

  // ── CleaningResultIssue operations ────────────────────────────────────────
  createCleaningResultIssues(
    issues: Array<Omit<CleaningResultIssue, "id" | "createdAt">>
  ): Promise<CleaningResultIssue[]>;
  getCleaningResultIssues(cleaningRunId: string): Promise<CleaningResultIssue[]>;
}

export class MemoryDataRepository implements DataRepository {
  public users = new Map<string, User>();
  public uploads = new Map<string, UploadedFile>();
  public reports = new Map<string, AnalysisReport>();
  public issues: DataQualityIssue[] = [];
  public jobs = new Map<string, ProcessingJob>();
  public cleaningRuns = new Map<string, CleaningRun>();
  public cleanedFiles = new Map<string, CleanedFile>();
  public cleaningResultIssues: CleaningResultIssue[] = [];

  async createUser(email: string, passwordHash: string, name?: string): Promise<User> {
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error("User with this email already exists.");
    }
    const user: User = {
      id: `usr-${randomUUID()}`,
      email: email.toLowerCase().trim(),
      name: name ?? null,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === normalized) return user;
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async createUploadedFile(data: {
    userId: string;
    filename: string;
    storageKey: string;
    fileSizeBytes: number;
    mimeType: string;
    rowCount: number;
    columnCount: number;
    uploadStatus: UploadStatus;
    expiresAt: Date;
  }): Promise<UploadedFile> {
    const upload: UploadedFile = {
      id: `up-${randomUUID()}`,
      userId: data.userId,
      filename: data.filename,
      storageKey: data.storageKey,
      fileSizeBytes: data.fileSizeBytes,
      mimeType: data.mimeType,
      rowCount: data.rowCount,
      columnCount: data.columnCount,
      uploadStatus: data.uploadStatus,
      uploadedAt: new Date(),
      expiresAt: data.expiresAt,
      deletionRequestedAt: null,
      deletionStatus: DeletionStatus.NOT_SCHEDULED,
      fileDeletedAt: null,
      deletedAt: null,
    };
    this.uploads.set(upload.id, upload);
    return upload;
  }

  async getUploadedFile(id: string): Promise<UploadedFile | null> {
    return this.uploads.get(id) ?? null;
  }

  async listUploadedFilesByUser(userId: string): Promise<UploadedFile[]> {
    const list: UploadedFile[] = [];
    for (const file of this.uploads.values()) {
      if (file.userId === userId && !file.deletedAt) {
        list.push(file);
      }
    }
    return list.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async createAnalysisReport(data: {
    uploadedFileId: string;
    totalRows: number;
    totalColumns: number;
  }): Promise<AnalysisReport> {
    const report: AnalysisReport = {
      id: `rep-${randomUUID()}`,
      uploadedFileId: data.uploadedFileId,
      status: JobStatus.QUEUED,
      analysisDate: new Date(),
      completedAt: null,
      totalIssues: 0,
      totalRows: data.totalRows,
      totalColumns: data.totalColumns,
      ruleVersion: "1.0.0",
      failureCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reports.set(report.id, report);
    return report;
  }

  async getAnalysisReport(id: string): Promise<AnalysisReport | null> {
    return this.reports.get(id) ?? null;
  }

  async listReportsByUser(userId: string): Promise<AnalysisReport[]> {
    const userUploads = await this.listUploadedFilesByUser(userId);
    const uploadIds = new Set(userUploads.map((u) => u.id));
    const userReports: AnalysisReport[] = [];

    for (const report of this.reports.values()) {
      if (uploadIds.has(report.uploadedFileId)) {
        userReports.push(report);
      }
    }
    return userReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateReportStatus(
    id: string,
    status: JobStatus,
    totalIssues?: number,
    failureCode?: string
  ): Promise<AnalysisReport> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`Report not found: ${id}`);
    }
    report.status = status;
    report.updatedAt = new Date();
    if (totalIssues !== undefined) {
      report.totalIssues = totalIssues;
    }
    if (failureCode !== undefined) {
      report.failureCode = failureCode;
    }
    if (status === JobStatus.COMPLETED) {
      report.completedAt = new Date();
    }
    return report;
  }

  async createDataQualityIssues(
    issuesData: Array<Omit<DataQualityIssue, "id" | "createdAt">>
  ): Promise<DataQualityIssue[]> {
    const created: DataQualityIssue[] = issuesData.map((data) => ({
      ...data,
      id: `iss-${randomUUID()}`,
      createdAt: new Date(),
    }));
    this.issues.push(...created);
    return created;
  }

  async getIssuesByReport(reportId: string): Promise<DataQualityIssue[]> {
    return this.issues.filter((iss) => iss.reportId === reportId);
  }

  async createProcessingJob(data: {
    reportId: string;
    queueJobId?: string;
  }): Promise<ProcessingJob> {
    const job: ProcessingJob = {
      id: `job-${randomUUID()}`,
      reportId: data.reportId,
      queueJobId: data.queueJobId ?? null,
      status: JobStatus.QUEUED,
      attempts: 0,
      maxAttempts: 3,
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async getProcessingJobByReport(reportId: string): Promise<ProcessingJob | null> {
    for (const job of this.jobs.values()) {
      if (job.reportId === reportId) return job;
    }
    return null;
  }

  async claimProcessingJob(jobId: string, leaseDurationMs: number): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.status === JobStatus.COMPLETED) return false;

    job.status = JobStatus.PROCESSING;
    job.attempts += 1;
    const now = new Date();
    job.startedAt = now;
    job.lastHeartbeatAt = now;
    job.leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    job.updatedAt = now;
    return true;
  }

  async updateJobHeartbeat(jobId: string, leaseDurationMs: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const now = new Date();
    job.lastHeartbeatAt = now;
    job.leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    job.updatedAt = now;
  }

  async markJobCompleted(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = JobStatus.COMPLETED;
    job.finishedAt = new Date();
    job.updatedAt = new Date();
  }

  async markJobFailed(
    jobId: string,
    errorCode: string,
    canRetry: boolean
  ): Promise<{ shouldRetry: boolean; nextAttempt: number }> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Job not found");

    job.lastErrorCode = errorCode;
    job.updatedAt = new Date();

    const shouldRetry = canRetry && job.attempts < job.maxAttempts;
    if (shouldRetry) {
      job.status = JobStatus.QUEUED;
    } else {
      job.status = JobStatus.FAILED;
      job.finishedAt = new Date();
    }

    return { shouldRetry, nextAttempt: job.attempts + 1 };
  }

  async listStaleProcessingJobs(leaseExpiredBefore: Date): Promise<ProcessingJob[]> {
    const stale: ProcessingJob[] = [];
    for (const job of this.jobs.values()) {
      if (
        job.status === JobStatus.PROCESSING &&
        job.leaseExpiresAt &&
        job.leaseExpiresAt < leaseExpiredBefore
      ) {
        stale.push(job);
      }
    }
    return stale;
  }

  // ── CleaningRun ───────────────────────────────────────────────────────────

  async createCleaningRun(data: {
    userId: string;
    reportId: string;
    selectedOperations: CleaningOperation[];
    originalRowCount: number;
    idempotencyKey?: string;
    requestFingerprint: string;
    queueJobId?: string;
  }): Promise<CleaningRun> {
    const run: CleaningRun = {
      id: `cr-${randomUUID()}`,
      userId: data.userId,
      reportId: data.reportId,
      queueJobId: data.queueJobId ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
      requestFingerprint: data.requestFingerprint,
      status: JobStatus.QUEUED,
      selectedOperations: [...data.selectedOperations],
      attempts: 0,
      maxAttempts: 3,
      originalRowCount: data.originalRowCount,
      finalRowCount: null,
      whitespaceCellsTrimmed: 0,
      blankRowsRemoved: 0,
      duplicateRowsRemoved: 0,
      exportProtectedValueCount: 0,
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cleaningRuns.set(run.id, run);
    return run;
  }

  async getCleaningRun(id: string): Promise<CleaningRun | null> {
    return this.cleaningRuns.get(id) ?? null;
  }

  async getCleaningRunByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<CleaningRun | null> {
    for (const run of this.cleaningRuns.values()) {
      if (run.userId === userId && run.idempotencyKey === idempotencyKey) {
        return run;
      }
    }
    return null;
  }

  async claimCleaningRun(id: string, leaseDurationMs: number): Promise<boolean> {
    const run = this.cleaningRuns.get(id);
    if (!run) return false;
    if (run.status === JobStatus.COMPLETED) return false;
    if (run.status === JobStatus.FAILED) return false;

    const now = new Date();
    run.status = JobStatus.PROCESSING;
    run.attempts += 1;
    run.startedAt = run.startedAt ?? now;
    run.lastHeartbeatAt = now;
    run.leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    run.updatedAt = now;
    return true;
  }

  async updateCleaningRunHeartbeat(id: string, leaseDurationMs: number): Promise<void> {
    const run = this.cleaningRuns.get(id);
    if (!run) return;
    const now = new Date();
    run.lastHeartbeatAt = now;
    run.leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    run.updatedAt = now;
  }

  async markCleaningRunCompleted(id: string, metrics: CleaningMetrics): Promise<void> {
    const run = this.cleaningRuns.get(id);
    if (!run) throw new Error(`CleaningRun not found: ${id}`);
    const now = new Date();
    run.status = JobStatus.COMPLETED;
    run.finishedAt = now;
    run.updatedAt = now;
    run.finalRowCount = metrics.finalRowCount;
    run.whitespaceCellsTrimmed = metrics.whitespaceCellsTrimmed;
    run.blankRowsRemoved = metrics.blankRowsRemoved;
    run.duplicateRowsRemoved = metrics.duplicateRowsRemoved;
    run.exportProtectedValueCount = metrics.exportProtectedValueCount;
  }

  async markCleaningRunFailed(
    id: string,
    errorCode: string,
    canRetry: boolean
  ): Promise<{ shouldRetry: boolean; nextAttempt: number }> {
    const run = this.cleaningRuns.get(id);
    if (!run) throw new Error(`CleaningRun not found: ${id}`);

    run.lastErrorCode = errorCode;
    run.updatedAt = new Date();

    const shouldRetry = canRetry && run.attempts < run.maxAttempts;
    if (shouldRetry) {
      run.status = JobStatus.QUEUED;
    } else {
      run.status = JobStatus.FAILED;
      run.finishedAt = new Date();
    }

    return { shouldRetry, nextAttempt: run.attempts + 1 };
  }

  async listStaleCleaningRuns(leaseExpiredBefore: Date): Promise<CleaningRun[]> {
    const stale: CleaningRun[] = [];
    for (const run of this.cleaningRuns.values()) {
      if (
        run.status === JobStatus.PROCESSING &&
        run.leaseExpiresAt &&
        run.leaseExpiresAt < leaseExpiredBefore
      ) {
        stale.push(run);
      }
    }
    return stale;
  }

  // ── CleanedFile ───────────────────────────────────────────────────────────

  async createCleanedFile(data: {
    cleaningRunId: string;
    filename: string;
    canonicalStorageKey: string;
    safeExportStorageKey: string;
    fileSizeBytes: number;
    rowCount: number;
    columnCount: number;
    exportProtectedValueCount: number;
    expiresAt: Date | null;
  }): Promise<CleanedFile> {
    const file: CleanedFile = {
      id: `cf-${randomUUID()}`,
      cleaningRunId: data.cleaningRunId,
      filename: data.filename,
      canonicalStorageKey: data.canonicalStorageKey,
      safeExportStorageKey: data.safeExportStorageKey,
      fileSizeBytes: data.fileSizeBytes,
      rowCount: data.rowCount,
      columnCount: data.columnCount,
      exportProtectedValueCount: data.exportProtectedValueCount,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      deletionRequestedAt: null,
      deletionStatus: DeletionStatus.NOT_SCHEDULED,
      canonicalFileDeletedAt: null,
      safeExportFileDeletedAt: null,
      fileDeletedAt: null,
    };
    this.cleanedFiles.set(file.id, file);
    return file;
  }

  async getCleanedFile(id: string): Promise<CleanedFile | null> {
    return this.cleanedFiles.get(id) ?? null;
  }

  async getCleanedFileByRun(cleaningRunId: string): Promise<CleanedFile | null> {
    for (const file of this.cleanedFiles.values()) {
      if (file.cleaningRunId === cleaningRunId) return file;
    }
    return null;
  }

  // ── Retention & Deletion operations (PRD §21, Amendment J06) ─────────────

  async updateUploadExpiry(uploadId: string, expiresAt: Date): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    upload.expiresAt = expiresAt;
  }

  async markUploadDeletionPending(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    upload.deletionStatus = DeletionStatus.PENDING;
    upload.deletionRequestedAt = new Date();
  }

  async markUploadDeleted(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    const now = new Date();
    upload.deletionStatus = DeletionStatus.COMPLETED;
    upload.fileDeletedAt = now;
    upload.deletedAt = now;
  }

  async markUploadDeletionFailed(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    upload.deletionStatus = DeletionStatus.FAILED;
  }

  async listExpiredUploads(now: Date): Promise<UploadedFile[]> {
    const expired: UploadedFile[] = [];
    for (const file of this.uploads.values()) {
      if (
        file.expiresAt &&
        file.expiresAt <= now &&
        file.deletionStatus !== DeletionStatus.COMPLETED &&
        !file.fileDeletedAt
      ) {
        expired.push(file);
      }
    }
    return expired;
  }

  async getReportsByUpload(uploadedFileId: string): Promise<AnalysisReport[]> {
    const list: AnalysisReport[] = [];
    for (const report of this.reports.values()) {
      if (report.uploadedFileId === uploadedFileId) {
        list.push(report);
      }
    }
    return list;
  }

  async getProcessingJobsByReport(reportId: string): Promise<ProcessingJob[]> {
    const list: ProcessingJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.reportId === reportId) {
        list.push(job);
      }
    }
    return list;
  }

  async getProcessingJobsByUpload(uploadedFileId: string): Promise<ProcessingJob[]> {
    const reports = await this.getReportsByUpload(uploadedFileId);
    const reportIds = new Set(reports.map((r) => r.id));
    const list: ProcessingJob[] = [];
    for (const job of this.jobs.values()) {
      if (reportIds.has(job.reportId)) {
        list.push(job);
      }
    }
    return list;
  }

  async getCleaningRunsByReport(reportId: string): Promise<CleaningRun[]> {
    const list: CleaningRun[] = [];
    for (const run of this.cleaningRuns.values()) {
      if (run.reportId === reportId) {
        list.push(run);
      }
    }
    return list;
  }

  async listExpiredCleanedFiles(now: Date): Promise<CleanedFile[]> {
    const expired: CleanedFile[] = [];
    for (const file of this.cleanedFiles.values()) {
      if (
        file.expiresAt &&
        file.expiresAt <= now &&
        file.deletionStatus !== DeletionStatus.COMPLETED &&
        !file.fileDeletedAt
      ) {
        expired.push(file);
      }
    }
    return expired;
  }

  async markCleanedFileDeletionPending(cleanedFileId: string): Promise<void> {
    const file = this.cleanedFiles.get(cleanedFileId);
    if (!file) return;
    file.deletionStatus = DeletionStatus.PENDING;
    file.deletionRequestedAt = new Date();
  }

  async markCleanedFileDeleted(
    cleanedFileId: string,
    target: "canonical" | "safe-export" | "both"
  ): Promise<void> {
    const file = this.cleanedFiles.get(cleanedFileId);
    if (!file) return;
    const now = new Date();
    if (target === "canonical" || target === "both") {
      file.canonicalFileDeletedAt = now;
    }
    if (target === "safe-export" || target === "both") {
      file.safeExportFileDeletedAt = now;
    }
    if (file.canonicalFileDeletedAt && file.safeExportFileDeletedAt) {
      file.fileDeletedAt = now;
      file.deletionStatus = DeletionStatus.COMPLETED;
    }
  }

  async markCleanedFileDeletionFailed(cleanedFileId: string): Promise<void> {
    const file = this.cleanedFiles.get(cleanedFileId);
    if (!file) return;
    file.deletionStatus = DeletionStatus.FAILED;
  }

  // ── CleaningResultIssue ───────────────────────────────────────────────────

  async createCleaningResultIssues(
    issuesData: Array<Omit<CleaningResultIssue, "id" | "createdAt">>
  ): Promise<CleaningResultIssue[]> {
    const created: CleaningResultIssue[] = issuesData.map((data) => ({
      ...data,
      id: `cri-${randomUUID()}`,
      createdAt: new Date(),
    }));
    this.cleaningResultIssues.push(...created);
    return created;
  }

  async getCleaningResultIssues(cleaningRunId: string): Promise<CleaningResultIssue[]> {
    return this.cleaningResultIssues.filter((i) => i.cleaningRunId === cleaningRunId);
  }
}

let globalRepoInstance: DataRepository | null = null;

export function getDataRepository(): DataRepository {
  if (!globalRepoInstance) {
    globalRepoInstance = new MemoryDataRepository();
  }
  return globalRepoInstance;
}
