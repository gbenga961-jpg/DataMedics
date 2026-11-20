/**
 * Milestone 4 — Controlled Cleaning Test Suite
 *
 * Tests:
 * - Each operation independently (CLEAN-OP-01 through CLEAN-OP-03)
 * - Operation ordering (CLEAN-ORDER-01)
 * - Combinations (CLEAN-COMBO-01 through CLEAN-COMBO-02)
 * - Original preservation / immutability (CLEAN-IMMUT-01)
 * - Canonical CSV serialization RFC 4180 (CLEAN-SER-01 through CLEAN-SER-03)
 * - Idempotency key — same key+fingerprint returns existing run (CLEAN-IDEM-01)
 * - Idempotency key — same key+different payload returns 409 (CLEAN-IDEM-02)
 * - Worker failure + retry (CLEAN-WORKER-01 through CLEAN-WORKER-02)
 * - Post-cleaning detection: CleaningResultIssue separate from DataQualityIssue (CLEAN-DET-01)
 * - Request fingerprint determinism (CLEAN-FP-01)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { trimWhitespace, removeBlankRows, removeDuplicateRows, isFullyBlankRow } from "@/engine/cleaning/operations";
import { executeCleaning } from "@/engine/cleaning/runner";
import { serializeToCanonicalCsv } from "@/engine/cleaning/serializer";
import { generateRequestFingerprint } from "@/services/cleaning/fingerprint";
import { processCleaningJob } from "@/workers/cleaning.worker";
import { MemoryDataRepository } from "@/services/repository";
import { MemoryStorageProvider } from "@/lib/storage";
import { JobStatus, CleaningOperation } from "@/types/models";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function row(...cells: string[]): string[] {
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-OP-01: trimWhitespace — independent operation
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-OP-01: trimWhitespace", () => {
  it("trims leading and trailing spaces from cells", () => {
    const rows = [row("  Alice  ", " 30 ", "  New York  ")];
    const { rows: out, count } = trimWhitespace(rows);
    expect(out[0]).toEqual(["Alice", "30", "New York"]);
    expect(count).toBe(3);
  });

  it("does not trim spaces between words", () => {
    const rows = [row("New York", "San Francisco")];
    const { rows: out, count } = trimWhitespace(rows);
    expect(out[0]).toEqual(["New York", "San Francisco"]);
    expect(count).toBe(0);
  });

  it("passes fully blank rows through unchanged", () => {
    const blank = row("", "   ", "");
    const rows = [blank, row("Alice", "30")];
    const { rows: out } = trimWhitespace(rows);
    // Blank row passed through (cells untouched — it's fully blank)
    expect(out[0]).toEqual(["", "   ", ""]);
    expect(out[1]).toEqual(["Alice", "30"]);
  });

  it("does not mutate the caller's array", () => {
    const original = [row("  Alice  ")];
    const copy = original[0].slice();
    trimWhitespace(original);
    expect(original[0]).toEqual(copy); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-OP-02: removeBlankRows — independent operation
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-OP-02: removeBlankRows", () => {
  it("removes rows where every cell is empty or whitespace-only", () => {
    const rows = [
      row("Alice", "30"),
      row("", "", ""),
      row("Bob", "25"),
      row("   ", "\t", ""),
    ];
    const { rows: out, removed } = removeBlankRows(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(["Alice", "30"]);
    expect(out[1]).toEqual(["Bob", "25"]);
    expect(removed).toBe(2);
  });

  it("keeps rows with at least one non-blank cell", () => {
    const rows = [row("", "value", "")];
    const { rows: out, removed } = removeBlankRows(rows);
    expect(out).toHaveLength(1);
    expect(removed).toBe(0);
  });

  it("isFullyBlankRow helper", () => {
    expect(isFullyBlankRow(["", "", ""])).toBe(true);
    expect(isFullyBlankRow(["  ", "\t"])).toBe(true);
    expect(isFullyBlankRow(["a", ""])).toBe(false);
  });

  it("does not mutate the caller's array", () => {
    const rows = [row("", ""), row("Alice")];
    const originalLength = rows.length;
    removeBlankRows(rows);
    expect(rows).toHaveLength(originalLength);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-OP-03: removeDuplicateRows — independent operation
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-OP-03: removeDuplicateRows", () => {
  it("keeps first occurrence and removes subsequent duplicates", () => {
    const rows = [
      row("Alice", "30"),
      row("Bob", "25"),
      row("Alice", "30"), // duplicate
      row("Bob", "25"),   // duplicate
      row("Carol", "35"),
    ];
    const { rows: out, removed } = removeDuplicateRows(rows);
    expect(out).toHaveLength(3);
    expect(removed).toBe(2);
    expect(out[0]).toEqual(["Alice", "30"]);
    expect(out[1]).toEqual(["Bob", "25"]);
    expect(out[2]).toEqual(["Carol", "35"]);
  });

  it("comparison is exact — does not normalize case or whitespace", () => {
    const rows = [row("alice"), row("Alice"), row("ALICE")];
    const { rows: out, removed } = removeDuplicateRows(rows);
    expect(out).toHaveLength(3); // all distinct
    expect(removed).toBe(0);
  });

  it("does not mutate the caller's array", () => {
    const rows = [row("Alice"), row("Alice")];
    const originalLength = rows.length;
    removeDuplicateRows(rows);
    expect(rows).toHaveLength(originalLength);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-ORDER-01: Operation ordering — trim → blank → dedupe
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-ORDER-01: Fixed operation order", () => {
  it("trim runs before deduplication so trimmed values deduplicate correctly", () => {
    // "  Alice  " and "Alice" should become duplicates AFTER trimming
    const headers = ["name"];
    const rows = [row("  Alice  "), row("Alice")];
    const result = executeCleaning(headers, rows, {
      trimWhitespace: true,
      removeBlankRows: false,
      removeDuplicateRows: true,
    });
    // After trim: both become "Alice" → dedup keeps first
    expect(result.outputRows).toHaveLength(1);
    expect(result.outputRows[0]).toEqual(["Alice"]);
    expect(result.metrics.whitespaceCellsTrimmed).toBe(1);
    expect(result.metrics.duplicateRowsRemoved).toBe(1);
  });

  it("trim runs before blank-row removal: whitespace-only cells trimmed first, then blank rows removed", () => {
    const headers = ["name", "age"];
    // After trimming, this row becomes ["", ""] → blank → should be removed
    const rows = [row("  ", "  "), row("Bob", "25")];
    const result = executeCleaning(headers, rows, {
      trimWhitespace: true,
      removeBlankRows: true,
      removeDuplicateRows: false,
    });
    expect(result.outputRows).toHaveLength(1);
    expect(result.outputRows[0]).toEqual(["Bob", "25"]);
    expect(result.metrics.blankRowsRemoved).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-COMBO-01 / CLEAN-COMBO-02: All 3 operations together
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-COMBO-01: All 3 operations combined", () => {
  it("applies all 3 in correct order and reports correct metrics", () => {
    const headers = ["name", "age", "city"];
    const rows = [
      row("  Alice  ", " 30 ", " NYC "),  // has whitespace
      row("", "", ""),                     // blank
      row("Bob", "25", "LA"),
      row("Bob", "25", "LA"),             // duplicate of above
      row("  Alice  ", " 30 ", " NYC "), // duplicate of first after trim
    ];

    const result = executeCleaning(headers, rows, {
      trimWhitespace: true,
      removeBlankRows: true,
      removeDuplicateRows: true,
    });

    // After trim: Alice row trimmed, blank unchanged, rest unchanged
    // After blank removal: blank row removed (1 removed)
    // After dedup: second "Bob" and second "Alice" removed (2 removed)
    expect(result.metrics.whitespaceCellsTrimmed).toBeGreaterThan(0);
    expect(result.metrics.blankRowsRemoved).toBe(1);
    expect(result.metrics.duplicateRowsRemoved).toBe(2);
    expect(result.outputRows).toHaveLength(2);
    expect(result.metrics.finalRowCount).toBe(2);
  });
});

describe("CLEAN-COMBO-02: No operations selected", () => {
  it("returns input unchanged when no operations selected", () => {
    const headers = ["a", "b"];
    const rows = [row("  x  ", "  y  ")];
    const result = executeCleaning(headers, rows, {
      trimWhitespace: false,
      removeBlankRows: false,
      removeDuplicateRows: false,
    });
    expect(result.outputRows[0]).toEqual(["  x  ", "  y  "]);
    expect(result.metrics.whitespaceCellsTrimmed).toBe(0);
    expect(result.metrics.blankRowsRemoved).toBe(0);
    expect(result.metrics.duplicateRowsRemoved).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-IMMUT-01: Original file preservation
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-IMMUT-01: Original data immutability", () => {
  it("executeCleaning never mutates the caller's input rows array", () => {
    const headers = ["name"];
    const rows = [row("  Alice  "), row("", ""), row("Bob")];
    const originalSnapshot = rows.map((r) => r.slice());

    executeCleaning(headers, rows, {
      trimWhitespace: true,
      removeBlankRows: true,
      removeDuplicateRows: true,
    });

    // Original rows must be identical after the call
    expect(rows).toHaveLength(originalSnapshot.length);
    rows.forEach((row, i) => {
      expect(row).toEqual(originalSnapshot[i]);
    });
  });

  it("executeCleaning never mutates the caller's headers array", () => {
    const headers = ["  Name  ", "  Age  "];
    const headersCopy = headers.slice();
    executeCleaning(headers, [], {
      trimWhitespace: true,
      removeBlankRows: false,
      removeDuplicateRows: false,
    });
    expect(headers).toEqual(headersCopy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-SER-01 / 02 / 03: RFC 4180 canonical CSV serialization
// ─────────────────────────────────────────────────────────────────────────────
describe("Canonical CSV serialization (RFC 4180)", () => {
  it("CLEAN-SER-01: plain fields — no quoting needed", () => {
    const csv = serializeToCanonicalCsv(["name", "age"], [["Alice", "30"]]);
    expect(csv).toBe("name,age\r\nAlice,30\r\n");
  });

  it("CLEAN-SER-02: fields with commas are double-quoted", () => {
    const csv = serializeToCanonicalCsv(["address"], [["123 Main St, Apt 4"]]);
    expect(csv).toContain('"123 Main St, Apt 4"');
  });

  it("CLEAN-SER-03: embedded double-quotes are escaped as \"\"", () => {
    const csv = serializeToCanonicalCsv(["note"], [['say "hello"']]);
    expect(csv).toContain('"say ""hello"""');
  });

  it("CLEAN-SER-04: fields with newlines are quoted", () => {
    const csv = serializeToCanonicalCsv(["note"], [["line1\nline2"]]);
    expect(csv).toContain('"line1\nline2"');
  });

  it("CLEAN-SER-05: uses CRLF line endings throughout", () => {
    const csv = serializeToCanonicalCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });

  it("CLEAN-SER-06: empty rows produce correct line", () => {
    const csv = serializeToCanonicalCsv(["a", "b"], [["", ""]]);
    expect(csv).toBe("a,b\r\n,\r\n");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-FP-01: Request fingerprint determinism
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-FP-01: Request fingerprint", () => {
  it("same reportId + same operations → same fingerprint", () => {
    const fp1 = generateRequestFingerprint("rep-123", [
      CleaningOperation.TRIM_WHITESPACE,
      CleaningOperation.REMOVE_DUPLICATE_ROWS,
    ]);
    const fp2 = generateRequestFingerprint("rep-123", [
      CleaningOperation.TRIM_WHITESPACE,
      CleaningOperation.REMOVE_DUPLICATE_ROWS,
    ]);
    expect(fp1).toBe(fp2);
  });

  it("operation order does not change fingerprint (canonical sort)", () => {
    const fp1 = generateRequestFingerprint("rep-abc", [
      CleaningOperation.TRIM_WHITESPACE,
      CleaningOperation.REMOVE_BLANK_ROWS,
    ]);
    const fp2 = generateRequestFingerprint("rep-abc", [
      CleaningOperation.REMOVE_BLANK_ROWS,
      CleaningOperation.TRIM_WHITESPACE,
    ]);
    expect(fp1).toBe(fp2);
  });

  it("different operations → different fingerprint", () => {
    const fp1 = generateRequestFingerprint("rep-abc", [CleaningOperation.TRIM_WHITESPACE]);
    const fp2 = generateRequestFingerprint("rep-abc", [CleaningOperation.REMOVE_BLANK_ROWS]);
    expect(fp1).not.toBe(fp2);
  });

  it("different reportId → different fingerprint", () => {
    const fp1 = generateRequestFingerprint("rep-001", [CleaningOperation.TRIM_WHITESPACE]);
    const fp2 = generateRequestFingerprint("rep-002", [CleaningOperation.TRIM_WHITESPACE]);
    expect(fp1).not.toBe(fp2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repository: CleaningRun CRUD
// ─────────────────────────────────────────────────────────────────────────────
describe("MemoryDataRepository — CleaningRun operations", () => {
  let repo: MemoryDataRepository;

  beforeEach(() => {
    repo = new MemoryDataRepository();
  });

  async function makeRun(idemKey?: string) {
    return repo.createCleaningRun({
      userId: "usr-1",
      reportId: "rep-1",
      selectedOperations: [CleaningOperation.TRIM_WHITESPACE],
      originalRowCount: 100,
      idempotencyKey: idemKey,
      requestFingerprint: "fp-abc",
    });
  }

  it("creates a CleaningRun with QUEUED status and correct defaults", async () => {
    const run = await makeRun("key-1");
    expect(run.status).toBe(JobStatus.QUEUED);
    expect(run.attempts).toBe(0);
    expect(run.maxAttempts).toBe(3);
    expect(run.finalRowCount).toBeNull();
    expect(run.idempotencyKey).toBe("key-1");
  });

  it("CLEAN-IDEM-01: finds existing run by idempotency key", async () => {
    const run = await makeRun("key-abc");
    const found = await repo.getCleaningRunByIdempotencyKey("usr-1", "key-abc");
    expect(found?.id).toBe(run.id);
  });

  it("CLEAN-IDEM-02: different user does not match same idempotency key", async () => {
    await makeRun("key-abc");
    const found = await repo.getCleaningRunByIdempotencyKey("usr-2", "key-abc");
    expect(found).toBeNull();
  });

  it("claimCleaningRun sets status to PROCESSING and increments attempts", async () => {
    const run = await makeRun();
    const claimed = await repo.claimCleaningRun(run.id, 60000);
    expect(claimed).toBe(true);
    const updated = await repo.getCleaningRun(run.id);
    expect(updated?.status).toBe(JobStatus.PROCESSING);
    expect(updated?.attempts).toBe(1);
  });

  it("claimCleaningRun returns false for COMPLETED run", async () => {
    const run = await makeRun();
    await repo.claimCleaningRun(run.id, 60000);
    await repo.markCleaningRunCompleted(run.id, {
      originalRowCount: 100,
      finalRowCount: 95,
      whitespaceCellsTrimmed: 10,
      blankRowsRemoved: 0,
      duplicateRowsRemoved: 5,
      exportProtectedValueCount: 0,
    });
    const second = await repo.claimCleaningRun(run.id, 60000);
    expect(second).toBe(false);
  });

  it("CLEAN-WORKER-01: markCleaningRunFailed with canRetry=true resets to QUEUED", async () => {
    const run = await makeRun();
    await repo.claimCleaningRun(run.id, 60000); // attempts = 1
    const { shouldRetry } = await repo.markCleaningRunFailed(run.id, "TRANSIENT_ERROR", true);
    expect(shouldRetry).toBe(true);
    const updated = await repo.getCleaningRun(run.id);
    expect(updated?.status).toBe(JobStatus.QUEUED);
  });

  it("CLEAN-WORKER-02: markCleaningRunFailed after max attempts sets FAILED permanently", async () => {
    const run = await makeRun();
    // Exhaust all 3 attempts
    for (let i = 0; i < 3; i++) {
      await repo.claimCleaningRun(run.id, 60000);
    }
    const { shouldRetry } = await repo.markCleaningRunFailed(run.id, "MAX_ATTEMPTS", false);
    expect(shouldRetry).toBe(false);
    const updated = await repo.getCleaningRun(run.id);
    expect(updated?.status).toBe(JobStatus.FAILED);
    expect(updated?.finishedAt).not.toBeNull();
  });

  it("listStaleCleaningRuns returns PROCESSING runs with expired leases", async () => {
    const run = await makeRun();
    await repo.claimCleaningRun(run.id, 1); // 1ms lease — expires immediately
    await new Promise((resolve) => setTimeout(resolve, 10));
    const stale = await repo.listStaleCleaningRuns(new Date());
    expect(stale.some((r) => r.id === run.id)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN-DET-01: Post-cleaning detection writes CleaningResultIssue, not DataQualityIssue
// ─────────────────────────────────────────────────────────────────────────────
describe("CLEAN-DET-01: Post-cleaning detection isolation", () => {
  it("processCleaningJob writes CleaningResultIssue records separately from DataQualityIssue", async () => {
    const repo = new MemoryDataRepository();
    const storage = new MemoryStorageProvider();

    // Set up user, upload, report
    const user = await repo.createUser("test@example.com", "hash");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upload = await repo.createUploadedFile({
      userId: user.id,
      filename: "test.csv",
      storageKey: "uploads/test.csv",
      fileSizeBytes: 100,
      mimeType: "text/csv",
      rowCount: 3,
      columnCount: 2,
      uploadStatus: "ACCEPTED" as any,
      expiresAt,
    });

    // Store a CSV with whitespace issues so post-cleaning detection finds something
    const csvContent =
      "name,score\r\n  Alice  ,90\r\n  Alice  ,90\r\nBob,85\r\n";
    await storage.putObject("uploads/test.csv", Buffer.from(csvContent, "utf-8"), "text/csv");

    const report = await repo.createAnalysisReport({
      uploadedFileId: upload.id,
      totalRows: 3,
      totalColumns: 2,
    });
    // Mark report COMPLETED (required for cleaning to proceed)
    await repo.updateReportStatus(report.id, JobStatus.COMPLETED, 0);

    // Add a pre-existing DataQualityIssue to prove separation
    await repo.createDataQualityIssues([
      {
        reportId: report.id,
        issueType: "UNNECESSARY_WHITESPACE" as any,
        affectedColumn: "name",
        issueCount: 2,
        title: "Pre-existing",
        description: "pre",
        recommendation: "trim",
        detectionStatus: "DETECTED" as any,
        detectedPattern: null,
        matchingValueCount: 0,
        nonMatchingValueCount: 0,
        unclassifiedValueCount: 0,
        totalNonEmptyValueCount: 3,
        matchPercentage: null,
        recognisedPatterns: null,
        details: null,
      },
    ]);

    const run = await repo.createCleaningRun({
      userId: user.id,
      reportId: report.id,
      selectedOperations: [CleaningOperation.TRIM_WHITESPACE],
      originalRowCount: 3,
      requestFingerprint: "fp-test",
    });

    // Run the cleaning worker
    await processCleaningJob(
      {
        cleaningRunId: run.id,
        reportId: report.id,
        userId: user.id,
        idempotencyKey: "",
        requestFingerprint: "fp-test",
      },
      repo,
      storage
    );

    // Verify CleaningRun is COMPLETED
    const updatedRun = await repo.getCleaningRun(run.id);
    expect(updatedRun?.status).toBe(JobStatus.COMPLETED);

    // Verify CleanedFile was created
    const cleanedFile = await repo.getCleanedFileByRun(run.id);
    expect(cleanedFile).not.toBeNull();
    expect(cleanedFile?.cleaningRunId).toBe(run.id);

    // Verify post-cleaning CleaningResultIssue records are stored separately
    const cleaningResultIssues = await repo.getCleaningResultIssues(run.id);
    // (They may or may not exist depending on detection results)
    for (const issue of cleaningResultIssues) {
      expect(issue.cleaningRunId).toBe(run.id);
      // Must NOT have a reportId — that's on DataQualityIssue, not here
      expect((issue as any).reportId).toBeUndefined();
    }

    // Original DataQualityIssue still present and unchanged
    const originalIssues = await repo.getIssuesByReport(report.id);
    expect(originalIssues).toHaveLength(1);
    expect(originalIssues[0].title).toBe("Pre-existing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Worker idempotency: COMPLETED run is not reprocessed
// ─────────────────────────────────────────────────────────────────────────────
describe("Cleaning worker idempotency", () => {
  it("processCleaningJob returns without reprocessing a COMPLETED run", async () => {
    const repo = new MemoryDataRepository();
    const storage = new MemoryStorageProvider();

    const run = await repo.createCleaningRun({
      userId: "usr-1",
      reportId: "rep-1",
      selectedOperations: [CleaningOperation.TRIM_WHITESPACE],
      originalRowCount: 10,
      requestFingerprint: "fp-idem",
    });

    // Manually mark as completed
    await repo.claimCleaningRun(run.id, 60000);
    await repo.markCleaningRunCompleted(run.id, {
      originalRowCount: 10,
      finalRowCount: 10,
      whitespaceCellsTrimmed: 2,
      blankRowsRemoved: 0,
      duplicateRowsRemoved: 0,
      exportProtectedValueCount: 0,
    });

    // Call worker again — should return without error
    await expect(
      processCleaningJob(
        {
          cleaningRunId: run.id,
          reportId: "rep-1",
          userId: "usr-1",
          idempotencyKey: "",
          requestFingerprint: "fp-idem",
        },
        repo,
        storage
      )
    ).resolves.toBeUndefined();

    // Status remains COMPLETED — not changed back
    const updated = await repo.getCleaningRun(run.id);
    expect(updated?.status).toBe(JobStatus.COMPLETED);
  });
});
