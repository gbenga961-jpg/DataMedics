/**
 * Technical Acceptance Suite J03 — Format Detection (PRD §8.3, J03)
 * Test Cases: FD-001 through FD-016
 */

import { describe, it, expect } from "vitest";
import { assessColumnFormat } from "@/engine/detection/formats";
import { DetectionStatus } from "@/types/models";

describe("Suite J03 — Format Detection Acceptance Tests (FD-001 - FD-016)", () => {
  it("FD-001: 80% threshold boundary qualifies", () => {
    // 4 out of 5 values (80%) match ISO date, 1 is invalid
    const values = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "not-a-date",
    ];
    const result = assessColumnFormat("date_col", values);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.DETECTED);
    expect(result.finding.detectedPattern).toBe("DATE_ISO_8601");
    expect(result.hasIssue).toBe(true);
    expect(result.issueCount).toBe(1);
    expect(result.finding.matchPercentage).toBe(80);
  });

  it("FD-002: Values below threshold result in NOT_ASSESSED", () => {
    // 3 out of 5 (60%) match, below 80%
    const values = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "invalid-one",
      "invalid-two",
    ];
    const result = assessColumnFormat("mixed_col", values);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
    expect(result.hasIssue).toBe(false);
  });

  it("FD-003: Minimum two distinct values required to establish baseline", () => {
    // 2 distinct dates
    const values = ["2026-01-01", "2026-02-01"];
    const result = assessColumnFormat("date_col", values);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
    expect(result.finding.detectedPattern).toBe("DATE_ISO_8601");
  });

  it("FD-004: Single distinct value results in NOT_ASSESSED", () => {
    // All 5 rows have the exact same date value
    const values = [
      "2026-01-01",
      "2026-01-01",
      "2026-01-01",
      "2026-01-01",
      "2026-01-01",
    ];
    const result = assessColumnFormat("constant_col", values);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
  });

  it("FD-005: Supported unambiguous date patterns recognized", () => {
    const isoDates = ["2026-05-10", "2026-06-15", "2026-07-20"];
    const result = assessColumnFormat("iso_dates", isoDates);
    expect(result.finding.detectedPattern).toBe("DATE_ISO_8601");
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
  });

  it("FD-006: Ambiguous date values result in NOT_ASSESSED", () => {
    // Ambiguous slash dates (e.g. 03/04/2026 vs 04/03/2026)
    const ambiguousDates = ["03/04/2026", "05/06/2026", "07/08/2026"];
    const result = assessColumnFormat("slash_dates", ambiguousDates);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
    expect(result.finding.detectedPattern).toBeNull();
  });

  it("FD-007: Supported numeric patterns recognized", () => {
    const decimals = ["10.5", "20.25", "-30.0", "40"];
    const result = assessColumnFormat("prices", decimals);
    expect(result.finding.detectedPattern).toBe("NUMERIC_STANDARD_DECIMAL");
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
  });

  it("FD-008: Ambiguous numeric separators result in NOT_ASSESSED", () => {
    // Values like 1.234 or 1,234 where thousand or decimal is ambiguous
    const ambiguousNums = ["1.234", "2.345", "3.456"];
    const result = assessColumnFormat("ambiguous_num", ambiguousNums);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
  });

  it("FD-009: Explicit boolean pairs recognized", () => {
    const booleans = ["true", "false", "TRUE", "True", "FALSE"];
    const result = assessColumnFormat("active", booleans);
    expect(result.finding.detectedPattern).toBe("BOOLEAN_TRUE_FALSE");
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
  });

  it("FD-010: Mixed boolean representations detected as format issue", () => {
    // 4 true/false, 1 numeric '1'
    const mixed = ["true", "false", "true", "false", "1"];
    const result = assessColumnFormat("flag", mixed);
    expect(result.finding.detectedPattern).toBe("BOOLEAN_TRUE_FALSE");
    expect(result.finding.detectedStatus).toBe(DetectionStatus.DETECTED);
    expect(result.hasIssue).toBe(true);
    expect(result.issueCount).toBe(1);
  });

  it("FD-011: Competing dominant patterns result in NOT_ASSESSED", () => {
    // 50% numbers, 50% dates
    const competing = ["100", "200", "2026-01-01", "2026-02-01"];
    const result = assessColumnFormat("competing", competing);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
  });

  it("FD-012: Casing-only variation does not trigger format inconsistency", () => {
    const casingOnly = ["true", "TRUE", "True", "false", "FALSE"];
    const result = assessColumnFormat("status", casingOnly);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
    expect(result.hasIssue).toBe(false);
  });

  it("FD-013: Empty values excluded from denominator", () => {
    // 4 valid ISO dates + 6 empty/whitespace cells = 4 non-empty values (100% of non-empty match)
    const values = [
      "2026-01-01",
      "",
      "2026-01-02",
      "   ",
      "2026-01-03",
      "",
      "2026-01-04",
      " ",
    ];
    const result = assessColumnFormat("dates_with_empties", values);
    expect(result.finding.matchingCount).toBe(4);
    expect(result.finding.matchPercentage).toBe(100);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NONE_DETECTED);
  });

  it("FD-014: No type inference from column name", () => {
    // Column name says 'Date', but values are decimal numbers
    const values = ["12.50", "34.75", "56.00", "78.25"];
    const result = assessColumnFormat("Date", values);
    expect(result.finding.detectedPattern).toBe("NUMERIC_STANDARD_DECIMAL");
  });

  it("FD-015: NOT_ASSESSED outcomes properly labeled with reason", () => {
    const unclassifiable = ["alpha", "beta", "gamma", "delta"];
    const result = assessColumnFormat("text_col", unclassifiable);
    expect(result.finding.detectedStatus).toBe(DetectionStatus.NOT_ASSESSED);
    expect(result.finding.details).toHaveProperty("reason");
  });

  it("FD-016: Deterministic repeatability and metadata preserved", () => {
    const values = ["2026-01-01", "2026-02-01", "invalid"];
    const run1 = assessColumnFormat("col", values);
    const run2 = assessColumnFormat("col", values);

    expect(run1).toEqual(run2);
    expect(run1.finding.details).toHaveProperty("catalogueVersion", "1.0.0");
  });
});
