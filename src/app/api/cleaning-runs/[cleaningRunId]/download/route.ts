/**
 * GET /api/cleaning-runs/[cleaningRunId]/download
 *
 * Authenticated download endpoint (PRD §11.5, §18)
 *
 * Rules:
 * - Authenticated user must own the cleaning run.
 * - Cleaning run must have status COMPLETED.
 * - Delivers ONLY the spreadsheet-safe representation (J04).
 * - Never delivers unneutralized formulas to spreadsheet downloads.
 * - Never exposes raw storage keys or permanent URLs.
 * - Blocks expired and deleted files (returns 410 Gone).
 * - Correct Content-Type, Content-Disposition (attachment), and anti-caching headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";
import { getStorageProvider } from "@/lib/storage";
import { JobStatus, DeletionStatus } from "@/types/models";

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

  // Check expiration or deletion (PRD §11.5, §21.5: block download of expired/deleted files)
  const isExpired = cleanedFile.expiresAt ? cleanedFile.expiresAt <= new Date() : false;
  const isDeleted =
    cleanedFile.deletionStatus === DeletionStatus.COMPLETED ||
    Boolean(cleanedFile.safeExportFileDeletedAt) ||
    Boolean(cleanedFile.fileDeletedAt);

  if (isExpired || isDeleted) {
    return NextResponse.json(
      { error: "This cleaned file has expired or been deleted and is no longer available for download." },
      { status: 410 }
    );
  }

  // Retrieve ONLY the spreadsheet-safe representation
  let safeBuffer: Buffer;
  try {
    safeBuffer = await storage.getObject(cleanedFile.safeExportStorageKey);
  } catch {
    return NextResponse.json(
      { error: "Cleaned file could not be retrieved from storage." },
      { status: 500 }
    );
  }

  // Return download response with safe headers
  return new NextResponse(safeBuffer.toString("utf-8"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${cleanedFile.filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
