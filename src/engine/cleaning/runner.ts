/**
 * Cleaning Runner — orchestrates 3 approved operations in fixed order (PRD §9)
 *
 * Fixed execution order:
 * 1. Trim leading/trailing whitespace  (if selected)
 * 2. Remove fully blank rows           (if selected)
 * 3. Remove exact duplicate rows       (if selected)
 *
 * INVARIANT: The caller's input arrays are NEVER mutated (deep clones used).
 */

import { CleaningOptions, CleaningMetrics } from "@/types/cleaning";
import { trimWhitespace, removeBlankRows, removeDuplicateRows } from "./operations";

export interface CleaningRunnerResult {
  outputHeaders: string[];
  outputRows: string[][];
  metrics: CleaningMetrics;
}

/**
 * Execute cleaning operations on the provided headers and rows.
 *
 * @param headers - Column headers (read-only; returned as-is)
 * @param rows    - Data rows (deep-cloned before any mutation)
 * @param options - Which of the 3 operations to apply
 */
export function executeCleaning(
  headers: string[],
  rows: string[][],
  options: CleaningOptions
): CleaningRunnerResult {
  const originalRowCount = rows.length;

  // Deep clone inputs to guarantee immutability of caller's data
  let workingRows: string[][] = rows.map((r) => r.slice());

  let whitespaceCellsTrimmed = 0;
  let blankRowsRemoved = 0;
  let duplicateRowsRemoved = 0;

  // ── Step 1: Trim whitespace ──────────────────────────────────────────────
  if (options.trimWhitespace) {
    const result = trimWhitespace(workingRows);
    workingRows = result.rows;
    whitespaceCellsTrimmed = result.count;
  }

  // ── Step 2: Remove blank rows ────────────────────────────────────────────
  if (options.removeBlankRows) {
    const result = removeBlankRows(workingRows);
    workingRows = result.rows;
    blankRowsRemoved = result.removed;
  }

  // ── Step 3: Remove duplicate rows ────────────────────────────────────────
  if (options.removeDuplicateRows) {
    const result = removeDuplicateRows(workingRows);
    workingRows = result.rows;
    duplicateRowsRemoved = result.removed;
  }

  const finalRowCount = workingRows.length;

  const metrics: CleaningMetrics = {
    originalRowCount,
    finalRowCount,
    whitespaceCellsTrimmed,
    blankRowsRemoved,
    duplicateRowsRemoved,
    exportProtectedValueCount: 0, // Set by Milestone 5 safe-export step
  };

  return {
    outputHeaders: headers.slice(), // defensive copy
    outputRows: workingRows,
    metrics,
  };
}
