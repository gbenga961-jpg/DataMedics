/**
 * Data Quality Analysis Aggregator
 * Orchestrates all 4 approved detection modules (PRD §8 and §15.12):
 * 1. Missing values
 * 2. Exact duplicate rows
 * 3. Inconsistent formats
 * 4. Unnecessary whitespace
 */

import {
  AnalysisSummary,
  AnalysisFinding,
} from "@/types/analysis";
import { IssueType, DetectionStatus } from "@/types/models";
import { detectMissingValues } from "./missing";
import { detectDuplicateRows } from "./duplicates";
import { detectInconsistentFormats } from "./formats";
import { detectUnnecessaryWhitespace } from "./whitespace";

export interface AggregatedAnalysisResult {
  summary: AnalysisSummary;
  detailedFindings: AnalysisFinding[];
  totalIssueInstances: number;
}

export function runDataQualityAnalysis(
  headers: string[],
  rows: string[][]
): AggregatedAnalysisResult {
  const missingResult = detectMissingValues(headers, rows);
  const duplicateResult = detectDuplicateRows(headers, rows);
  const formatResult = detectInconsistentFormats(headers, rows);
  const whitespaceResult = detectUnnecessaryWhitespace(headers, rows);

  const totalIssueInstances =
    missingResult.totalMissingCount +
    duplicateResult.totalDuplicateCount +
    formatResult.totalFormatIssues +
    whitespaceResult.totalWhitespaceCells;

  const summary: AnalysisSummary = {
    totalRows: rows.length,
    totalColumns: headers.length,
    headerRow: headers,
    totalIssues: totalIssueInstances,
    missingValues: missingResult.findings,
    duplicateRows: duplicateResult.finding,
    inconsistentFormats: formatResult.findings,
    unnecessaryWhitespace: whitespaceResult.findings,
    ignoredBlankRowCount: missingResult.ignoredBlankRowCount,
  };

  const detailedFindings: AnalysisFinding[] = [];

  // 1. Missing Values Findings
  for (const mv of missingResult.findings) {
    detailedFindings.push({
      issueType: IssueType.MISSING_VALUES,
      affectedColumn: mv.column,
      issueCount: mv.totalMissingCount,
      title: `Missing values in column '${mv.column}'`,
      description: `${mv.totalMissingCount} empty or whitespace-only cells identified.`,
      recommendation: "Review empty cells or configure controlled cleaning to handle blank records.",
      detectionStatus: DetectionStatus.DETECTED,
      detectedPattern: null,
      details: {
        emptyCellCount: mv.emptyCellCount,
        whitespaceOnlyCellCount: mv.whitespaceOnlyCellCount,
      },
    });
  }

  // 2. Duplicate Rows Finding
  if (duplicateResult.totalDuplicateCount > 0) {
    detailedFindings.push({
      issueType: IssueType.EXACT_DUPLICATE_ROWS,
      affectedColumn: "ALL_COLUMNS",
      issueCount: duplicateResult.totalDuplicateCount,
      title: "Exact duplicate rows detected",
      description: `${duplicateResult.totalDuplicateCount} duplicate row occurrences identified across ${duplicateResult.duplicateGroupCount} distinct record groups.`,
      recommendation: "Select 'Remove exact duplicate rows' cleaning operation to retain only the first occurrence.",
      detectionStatus: DetectionStatus.DETECTED,
      detectedPattern: null,
      details: {
        duplicateGroupCount: duplicateResult.duplicateGroupCount,
        firstOccurrenceIndices: duplicateResult.finding.firstOccurrenceIndices,
      },
    });
  }

  // 3. Inconsistent Formats Findings
  for (const fmt of formatResult.findings) {
    if (fmt.detectedStatus === DetectionStatus.DETECTED) {
      detailedFindings.push({
        issueType: IssueType.INCONSISTENT_FORMATS,
        affectedColumn: fmt.column,
        issueCount: fmt.nonMatchingCount,
        title: `Inconsistent format in column '${fmt.column}'`,
        description: `${fmt.nonMatchingCount} values deviate from the dominant pattern '${fmt.detectedPattern}' (${fmt.matchPercentage}% match).`,
        recommendation: "Review non-conforming values. DataMedics does not automatically overwrite or guess formats.",
        detectionStatus: DetectionStatus.DETECTED,
        detectedPattern: fmt.detectedPattern,
        matchPercentage: fmt.matchPercentage,
        matchingValueCount: fmt.matchingCount,
        nonMatchingValueCount: fmt.nonMatchingCount,
        unclassifiedValueCount: fmt.unclassifiedCount,
        totalNonEmptyValueCount: fmt.matchingCount + fmt.nonMatchingCount,
        details: fmt.details,
      });
    }
  }

  // 4. Unnecessary Whitespace Findings
  for (const ws of whitespaceResult.findings) {
    detailedFindings.push({
      issueType: IssueType.UNNECESSARY_WHITESPACE,
      affectedColumn: ws.column,
      issueCount: ws.totalWhitespaceCells,
      title: `Unnecessary whitespace in column '${ws.column}'`,
      description: `${ws.totalWhitespaceCells} cells contain leading or trailing whitespace.`,
      recommendation: "Select 'Trim leading and trailing whitespace' in controlled cleaning.",
      detectionStatus: DetectionStatus.DETECTED,
      detectedPattern: null,
      details: {
        leadingWhitespaceCount: ws.leadingWhitespaceCount,
        trailingWhitespaceCount: ws.trailingWhitespaceCount,
        bothWhitespaceCount: ws.bothWhitespaceCount,
      },
    });
  }

  return {
    summary,
    detailedFindings,
    totalIssueInstances,
  };
}
