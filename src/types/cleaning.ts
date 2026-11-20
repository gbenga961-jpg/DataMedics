/**
 * DataMedics Controlled Cleaning Types (PRD §9 and controlled-csv-cleaning skill)
 * Covers the 3 approved operations in fixed order:
 * 1. Trim leading and trailing whitespace
 * 2. Remove fully blank rows
 * 3. Remove exact duplicate rows
 */

import { CleaningOperation } from "./models";
import { AnalysisSummary } from "./analysis";

export interface CleaningOptions {
  trimWhitespace: boolean;
  removeBlankRows: boolean;
  removeDuplicateRows: boolean;
}

export interface CleaningMetrics {
  originalRowCount: number;
  finalRowCount: number;
  whitespaceCellsTrimmed: number;
  blankRowsRemoved: number;
  duplicateRowsRemoved: number;
  exportProtectedValueCount: number;
}

export interface CleaningResult {
  canonicalCsv: string;
  spreadsheetSafeCsv: string;
  metrics: CleaningMetrics;
  remainingFindings: AnalysisSummary;
}

export interface CleaningConfirmationRequest {
  reportId: string;
  selectedOperations: CleaningOperation[];
  idempotencyKey: string;
}
