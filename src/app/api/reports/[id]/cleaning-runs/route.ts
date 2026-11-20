/**
 * POST /api/reports/[id]/cleaning-runs
 *
 * Creates a new CleaningRun and enqueues the cleaning job.
 * PRD §14.3, §16.4
 *
 * Rules:
 * - User must be authenticated and own the report.
 * - Report must have status COMPLETED.
 * - At least one operation must be selected.
 * - Server generates the request fingerprint — client fingerprint is never trusted.
 * - If idempotencyKey matches an existing run for this user:
 *     - Same fingerprint → return existing run (idempotent success, 200)
 *     - Different fingerprint → 409 Conflict
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, assertOwnership } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";
import { getCleaningQueue } from "@/lib/queue";
import { generateRequestFingerprint } from "@/services/cleaning/fingerprint";
import { CleaningOperation, JobStatus } from "@/types/models";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id: reportId } = await params;
  const repo = getDataRepository();

  // ── Load and authorize report ─────────────────────────────────────────────
  const report = await repo.getAnalysisReport(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const upload = await repo.getUploadedFile(report.uploadedFileId);
  if (!upload) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  try {
    assertOwnership(upload.userId, user.id);
  } catch {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  // Report must be COMPLETED before cleaning can start
  if (report.status !== JobStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Analysis must be completed before cleaning can begin." },
      { status: 422 }
    );
  }

  // ── Parse request body ────────────────────────────────────────────────────
  let body: { selectedOperations?: unknown; idempotencyKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { selectedOperations, idempotencyKey } = body;

  // Validate operations
  const allowedOperations = new Set<string>(Object.values(CleaningOperation));
  if (
    !Array.isArray(selectedOperations) ||
    selectedOperations.length === 0 ||
    !selectedOperations.every((op) => allowedOperations.has(op))
  ) {
    return NextResponse.json(
      {
        error:
          "At least one valid operation must be selected: TRIM_WHITESPACE, REMOVE_BLANK_ROWS, REMOVE_DUPLICATE_ROWS.",
      },
      { status: 400 }
    );
  }

  const ops = selectedOperations as CleaningOperation[];

  // Validate idempotency key (optional but must be string if provided)
  const idemKey: string | undefined =
    typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : undefined;

  // ── Server-generated fingerprint ──────────────────────────────────────────
  const fingerprint = generateRequestFingerprint(reportId, ops);

  // ── Idempotency check ─────────────────────────────────────────────────────
  if (idemKey) {
    const existing = await repo.getCleaningRunByIdempotencyKey(user.id, idemKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return NextResponse.json(
          {
            error:
              "Idempotency key reused with a different request payload. Use a new idempotency key.",
          },
          { status: 409 }
        );
      }
      // Same fingerprint → idempotent success
      return NextResponse.json(
        {
          cleaningRunId: existing.id,
          status: existing.status,
          idempotent: true,
        },
        { status: 200 }
      );
    }
  }

  // ── Create CleaningRun record BEFORE enqueueing ───────────────────────────
  const originalRowCount = report.totalRows;

  const cleaningRun = await repo.createCleaningRun({
    userId: user.id,
    reportId,
    selectedOperations: ops,
    originalRowCount,
    idempotencyKey: idemKey,
    requestFingerprint: fingerprint,
  });

  // ── Enqueue cleaning job ──────────────────────────────────────────────────
  // Queue ID: cleaning-{cleaningRunId} (PRD §16.4)
  const queueJobId = `cleaning-${cleaningRun.id}`;
  try {
    const cleaningQueue = getCleaningQueue();
    await cleaningQueue.add(
      queueJobId,
      {
        cleaningRunId: cleaningRun.id,
        reportId,
        userId: user.id,
        idempotencyKey: idemKey ?? "",
        requestFingerprint: fingerprint,
      },
      {
        jobId: queueJobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch {
    // Queue unavailable — job will be recovered by reconciliation
    // CleaningRun record already persisted as authoritative state
  }

  return NextResponse.json(
    {
      cleaningRunId: cleaningRun.id,
      status: cleaningRun.status,
      idempotent: false,
    },
    { status: 201 }
  );
}
