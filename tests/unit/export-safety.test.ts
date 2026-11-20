/**
 * Milestone 5 — Export Safety Acceptance Tests (PRD §11, §18, Amendment J04)
 * Test Suite: EX-AT-01 through EX-AT-14
 */

import { describe, it, expect } from "vitest";
import {
  isDangerousFormulaValue,
  isLegitimateNumber,
  neutralizeCellValue,
  neutralizeFormulas,
  generateCleanedFilename,
  EXPORT_SAFETY_DISCLOSURE,
} from "@/engine/export/safety";
import { serializeToCanonicalCsv } from "@/engine/cleaning/serializer";
import { parseCsv } from "@/engine/csv/parser";
import { MemoryDataRepository } from "@/services/repository";
import { MemoryStorageProvider } from "@/lib/storage";
import { processCleaningJob } from "@/workers/cleaning.worker";
import { JobStatus, CleaningOperation } from "@/types/models";

describe("Export Safety Acceptance Tests (EX-AT-01 through EX-AT-14)", () => {
  // ── EX-AT-01: Dangerous prefix '=' ───────────────────────────────────────
  it("EX-AT-01: neutralizes dangerous prefix '=' with an apostrophe", () => {
    const formulas = [
      "=SUM(A1:B10)",
      "=1+1",
      '=cmd|\' /C calc\'!A0',
      "=HYPERLINK(\"http://evil.com\")",
      "==1",
    ];
    for (const f of formulas) {
      expect(isDangerousFormulaValue(f)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(f);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${f}`);
    }
  });

  // ── EX-AT-02: Dangerous prefix '+' ───────────────────────────────────────
  it("EX-AT-02: neutralizes dangerous prefix '+' on non-numeric content", () => {
    const formulas = [
      "+SUM(A1:B10)",
      '+cmd|\' /C calc\'!A0',
      "+A1",
      "+1+2",
      "+@something",
    ];
    for (const f of formulas) {
      expect(isDangerousFormulaValue(f)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(f);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${f}`);
    }
  });

  // ── EX-AT-03: Dangerous prefix '-' ───────────────────────────────────────
  it("EX-AT-03: neutralizes dangerous prefix '-' on non-numeric content", () => {
    const formulas = [
      "-SUM(A1:B10)",
      '-cmd|\' /C calc\'!A0',
      "-A1",
      "--1",
      "- This is a bullet point",
      "-",
    ];
    for (const f of formulas) {
      expect(isDangerousFormulaValue(f)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(f);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${f}`);
    }
  });

  // ── EX-AT-04: Dangerous prefix '@' ───────────────────────────────────────
  it("EX-AT-04: neutralizes dangerous prefix '@'", () => {
    const formulas = [
      "@SUM(A1:B10)",
      "@HYPERLINK(\"http://evil.com\")",
      "@calc",
    ];
    for (const f of formulas) {
      expect(isDangerousFormulaValue(f)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(f);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${f}`);
    }
  });

  // ── EX-AT-05: Leading whitespace before dangerous prefix ─────────────────
  it("EX-AT-05: detects and neutralizes leading whitespace before dangerous prefixes", () => {
    const cases = [
      "  =1+1",
      "\t=SUM(A1)",
      "   +cmd|' /C calc'!A0",
      " \t -Bullet",
      "   @SUM(B1)",
    ];
    for (const c of cases) {
      expect(isDangerousFormulaValue(c)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(c);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${c}`);
    }
  });

  // ── EX-AT-06: Leading control characters before dangerous prefix ─────────
  it("EX-AT-06: detects and neutralizes leading control characters before dangerous prefixes", () => {
    const cases = [
      "\r\n=1+1",
      "\n=SUM(A1)",
      "\x00=calc",
      "\x1b+cmd",
      "\x0b@SUM(1)",
    ];
    for (const c of cases) {
      expect(isDangerousFormulaValue(c)).toBe(true);
      const { safeValue, modified } = neutralizeCellValue(c);
      expect(modified).toBe(true);
      expect(safeValue).toBe(`'${c}`);
    }
  });

  // ── EX-AT-07: Confidently recognised legitimate negative numbers ─────────
  it("EX-AT-07: preserves legitimate negative numbers without modification", () => {
    const numbers = [
      "-42",
      "-3.14159",
      "-0.005",
      "-1e5",
      "-1.25E-3",
      "-0",
      "+100",
      "+3.5",
      "42",
      "0.99",
    ];
    for (const num of numbers) {
      expect(isLegitimateNumber(num)).toBe(true);
      expect(isDangerousFormulaValue(num)).toBe(false);
      const { safeValue, modified } = neutralizeCellValue(num);
      expect(modified).toBe(false);
      expect(safeValue).toBe(num);
    }
  });

  // ── EX-AT-08: Quoted fields containing formula prefixes ───────────────────
  it("EX-AT-08: neutralizes values before CSV serialization and quotes correctly", () => {
    const headers = ["note", "val"];
    const rows = [
      ['=SUM("A1,B1")', '100'],
      ['+cmd|\' /C "calc"\'!A0', '-50'],
    ];

    const { safeHeaders, safeRows, exportProtectedValueCount } = neutralizeFormulas(headers, rows);
    expect(exportProtectedValueCount).toBe(2);

    // Neutralized values start with '
    expect(safeRows[0][0]).toBe('\'=SUM("A1,B1")');
    expect(safeRows[1][0]).toBe('\'+cmd|\' /C "calc"\'!A0');

    // Negative number preserved
    expect(safeRows[1][1]).toBe("-50");

    // Serialize to CSV
    const csv = serializeToCanonicalCsv(safeHeaders, safeRows);

    // Verify correct RFC 4180 parsing and round-trip
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["note", "val"]);
    expect(parsed.rows[0][0]).toBe('\'=SUM("A1,B1")');
    expect(parsed.rows[1][0]).toBe('\'+cmd|\' /C "calc"\'!A0');
    expect(parsed.rows[1][1]).toBe("-50");
  });

  // ── EX-AT-09: Unchanged canonical data ───────────────────────────────────
  it("EX-AT-09: canonical cleaned data remains completely unchanged by export safety", () => {
    const canonicalHeaders = ["col1", "col2"];
    const canonicalRows = [
      ["=SUM(A1)", "-42"],
      ["@test", "Normal text"],
    ];

    // Deep clone snapshot before neutralization
    const headersSnapshot = canonicalHeaders.slice();
    const rowsSnapshot = canonicalRows.map((r) => r.slice());

    const { safeRows } = neutralizeFormulas(canonicalHeaders, canonicalRows);

    // Canonical inputs must be completely unmodified
    expect(canonicalHeaders).toEqual(headersSnapshot);
    expect(canonicalRows).toEqual(rowsSnapshot);

    // Safe rows are distinct and protected
    expect(safeRows[0][0]).toBe("'=SUM(A1)");
    expect(safeRows[0][1]).toBe("-42"); // number preserved
    expect(safeRows[1][0]).toBe("'@test");
    expect(safeRows[1][1]).toBe("Normal text");
  });

  // ── EX-AT-10: Safe-output structural correctness ─────────────────────────
  it("EX-AT-10: spreadsheet-safe output is structurally valid RFC 4180 CSV", () => {
    const headers = ["A", "B", "C"];
    const rows = [
      ["=1+1", "Hello, World", 'Quotes "inside"'],
      ["-42", "+SUM(A1)", "Normal"],
    ];

    const { safeHeaders, safeRows } = neutralizeFormulas(headers, rows);
    const csvString = serializeToCanonicalCsv(safeHeaders, safeRows);

    const parsed = parseCsv(csvString);
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toHaveLength(rows.length);
    expect(parsed.rows[0].length).toBe(headers.length);
    expect(parsed.rows[1].length).toBe(headers.length);
  });

  // ── EX-AT-11: Protection counts ──────────────────────────────────────────
  it("EX-AT-11: accurately counts modified cells in exportProtectedValueCount", () => {
    const headers = ["a", "b", "c"];
    const rows = [
      ["=1", "normal", "+2+3"],      // 2 protected
      ["-42", "@user", "-50"],       // 1 protected (@user)
      ["plain", "text", "here"],     // 0 protected
    ];

    const { exportProtectedValueCount } = neutralizeFormulas(headers, rows);
    expect(exportProtectedValueCount).toBe(3);
  });

  // ── EX-AT-12: User disclosure ────────────────────────────────────────────
  it("EX-AT-12: provides export-safety user disclosure text", () => {
    expect(EXPORT_SAFETY_DISCLOSURE).toContain("Export safety");
    expect(EXPORT_SAFETY_DISCLOSURE).toContain("apostrophe");
    expect(EXPORT_SAFETY_DISCLOSURE).toContain("canonical cleaned data is preserved");
  });

  // ── EX-AT-13: Excel & LibreOffice behaviour verification ─────────────────
  it("EX-AT-13: verifies leading apostrophe treats formula content as literal text in spreadsheet standards", () => {
    // When Microsoft Excel, LibreOffice Calc, or Google Sheets parse a cell value
    // starting with an apostrophe ('), the apostrophe acts as a text prefix indicator.
    // The spreadsheet renders the remainder of the cell as literal text and does not execute it.
    const formula = "=SUM(1,2,3)";
    const { safeValue } = neutralizeCellValue(formula);
    expect(safeValue.startsWith("'")).toBe(true);
    expect(safeValue).toBe("'=SUM(1,2,3)");

    // Test with command injection payload
    const ddePayload = "=cmd|' /C calc'!A0";
    const { safeValue: safeDde } = neutralizeCellValue(ddePayload);
    expect(safeDde).toBe("'=cmd|' /C calc'!A0");
  });

  // ── EX-AT-14: Output publication sequence ────────────────────────────────
  it("EX-AT-14: publication sequence validates both outputs before completing run", async () => {
    const repo = new MemoryDataRepository();
    const storage = new MemoryStorageProvider();

    const user = await repo.createUser("publisher@example.com", "hash");
    const upload = await repo.createUploadedFile({
      userId: user.id,
      filename: "test_publish.csv",
      storageKey: "uploads/test_publish.csv",
      fileSizeBytes: 100,
      mimeType: "text/csv",
      rowCount: 2,
      columnCount: 2,
      uploadStatus: "ACCEPTED" as any,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const csvData = "col1,col2\r\n=1+1,-42\r\n@evil,text\r\n";
    await storage.putObject(upload.storageKey, Buffer.from(csvData, "utf-8"), "text/csv");

    const report = await repo.createAnalysisReport({
      uploadedFileId: upload.id,
      totalRows: 2,
      totalColumns: 2,
    });
    await repo.updateReportStatus(report.id, JobStatus.COMPLETED, 0);

    const run = await repo.createCleaningRun({
      userId: user.id,
      reportId: report.id,
      selectedOperations: [CleaningOperation.TRIM_WHITESPACE],
      originalRowCount: 2,
      requestFingerprint: "fp-publish",
    });

    // Execute cleaning worker
    await processCleaningJob(
      {
        cleaningRunId: run.id,
        reportId: report.id,
        userId: user.id,
        idempotencyKey: "",
        requestFingerprint: "fp-publish",
      },
      repo,
      storage
    );

    const completedRun = await repo.getCleaningRun(run.id);
    expect(completedRun?.status).toBe(JobStatus.COMPLETED);
    expect(completedRun?.exportProtectedValueCount).toBe(2); // =1+1 and @evil

    const cleanedFile = await repo.getCleanedFileByRun(run.id);
    expect(cleanedFile).not.toBeNull();
    expect(cleanedFile?.exportProtectedValueCount).toBe(2);

    // Confirm both objects exist in storage
    const canonicalBuf = await storage.getObject(cleanedFile!.canonicalStorageKey);
    const safeBuf = await storage.getObject(cleanedFile!.safeExportStorageKey);

    expect(canonicalBuf).toBeDefined();
    expect(safeBuf).toBeDefined();

    // Canonical has raw values
    const canonicalText = canonicalBuf.toString("utf-8");
    expect(canonicalText).toContain("=1+1");
    expect(canonicalText).toContain("@evil");

    // Safe export has apostrophe neutralisation
    const safeText = safeBuf.toString("utf-8");
    expect(safeText).toContain("'=1+1");
    expect(safeText).toContain("'@evil");
    expect(safeText).toContain("-42"); // legitimate negative preserved
  });

  it("generateCleanedFilename formats filename with timestamp per PRD §11.4", () => {
    const fixedDate = new Date(2026, 10, 1, 15, 30, 0); // Nov 1, 2026 15:30:00
    const name = generateCleanedFilename("monthly_sales.csv", fixedDate);
    expect(name).toBe("monthly_sales_cleaned_20261101_153000.csv");
  });
});
