/**
 * Unnecessary Whitespace Detection Engine (PRD §8.4 and csv-data-quality-analysis skill)
 * 
 * Rules:
 * - Detects leading or trailing spaces, tabs, newlines, and Unicode whitespace.
 * - Does NOT flag internal spaces between words (e.g., "John Doe" is valid).
 * - Excludes headers.
 * - Excludes fully blank rows.
 * - Whitespace-only cells are missing values only; NEVER double-counted as whitespace issues.
 * - Counts each affected cell once, even if both leading and trailing whitespace exist.
 */

import { WhitespaceFinding } from "@/types/analysis";
import { isFullyBlankRow } from "@/engine/csv/validator";

// Extended whitespace regex including ASCII spaces, tabs, newlines and Unicode whitespace
const LEADING_WHITESPACE_REGEX = /^[\s\u00A0\u2000-\u200B\u3000]+/;
const TRAILING_WHITESPACE_REGEX = /[\s\u00A0\u2000-\u200B\u3000]+$/;

export interface WhitespaceAnalysisResult {
  findings: WhitespaceFinding[];
  totalWhitespaceCells: number;
}

export function detectUnnecessaryWhitespace(
  headers: string[],
  rows: string[][]
): WhitespaceAnalysisResult {
  const columnCount = headers.length;
  const colLeading = new Array<number>(columnCount).fill(0);
  const colTrailing = new Array<number>(columnCount).fill(0);
  const colBoth = new Array<number>(columnCount).fill(0);
  const colTotal = new Array<number>(columnCount).fill(0);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    if (isFullyBlankRow(row)) {
      continue; // Exclude fully blank rows
    }

    for (let c = 0; c < columnCount; c++) {
      const cell = row[c] ?? "";

      // Rule: Empty cells and whitespace-only cells are excluded from whitespace count
      // (whitespace-only cells are classified as MISSING_VALUES to prevent double-counting)
      if (cell === "" || cell.trim() === "") {
        continue;
      }

      const hasLeading = LEADING_WHITESPACE_REGEX.test(cell);
      const hasTrailing = TRAILING_WHITESPACE_REGEX.test(cell);

      if (hasLeading && hasTrailing) {
        colBoth[c]++;
        colTotal[c]++;
      } else if (hasLeading) {
        colLeading[c]++;
        colTotal[c]++;
      } else if (hasTrailing) {
        colTrailing[c]++;
        colTotal[c]++;
      }
    }
  }

  const findings: WhitespaceFinding[] = [];
  let totalWhitespaceCells = 0;

  for (let c = 0; c < columnCount; c++) {
    const total = colTotal[c];
    if (total > 0) {
      findings.push({
        column: headers[c],
        leadingWhitespaceCount: colLeading[c],
        trailingWhitespaceCount: colTrailing[c],
        bothWhitespaceCount: colBoth[c],
        totalWhitespaceCells: total,
      });
      totalWhitespaceCells += total;
    }
  }

  return {
    findings,
    totalWhitespaceCells,
  };
}
