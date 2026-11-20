import { describe, it, expect } from "vitest";
import { getConfig } from "@/lib/config";
import { buildAnalysisJobId, buildCleaningJobId } from "@/lib/queue";
import { generateStorageKey } from "@/lib/storage";
import { CleaningOperation, JobStatus, IssueType, DetectionStatus } from "@/types/models";

describe("Scaffolding Foundation Smoke Tests", () => {
  it("loads default application configuration safely", () => {
    const config = getConfig();
    expect(config.port).toBe(3000);
    expect(config.limits.maxUploadSizeBytes).toBe(10485760);
    expect(config.limits.tempMaxColumns).toBe(100);
    expect(config.limits.tempMaxFieldSizeBytes).toBe(32768);
  });

  it("builds deterministic queue identifiers matching PRD §16.2", () => {
    const analysisJobId = buildAnalysisJobId("job-123");
    expect(analysisJobId).toBe("analysis-job-123");

    const cleaningJobId = buildCleaningJobId("run-456");
    expect(cleaningJobId).toBe("cleaning-run-456");
  });

  it("generates safe, randomized storage keys without user file input", () => {
    const key = generateStorageKey("uploads", "csv");
    expect(key).toMatch(/^uploads\/\d+-[0-9a-f-]+\.csv$/);
  });

  it("exposes all approved core model enums", () => {
    expect(JobStatus.QUEUED).toBe("QUEUED");
    expect(JobStatus.PROCESSING).toBe("PROCESSING");
    expect(JobStatus.COMPLETED).toBe("COMPLETED");
    expect(JobStatus.FAILED).toBe("FAILED");

    expect(CleaningOperation.TRIM_WHITESPACE).toBe("TRIM_WHITESPACE");
    expect(CleaningOperation.REMOVE_BLANK_ROWS).toBe("REMOVE_BLANK_ROWS");
    expect(CleaningOperation.REMOVE_DUPLICATE_ROWS).toBe("REMOVE_DUPLICATE_ROWS");

    expect(IssueType.MISSING_VALUES).toBe("MISSING_VALUES");
    expect(IssueType.EXACT_DUPLICATE_ROWS).toBe("EXACT_DUPLICATE_ROWS");
    expect(IssueType.INCONSISTENT_FORMATS).toBe("INCONSISTENT_FORMATS");
    expect(IssueType.UNNECESSARY_WHITESPACE).toBe("UNNECESSARY_WHITESPACE");

    expect(DetectionStatus.DETECTED).toBe("DETECTED");
    expect(DetectionStatus.NONE_DETECTED).toBe("NONE_DETECTED");
    expect(DetectionStatus.NOT_ASSESSED).toBe("NOT_ASSESSED");
  });
});
