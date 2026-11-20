/**
 * DataMedics CSV Analysis Types (PRD §8 and csv-data-quality-analysis skill)
 * Covers the four approved deterministic checks:
 * 1. Missing values
 * 2. Exact duplicate rows
 * 3. Inconsistent formats
 * 4. Unnecessary whitespace
 */

import { DetectionStatus, IssueType } from "./models";

export interface ColumnProfile {
  name: string;
  index: number;
  totalValues: number;
  nonEmptyValues: number;
  emptyValues: number;
}

export interface InconsistentFormatFinding {
  column: string;
  detectedStatus: DetectionStatus;
  detectedPattern: string | null;
  matchPercentage: number | null;
  matchingCount: number;
  nonMatchingCount: number;
  unclassifiedCount: number;
  details: Record<string, unknown>;
}

export interface MissingValueFinding {
  column: string;
  emptyCellCount: number;
  whitespaceOnlyCellCount: number;
  totalMissingCount: number;
}

export interface DuplicateRowFinding {
  duplicateRowCount: number;
  firstOccurrenceIndices: number[];
}

export interface WhitespaceFinding {
  column: string;
  leadingWhitespaceCount: number;
  trailingWhitespaceCount: number;
  bothWhitespaceCount: number;
  totalWhitespaceCells: number;
}

export interface AnalysisSummary {
  totalRows: number;
  totalColumns: number;
  headerRow: string[];
  totalIssues: number;
  missingValues: MissingValueFinding[];
  duplicateRows: DuplicateRowFinding;
  inconsistentFormats: InconsistentFormatFinding[];
  unnecessaryWhitespace: WhitespaceFinding[];
  ignoredBlankRowCount: number;
}

export interface AnalysisFinding {
  issueType: IssueType;
  affectedColumn: string;
  issueCount: number;
  title: string;
  description: string;
  recommendation: string;
  detectionStatus: DetectionStatus;
  detectedPattern: string | null;
  matchingValueCount?: number;
  nonMatchingValueCount?: number;
  unclassifiedValueCount?: number;
  totalNonEmptyValueCount?: number;
  matchPercentage?: number | null;
  recognisedPatterns?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}
