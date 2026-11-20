/**
 * Analysis Service Boundaries (PRD §8, §13)
 */

import { AnalysisSummary } from "@/types/analysis";

export interface AnalysisService {
  createAnalysisReport(uploadedFileId: string, userId: string): Promise<string>;
  getAnalysisReport(reportId: string, userId: string): Promise<AnalysisSummary | null>;
}
