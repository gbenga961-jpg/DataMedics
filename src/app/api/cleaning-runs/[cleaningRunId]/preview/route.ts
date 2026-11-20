/**
 * GET /api/cleaning-runs/[cleaningRunId]/preview
 *
 * Cleaned-data preview endpoint (PRD §10, §11, §18)
 *
 * Rules:
 * - Authenticated user must own the cleaning run.
 * - Cleaning run must have status COMPLETED.
 * - Expired or deleted files return 410 Gone.
 * - Default 50-row server-side pagination (never loads entire file into browser memory).
 * - Original headers and column order preserved.
 * - Cleaned rows rendered as plain text.
 * - Never exposes storage keys.
 * - Includes cleaning metrics, remaining findings, and export-safety disclosure.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";
import { getStorageProvider } from "@/lib/storage";
import { parseCsv } from "@/engine/csv/parser";
import { EXPORT_SAFETY_DISCLOSURE } from "@/engine/export";
import { JobStatus, DeletionStatus } from "@/types/models";

interface RouteParams {
  params: Promise<{ cleaningRunId: string }>;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { cleaningRunId } = await params;
  const repo = getDataRepository();
  const storage = getStorageProvider();

  const run = await repo.getCleaningRun(cleaningRunId);
  if (!run) {
    return NextResponse.json({ error: "Cleaning run not found." }, { status: 404 });
  }

  // Enforce ownership
  if (run.userId !== user.id) {
    return NextResponse.json({ error: "Cleaning run not found." }, { status: 404 });
  }

  if (run.status !== JobStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Cleaning run is not completed yet." },
      { status: 400 }
    );
  }

  const cleanedFile = await repo.getCleanedFileByRun(cleaningRunId);
  if (!cleanedFile) {
    return NextResponse.json({ error: "Cleaned file not found." }, { status: 404 });
  }

  // Check expiration or deletion (PRD §21.5: block preview of expired objects)
  const isExpired = cleanedFile.expiresAt ? cleanedFile.expiresAt <= new Date() : false;
  const isDeleted =
    cleanedFile.deletionStatus === DeletionStatus.COMPLETED ||
    Boolean(cleanedFile.canonicalFileDeletedAt) ||
    Boolean(cleanedFile.fileDeletedAt);

  if (isExpired || isDeleted) {
    return NextResponse.json(
      { error: "This cleaned output has expired and is no longer available for preview." },
      { status: 410 }
    );
  }

  // Parse pagination params
  const url = new URL(req.url);
  const pageParam = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSizeParam = parseInt(url.searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`, 10);

  const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, isNaN(pageSizeParam) ? DEFAULT_PAGE_SIZE : pageSizeParam)
  );

  // Load canonical CSV from private storage
  let canonicalBuffer: Buffer;
  try {
    canonicalBuffer = await storage.getObject(cleanedFile.canonicalStorageKey);
  } catch {
    return NextResponse.json(
      { error: "Cleaned data could not be retrieved from storage." },
      { status: 500 }
    );
  }

  // Parse canonical CSV
  let headers: string[];
  let allRows: string[][];
  try {
    const parsed = parseCsv(canonicalBuffer);
    headers = parsed.headers;
    allRows = parsed.rows;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse cleaned CSV data." },
      { status: 500 }
    );
  }

  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  // Load remaining issues
  const remainingIssues = await repo.getCleaningResultIssues(cleaningRunId);

  return NextResponse.json({
    headers,
    rows: paginatedRows,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
    metrics: {
      originalRowCount: run.originalRowCount,
      finalRowCount: run.finalRowCount ?? totalRows,
      whitespaceCellsTrimmed: run.whitespaceCellsTrimmed,
      blankRowsRemoved: run.blankRowsRemoved,
      duplicateRowsRemoved: run.duplicateRowsRemoved,
      exportProtectedValueCount: run.exportProtectedValueCount,
    },
    remainingIssues: remainingIssues.map((iss) => ({
      id: iss.id,
      issueType: iss.issueType,
      affectedColumn: iss.affectedColumn,
      issueCount: iss.issueCount,
      recommendation: iss.recommendation,
      detectionStatus: iss.detectionStatus,
      detectedPattern: iss.detectedPattern,
    })),
    disclosure: EXPORT_SAFETY_DISCLOSURE,
    filename: cleanedFile.filename,
    expiresAt: cleanedFile.expiresAt,
  });
}
