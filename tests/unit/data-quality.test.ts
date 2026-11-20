/**
 * Data Quality Detection Rules Tests
 * Covers PRD §8.1 (Missing), §8.2 (Duplicates), §8.4 (Whitespace), and §15.12 (Aggregator).
 */

import { describe, it, expect } from "vitest";
import { detectMissingValues } from "@/engine/detection/missing";
import { detectDuplicateRows } from "@/engine/detection/duplicates";
import { detectUnnecessaryWhitespace } from "@/engine/detection/whitespace";
import { runDataQualityAnalysis } from "@/engine/detection/aggregator";
import { IssueType } from "@/types/models";

describe("Missing Values Detection (PRD §8.1)", () => {
  it("counts empty and whitespace-only cells as missing", () => {
    const headers = ["id", "name", "city"];
    const rows = [
      ["1", "Alice", ""],       // 1 empty in city
      ["2", "   ", "Chicago"],  // 1 whitespace-only in name
      ["3", "Charlie", "Austin"],
    ];

    const result = detectMissingValues(headers, rows);
    expect(result.totalMissingCount).toBe(2);
    expect(result.findings).toHaveLength(2);

    const nameFinding = result.findings.find((f) => f.column === "name");
    expect(nameFinding?.whitespaceOnlyCellCount).toBe(1);

    const cityFinding = result.findings.find((f) => f.column === "city");
    expect(cityFinding?.emptyCellCount).toBe(1);
  });

  it("does not classify 0, 0.00, N/A, NA, NULL, null, -, unknown as missing", () => {
    const headers = ["val"];
    const rows = [
      ["0"],
      ["0.00"],
      ["N/A"],
      ["NA"],
      ["NULL"],
      ["null"],
      ["-"],
      ["unknown"],
      ["not provided"],
    ];

    const result = detectMissingValues(headers, rows);
    expect(result.totalMissingCount).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("excludes fully blank rows from main missing-value count and reports ignoredBlankRowCount", () => {
    const headers = ["colA", "colB"];
    const rows = [
      ["", ""],        // fully blank row
      ["   ", "  "],   // fully blank row (whitespace only)
      ["val1", ""],    // 1 missing in colB
    ];

    const result = detectMissingValues(headers, rows);
    expect(result.ignoredBlankRowCount).toBe(2);
    expect(result.totalMissingCount).toBe(1);
    expect(result.findings[0].column).toBe("colB");
  });
});

describe("Exact Duplicate Rows Detection (PRD §8.2)", () => {
  it("compares entire row as exact string without trimming or lowercasing", () => {
    const headers = ["id", "name"];
    const rows = [
      ["1", "Alice"],
      ["1", "Alice"],       // exact duplicate of row 0
      ["1", " Alice"],      // NOT duplicate because of leading space
      ["1", "ALICE"],       // NOT duplicate because of casing
      ["1", "Alice"],       // 2nd duplicate occurrence of row 0
    ];

    const result = detectDuplicateRows(headers, rows);
    expect(result.totalDuplicateCount).toBe(2);
    expect(result.duplicateGroupCount).toBe(1);
  });

  it("ignores fully blank rows during duplicate detection", () => {
    const headers = ["a", "b"];
    const rows = [
      ["", ""],
      ["", ""],
      ["1", "2"],
      ["1", "2"],
    ];

    const result = detectDuplicateRows(headers, rows);
    expect(result.totalDuplicateCount).toBe(1);
  });
});

describe("Unnecessary Whitespace Detection (PRD §8.4)", () => {
  it("detects leading and trailing whitespace without flagging internal spaces", () => {
    const headers = ["title", "author"];
    const rows = [
      ["  Data Science  ", "John Doe"], // title has both; author has internal space only
      ["Clean Title", " Jane Smith\t"],  // author has leading space and trailing tab
    ];

    const result = detectUnnecessaryWhitespace(headers, rows);
    expect(result.totalWhitespaceCells).toBe(2);

    const titleFinding = result.findings.find((f) => f.column === "title");
    expect(titleFinding?.bothWhitespaceCount).toBe(1);

    const authorFinding = result.findings.find((f) => f.column === "author");
    expect(authorFinding?.bothWhitespaceCount).toBe(1);
  });

  it("does not double-count whitespace-only cells as whitespace issues", () => {
    const headers = ["notes"];
    const rows = [
      ["   "], // Whitespace-only cell -> must only be counted in Missing Values
      ["actual note "], // Has trailing whitespace
    ];

    const result = detectUnnecessaryWhitespace(headers, rows);
    expect(result.totalWhitespaceCells).toBe(1);
  });
});

describe("Complete Data Quality Aggregation (PRD §15.12)", () => {
  it("orchestrates all 4 modules and aggregates total issue instances", () => {
    const headers = ["id", "date", "status"];
    const rows = [
      ["1", "2026-01-01", "active "], // whitespace in status
      ["2", "2026-01-02", "active"],
      ["3", "", "active"],           // missing in date
      ["2", "2026-01-02", "active"], // duplicate row of row 1
    ];

    const { summary, detailedFindings, totalIssueInstances } = runDataQualityAnalysis(headers, rows);

    expect(summary.totalRows).toBe(4);
    expect(summary.totalColumns).toBe(3);
    expect(totalIssueInstances).toBeGreaterThan(0);

    const issueTypes = detailedFindings.map((f) => f.issueType);
    expect(issueTypes).toContain(IssueType.MISSING_VALUES);
    expect(issueTypes).toContain(IssueType.EXACT_DUPLICATE_ROWS);
    expect(issueTypes).toContain(IssueType.UNNECESSARY_WHITESPACE);
  });
});
