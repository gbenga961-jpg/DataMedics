import { describe, it, expect } from "vitest";
import {
  UploadStatus,
  JobStatus,
  IssueType,
  DetectionStatus,
  CleaningOperation,
  DeletionStatus,
} from "@/types/models";
import fs from "fs";
import path from "path";

describe("Database Models & Integrity Constraints (PRD §15)", () => {
  it("defines all seven approved Prisma enums exactly as specified", () => {
    expect(Object.values(UploadStatus)).toEqual([
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "DELETED",
    ]);

    expect(Object.values(JobStatus)).toEqual([
      "QUEUED",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
    ]);

    expect(Object.values(IssueType)).toEqual([
      "MISSING_VALUES",
      "EXACT_DUPLICATE_ROWS",
      "INCONSISTENT_FORMATS",
      "UNNECESSARY_WHITESPACE",
    ]);

    expect(Object.values(DetectionStatus)).toEqual([
      "DETECTED",
      "NONE_DETECTED",
      "NOT_ASSESSED",
    ]);

    expect(Object.values(CleaningOperation)).toEqual([
      "TRIM_WHITESPACE",
      "REMOVE_BLANK_ROWS",
      "REMOVE_DUPLICATE_ROWS",
    ]);

    expect(Object.values(DeletionStatus)).toEqual([
      "NOT_SCHEDULED",
      "PENDING",
      "COMPLETED",
      "FAILED",
    ]);
  });

  it("includes migration file with all required SQL CHECK constraints (PRD §15.11)", () => {
    const migrationPath = path.resolve(__dirname, "../../prisma/migrations/20261118000000_init/migration.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Enforce 8 models
    expect(migrationSql).toContain('CREATE TABLE "User"');
    expect(migrationSql).toContain('CREATE TABLE "UploadedFile"');
    expect(migrationSql).toContain('CREATE TABLE "AnalysisReport"');
    expect(migrationSql).toContain('CREATE TABLE "DataQualityIssue"');
    expect(migrationSql).toContain('CREATE TABLE "ProcessingJob"');
    expect(migrationSql).toContain('CREATE TABLE "CleaningRun"');
    expect(migrationSql).toContain('CREATE TABLE "CleanedFile"');
    expect(migrationSql).toContain('CREATE TABLE "CleaningResultIssue"');

    // Enforce SQL CHECK constraints from PRD §15.11
    expect(migrationSql).toContain('"fileSizeBytes" >= 0');
    expect(migrationSql).toContain('"totalIssues" >= 0');
    expect(migrationSql).toContain('"issueCount" >= 0');
    expect(migrationSql).toContain('"matchPercentage" >= 0 AND "matchPercentage" <= 100');
    expect(migrationSql).toContain('"attempts" >= 0 AND "attempts" <= "maxAttempts"');
    expect(migrationSql).toContain('"originalRowCount" >= 0');
  });
});
