/**
 * GET /api/cleaning-runs/[cleaningRunId]
 *
 * Returns the status and summary of a CleaningRun.
 * PRD §14.3
 *
 * Security: ownership enforced — user must own the report linked to this run.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";

interface RouteParams {
  params: Promise<{ cleaningRunId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { cleaningRunId } = await params;
  const repo = getDataRepository();

  const run = await repo.getCleaningRun(cleaningRunId);
  if (!run) {
    return NextResponse.json({ error: "Cleaning run not found." }, { status: 404 });
  }

  // Enforce ownership via userId on the CleaningRun record
  if (run.userId !== user.id) {
    return NextResponse.json({ error: "Cleaning run not found." }, { status: 404 });
  }

  // Load cleaned file if available
  const cleanedFile = await repo.getCleanedFileByRun(cleaningRunId);

  // Load remaining issues if completed
  const remainingIssues =
    run.status === "COMPLETED" ? await repo.getCleaningResultIssues(cleaningRunId) : [];

  return NextResponse.json({
    cleaningRun: {
      id: run.id,
      reportId: run.reportId,
      status: run.status,
      selectedOperations: run.selectedOperations,
      originalRowCount: run.originalRowCount,
      finalRowCount: run.finalRowCount,
      whitespaceCellsTrimmed: run.whitespaceCellsTrimmed,
      blankRowsRemoved: run.blankRowsRemoved,
      duplicateRowsRemoved: run.duplicateRowsRemoved,
      attempts: run.attempts,
      lastErrorCode: run.lastErrorCode,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
    },
    cleanedFile: cleanedFile
      ? {
          id: cleanedFile.id,
          filename: cleanedFile.filename,
          fileSizeBytes: cleanedFile.fileSizeBytes,
          rowCount: cleanedFile.rowCount,
          columnCount: cleanedFile.columnCount,
          createdAt: cleanedFile.createdAt,
          expiresAt: cleanedFile.expiresAt,
        }
      : null,
    remainingIssues: remainingIssues.map((iss) => ({
      id: iss.id,
      issueType: iss.issueType,
      affectedColumn: iss.affectedColumn,
      issueCount: iss.issueCount,
      recommendation: iss.recommendation,
      detectionStatus: iss.detectionStatus,
      detectedPattern: iss.detectedPattern,
      details: iss.details,
    })),
  });
}
