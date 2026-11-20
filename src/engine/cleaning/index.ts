/**
 * CSV Controlled Cleaning Engine (PRD §9)
 * Execution order (fixed):
 * 1. Trim leading and trailing whitespace
 * 2. Remove fully blank rows
 * 3. Remove exact duplicate rows
 */

export { executeCleaning } from "./runner";
export type { CleaningRunnerResult } from "./runner";

export { trimWhitespace, removeBlankRows, removeDuplicateRows, isFullyBlankRow } from "./operations";
export type { TrimResult, RemoveBlankRowsResult, RemoveDuplicateRowsResult } from "./operations";

export { serializeToCanonicalCsv } from "./serializer";
