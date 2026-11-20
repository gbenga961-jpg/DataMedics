/**
 * Exact Duplicate Rows Detection Rule (PRD §8.2 and csv-data-quality-analysis skill)
 * Rules:
 * - Excludes header and fully blank rows.
 * - Compares all parsed data column values as exact strings (no trimming, no lowercasing).
 * - Reports duplicate occurrences beyond the first occurrence.
 * - Reports duplicate group count.
 */

import { DuplicateRowFinding } from "@/types/analysis";
import { isFullyBlankRow } from "@/engine/csv/validator";

export interface DuplicateAnalysisResult {
  finding: DuplicateRowFinding;
  totalDuplicateCount: number;
  duplicateGroupCount: number;
}

export function detectDuplicateRows(
  headers: string[],
  rows: string[][]
): DuplicateAnalysisResult {
  // Map row fingerprint to list of row indices (0-based)
  const seenRows = new Map<string, number[]>();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    if (isFullyBlankRow(row)) {
      continue; // Exclude fully blank rows from duplicate detection
    }

    // Delimit fields unambiguously using ASCII unit separator \x1F to avoid collision
    const fingerprint = row.join("\x1F");

    const existing = seenRows.get(fingerprint);
    if (existing) {
      existing.push(r);
    } else {
      seenRows.set(fingerprint, [r]);
    }
  }

  let totalDuplicateOccurrences = 0;
  let duplicateGroupCount = 0;
  const firstOccurrenceIndices: number[] = [];

  for (const indices of seenRows.values()) {
    if (indices.length > 1) {
      duplicateGroupCount++;
      // Every occurrence beyond the first is a duplicate
      totalDuplicateOccurrences += indices.length - 1;
      firstOccurrenceIndices.push(indices[0]);
    }
  }

  return {
    finding: {
      duplicateRowCount: totalDuplicateOccurrences,
      firstOccurrenceIndices,
    },
    totalDuplicateCount: totalDuplicateOccurrences,
    duplicateGroupCount,
  };
}
