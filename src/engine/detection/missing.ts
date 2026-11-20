/**
 * Missing Values Detection Rule (PRD §8.1 and csv-data-quality-analysis skill)
 * Rules:
 * - Empty string or whitespace-only cells count as missing.
 * - Legitimate business values ('0', '0.00', 'N/A', 'NULL', 'null', '-', etc.) are NOT missing.
 * - Fully blank rows are excluded from the main missing-value count and reported as ignoredBlankRowCount.
 */

import { MissingValueFinding } from "@/types/analysis";
import { isFullyBlankRow } from "@/engine/csv/validator";

export interface MissingValueAnalysisResult {
  findings: MissingValueFinding[];
  totalMissingCount: number;
  ignoredBlankRowCount: number;
}

export function detectMissingValues(
  headers: string[],
  rows: string[][]
): MissingValueAnalysisResult {
  const columnCount = headers.length;
  const colEmptyCounts = new Array<number>(columnCount).fill(0);
  const colWhitespaceCounts = new Array<number>(columnCount).fill(0);

  let ignoredBlankRowCount = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    if (isFullyBlankRow(row)) {
      ignoredBlankRowCount++;
      continue; // Exclude fully blank rows from main missing-value counts
    }

    for (let c = 0; c < columnCount; c++) {
      const cell = row[c] ?? "";

      if (cell === "") {
        colEmptyCounts[c]++;
      } else if (cell.trim() === "") {
        // Whitespace-only cell
        colWhitespaceCounts[c]++;
      }
    }
  }

  const findings: MissingValueFinding[] = [];
  let totalMissingCount = 0;

  for (let c = 0; c < columnCount; c++) {
    const emptyCount = colEmptyCounts[c];
    const wsCount = colWhitespaceCounts[c];
    const totalColMissing = emptyCount + wsCount;

    if (totalColMissing > 0) {
      findings.push({
        column: headers[c],
        emptyCellCount: emptyCount,
        whitespaceOnlyCellCount: wsCount,
        totalMissingCount: totalColMissing,
      });
      totalMissingCount += totalColMissing;
    }
  }

  return {
    findings,
    totalMissingCount,
    ignoredBlankRowCount,
  };
}
