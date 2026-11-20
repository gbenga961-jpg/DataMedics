/**
 * Cleaning Service Boundaries (PRD §9, §13)
 */

import { CleaningOperation } from "@/types/models";
import { CleaningResult } from "@/types/cleaning";

export interface CleaningService {
  requestCleaningRun(
    reportId: string,
    userId: string,
    operations: CleaningOperation[],
    idempotencyKey: string
  ): Promise<string>;
  getCleaningResult(cleaningRunId: string, userId: string): Promise<CleaningResult | null>;
}
