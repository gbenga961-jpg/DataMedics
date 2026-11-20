-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('MISSING_VALUES', 'EXACT_DUPLICATE_ROWS', 'INCONSISTENT_FORMATS', 'UNNECESSARY_WHITESPACE');

-- CreateEnum
CREATE TYPE "DetectionStatus" AS ENUM ('DETECTED', 'NONE_DETECTED', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "CleaningOperation" AS ENUM ('TRIM_WHITESPACE', 'REMOVE_BLANK_ROWS', 'REMOVE_DUPLICATE_ROWS');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('NOT_SCHEDULED', 'PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "rowCount" INTEGER,
    "columnCount" INTEGER,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionStatus" "DeletionStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "fileDeletedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisReport" (
    "id" TEXT NOT NULL,
    "uploadedFileId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "totalColumns" INTEGER NOT NULL DEFAULT 0,
    "ruleVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "affectedColumn" TEXT NOT NULL,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "detectionStatus" "DetectionStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "detectedPattern" TEXT,
    "matchingValueCount" INTEGER NOT NULL DEFAULT 0,
    "nonMatchingValueCount" INTEGER NOT NULL DEFAULT 0,
    "unclassifiedValueCount" INTEGER NOT NULL DEFAULT 0,
    "totalNonEmptyValueCount" INTEGER NOT NULL DEFAULT 0,
    "matchPercentage" DOUBLE PRECISION,
    "recognisedPatterns" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "queueJobId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "queueJobId" TEXT,
    "idempotencyKey" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "selectedOperations" "CleaningOperation"[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "originalRowCount" INTEGER NOT NULL,
    "finalRowCount" INTEGER,
    "whitespaceCellsTrimmed" INTEGER NOT NULL DEFAULT 0,
    "blankRowsRemoved" INTEGER NOT NULL DEFAULT 0,
    "duplicateRowsRemoved" INTEGER NOT NULL DEFAULT 0,
    "exportProtectedValueCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanedFile" (
    "id" TEXT NOT NULL,
    "cleaningRunId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "canonicalStorageKey" TEXT NOT NULL,
    "safeExportStorageKey" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "exportProtectedValueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionStatus" "DeletionStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "canonicalFileDeletedAt" TIMESTAMP(3),
    "safeExportFileDeletedAt" TIMESTAMP(3),
    "fileDeletedAt" TIMESTAMP(3),

    CONSTRAINT "CleanedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningResultIssue" (
    "id" TEXT NOT NULL,
    "cleaningRunId" TEXT NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "affectedColumn" TEXT NOT NULL,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "recommendation" TEXT NOT NULL,
    "detectionStatus" "DetectionStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "detectedPattern" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningResultIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UploadedFile_userId_idx" ON "UploadedFile"("userId");

-- CreateIndex
CREATE INDEX "UploadedFile_expiresAt_idx" ON "UploadedFile"("expiresAt");

-- CreateIndex
CREATE INDEX "AnalysisReport_uploadedFileId_idx" ON "AnalysisReport"("uploadedFileId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_reportId_idx" ON "DataQualityIssue"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_reportId_key" ON "ProcessingJob"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_queueJobId_key" ON "ProcessingJob"("queueJobId");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningRun_queueJobId_key" ON "CleaningRun"("queueJobId");

-- CreateIndex
CREATE INDEX "CleaningRun_reportId_idx" ON "CleaningRun"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningRun_userId_idempotencyKey_key" ON "CleaningRun"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CleanedFile_cleaningRunId_key" ON "CleanedFile"("cleaningRunId");

-- CreateIndex
CREATE INDEX "CleanedFile_expiresAt_idx" ON "CleanedFile"("expiresAt");

-- CreateIndex
CREATE INDEX "CleaningResultIssue_cleaningRunId_idx" ON "CleaningResultIssue"("cleaningRunId");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnalysisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnalysisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnalysisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanedFile" ADD CONSTRAINT "CleanedFile_cleaningRunId_fkey" FOREIGN KEY ("cleaningRunId") REFERENCES "CleaningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningResultIssue" ADD CONSTRAINT "CleaningResultIssue_cleaningRunId_fkey" FOREIGN KEY ("cleaningRunId") REFERENCES "CleaningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SQL CHECK Constraints (PRD §15.11)
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_fileSizeBytes_check" CHECK ("fileSizeBytes" >= 0);
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_rowCount_check" CHECK ("rowCount" IS NULL OR "rowCount" >= 0);
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_columnCount_check" CHECK ("columnCount" IS NULL OR "columnCount" >= 0);

ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_totalIssues_check" CHECK ("totalIssues" >= 0);
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_totalRows_check" CHECK ("totalRows" >= 0);
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_totalColumns_check" CHECK ("totalColumns" >= 0);

ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_issueCount_check" CHECK ("issueCount" >= 0);
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_matchingValueCount_check" CHECK ("matchingValueCount" >= 0);
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_nonMatchingValueCount_check" CHECK ("nonMatchingValueCount" >= 0);
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_unclassifiedValueCount_check" CHECK ("unclassifiedValueCount" >= 0);
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_totalNonEmptyValueCount_check" CHECK ("totalNonEmptyValueCount" >= 0);
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_matchPercentage_check" CHECK ("matchPercentage" IS NULL OR ("matchPercentage" >= 0 AND "matchPercentage" <= 100));

ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= "maxAttempts");
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_maxAttempts_check" CHECK ("maxAttempts" > 0);

ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= "maxAttempts");
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_maxAttempts_check" CHECK ("maxAttempts" > 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_originalRowCount_check" CHECK ("originalRowCount" >= 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_finalRowCount_check" CHECK ("finalRowCount" IS NULL OR "finalRowCount" >= 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_whitespaceCellsTrimmed_check" CHECK ("whitespaceCellsTrimmed" >= 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_blankRowsRemoved_check" CHECK ("blankRowsRemoved" >= 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_duplicateRowsRemoved_check" CHECK ("duplicateRowsRemoved" >= 0);
ALTER TABLE "CleaningRun" ADD CONSTRAINT "CleaningRun_exportProtectedValueCount_check" CHECK ("exportProtectedValueCount" >= 0);

ALTER TABLE "CleanedFile" ADD CONSTRAINT "CleanedFile_fileSizeBytes_check" CHECK ("fileSizeBytes" >= 0);
ALTER TABLE "CleanedFile" ADD CONSTRAINT "CleanedFile_rowCount_check" CHECK ("rowCount" >= 0);
ALTER TABLE "CleanedFile" ADD CONSTRAINT "CleanedFile_columnCount_check" CHECK ("columnCount" >= 0);
ALTER TABLE "CleanedFile" ADD CONSTRAINT "CleanedFile_exportProtectedValueCount_check" CHECK ("exportProtectedValueCount" >= 0);

ALTER TABLE "CleaningResultIssue" ADD CONSTRAINT "CleaningResultIssue_issueCount_check" CHECK ("issueCount" >= 0);
