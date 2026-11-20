/**
 * Inconsistent Format Detection Engine (PRD §8.3, J03, and FD-001 through FD-016)
 * 
 * Rules:
 * - 80% threshold of non-empty values (unrounded ratio >= 0.80).
 * - Minimum 2 distinct non-empty values required to establish a pattern baseline.
 * - Empty and whitespace-only values excluded from denominator.
 * - Do not infer types from column names.
 * - Ambiguous dates or numbers result in NOT_ASSESSED.
 * - Multiple competing dominant patterns result in NOT_ASSESSED.
 * - Casing differences alone do not constitute inconsistent format.
 */

import { DetectionStatus } from "@/types/models";
import { InconsistentFormatFinding } from "@/types/analysis";
import {
  SUPPORTED_PATTERNS,
  PATTERN_CATALOGUE_VERSION,
  PatternDefinition,
} from "./patterns";

export const FORMAT_THRESHOLD = 0.8;

export interface ColumnFormatAnalysis {
  finding: InconsistentFormatFinding;
  hasIssue: boolean;
  issueCount: number;
}

export function assessColumnFormat(
  columnName: string,
  values: string[]
): ColumnFormatAnalysis {
  // 1. Filter non-empty and non-whitespace values
  const nonEmptyValues = values.filter((v) => v !== "" && v.trim() !== "");
  const totalNonEmpty = nonEmptyValues.length;

  // Rule: Insufficient non-empty values (< 2)
  if (totalNonEmpty < 2) {
    return createNotAssessedFinding(columnName, totalNonEmpty, "Fewer than two non-empty values available.");
  }

  // Rule: Minimum 2 distinct values required (case-insensitive distinct check to avoid casing-only baseline)
  const distinctValues = new Set(nonEmptyValues.map((v) => v.trim().toLowerCase()));
  if (distinctValues.size < 2) {
    return createNotAssessedFinding(
      columnName,
      totalNonEmpty,
      "Only one distinct value exists; baseline pattern cannot be established."
    );
  }

  // 2. Evaluate each supported pattern against all non-empty values
  const patternMatches: Array<{
    pattern: PatternDefinition;
    matchingCount: number;
    matchRatio: number;
  }> = [];

  for (const pattern of SUPPORTED_PATTERNS) {
    let count = 0;
    for (const val of nonEmptyValues) {
      if (pattern.match(val)) {
        count++;
      }
    }
    const ratio = count / totalNonEmpty;
    patternMatches.push({
      pattern,
      matchingCount: count,
      matchRatio: ratio,
    });
  }

  // Filter patterns meeting the 80% threshold
  const qualifyingPatterns = patternMatches.filter((p) => p.matchRatio >= FORMAT_THRESHOLD);

  if (qualifyingPatterns.length === 0) {
    // No pattern achieved the 80% threshold
    return createNotAssessedFinding(
      columnName,
      totalNonEmpty,
      `No supported pattern reached the ${Math.round(FORMAT_THRESHOLD * 100)}% consistency threshold.`
    );
  }

  // Check for competing dominant patterns in different categories or conflicting patterns
  if (qualifyingPatterns.length > 1) {
    // Check if the qualifying patterns are mutually conflicting (different categories or different dates)
    const distinctCategories = new Set(qualifyingPatterns.map((p) => p.pattern.category));
    if (distinctCategories.size > 1) {
      return createNotAssessedFinding(
        columnName,
        totalNonEmpty,
        "Multiple competing pattern categories reached the threshold."
      );
    }
  }

  // Best qualifying pattern
  qualifyingPatterns.sort((a, b) => b.matchRatio - a.matchRatio);
  const best = qualifyingPatterns[0];

  // Rule: If dominant pattern is ambiguous (e.g. ambiguous dates 03/04/2026), return NOT_ASSESSED
  if (best.pattern.isAmbiguous) {
    return createNotAssessedFinding(
      columnName,
      totalNonEmpty,
      `Dominant pattern is ambiguous (${best.pattern.name}). Cannot determine locale or format safely without locale rules.`
    );
  }

  const matchingCount = best.matchingCount;
  const nonMatchingCount = totalNonEmpty - matchingCount;
  const matchPercentage = Math.round((matchingCount / totalNonEmpty) * 10000) / 100; // Round to 2 decimal places

  // If 100% match, no inconsistent format issue exists
  if (nonMatchingCount === 0) {
    return {
      hasIssue: false,
      issueCount: 0,
      finding: {
        column: columnName,
        detectedStatus: DetectionStatus.NONE_DETECTED,
        detectedPattern: best.pattern.id,
        matchPercentage,
        matchingCount,
        nonMatchingCount: 0,
        unclassifiedCount: 0,
        details: {
          patternName: best.pattern.name,
          category: best.pattern.category,
          catalogueVersion: PATTERN_CATALOGUE_VERSION,
        },
      },
    };
  }

  // 80% to 99% match: Inconsistent formats detected!
  return {
    hasIssue: true,
    issueCount: nonMatchingCount,
    finding: {
      column: columnName,
      detectedStatus: DetectionStatus.DETECTED,
      detectedPattern: best.pattern.id,
      matchPercentage,
      matchingCount,
      nonMatchingCount,
      unclassifiedCount: 0,
      details: {
        patternName: best.pattern.name,
        category: best.pattern.category,
        catalogueVersion: PATTERN_CATALOGUE_VERSION,
        affectedValuesCount: nonMatchingCount,
      },
    },
  };
}

function createNotAssessedFinding(
  columnName: string,
  totalNonEmpty: number,
  reason: string
): ColumnFormatAnalysis {
  return {
    hasIssue: false,
    issueCount: 0,
    finding: {
      column: columnName,
      detectedStatus: DetectionStatus.NOT_ASSESSED,
      detectedPattern: null,
      matchPercentage: null,
      matchingCount: 0,
      nonMatchingCount: 0,
      unclassifiedCount: totalNonEmpty,
      details: {
        reason,
        catalogueVersion: PATTERN_CATALOGUE_VERSION,
      },
    },
  };
}

export function detectInconsistentFormats(
  headers: string[],
  rows: string[][]
): {
  findings: InconsistentFormatFinding[];
  totalFormatIssues: number;
} {
  const columnCount = headers.length;
  const findings: InconsistentFormatFinding[] = [];
  let totalFormatIssues = 0;

  for (let c = 0; c < columnCount; c++) {
    const colValues = rows.map((r) => r[c] ?? "");
    const analysis = assessColumnFormat(headers[c], colValues);

    findings.push(analysis.finding);
    if (analysis.hasIssue) {
      totalFormatIssues += analysis.issueCount;
    }
  }

  return {
    findings,
    totalFormatIssues,
  };
}
