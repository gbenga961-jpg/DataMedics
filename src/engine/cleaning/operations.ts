/**
 * DataMedics Controlled Cleaning Operations (PRD §9)
 * Exactly 3 approved operations in fixed order:
 * 1. trimWhitespace  — trim leading/trailing whitespace from every cell (excluding blank rows)
 * 2. removeBlankRows — remove fully blank rows (all cells empty or whitespace-only)
 * 3. removeDuplicateRows — remove exact duplicate rows keeping first occurrence
 *
 * INVARIANTS:
 * - Operations NEVER modify the caller's input arrays (clone first).
 * - Only the approved Unicode whitespace characters from whitespace.ts are considered.
 * - "Fully blank row" = every cell is empty string or whitespace-only.
 * - Duplicate comparison is exact string equality (no normalization).
 */

/** True if every cell in a row is empty or contains only whitespace */
export function isFullyBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

export interface TrimResult {
  rows: string[][];
  /** Number of individual cells trimmed (a cell is counted if it changed) */
  count: number;
}

/**
 * Trim leading and trailing whitespace from every cell in every non-blank row.
 * Fully blank rows pass through unchanged (they will be handled by removeBlankRows if selected).
 * Headers are NOT trimmed here — they are managed separately and passed through.
 */
export function trimWhitespace(rows: string[][]): TrimResult {
  let count = 0;
  const trimmed = rows.map((row) => {
    if (isFullyBlankRow(row)) {
      // Fully blank row: pass through untouched
      return row.slice();
    }
    return row.map((cell) => {
      const t = cell.trim();
      if (t !== cell) count++;
      return t;
    });
  });
  return { rows: trimmed, count };
}

export interface RemoveBlankRowsResult {
  rows: string[][];
  removed: number;
}

/** Remove every row where all cells are empty or whitespace-only. */
export function removeBlankRows(rows: string[][]): RemoveBlankRowsResult {
  const kept: string[][] = [];
  let removed = 0;
  for (const row of rows) {
    if (isFullyBlankRow(row)) {
      removed++;
    } else {
      kept.push(row.slice());
    }
  }
  return { rows: kept, removed };
}

export interface RemoveDuplicateRowsResult {
  rows: string[][];
  removed: number;
}

/**
 * Remove exact duplicate rows keeping the first occurrence.
 * Comparison is exact string equality on every cell — no trimming, no case folding.
 * Fully blank rows are NOT treated specially here; they participate in deduplication
 * like any other row (PRD §9: "Remove exact duplicate rows").
 */
export function removeDuplicateRows(rows: string[][]): RemoveDuplicateRowsResult {
  const seen = new Set<string>();
  const kept: string[][] = [];
  let removed = 0;

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      removed++;
    } else {
      seen.add(key);
      kept.push(row.slice());
    }
  }

  return { rows: kept, removed };
}
