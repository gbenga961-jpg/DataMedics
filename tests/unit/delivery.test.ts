/**
 * Milestone 5 — Preview & Download Delivery Tests (PRD §10, §11, §18, §21)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPreview } from "@/app/api/cleaning-runs/[cleaningRunId]/preview/route";
import { GET as getDownload } from "@/app/api/cleaning-runs/[cleaningRunId]/download/route";
import { getDataRepository } from "@/services/repository";
import { getStorageProvider } from "@/lib/storage";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { JobStatus, UploadStatus, CleaningOperation } from "@/types/models";
import { processCleaningJob } from "@/workers/cleaning.worker";

describe("Milestone 5 — Cleaned Data Preview & Authenticated Download", () => {
  const repo = getDataRepository();
  const storage = getStorageProvider();

  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    // Unique emails per test run
    const rand = Math.random().toString(36).substring(7);
    userA = await repo.createUser(`userA_${rand}@test.com`, "hash");
    userB = await repo.createUser(`userB_${rand}@test.com`, "hash");
    tokenA = createSessionToken({ id: userA.id, email: userA.email });
    tokenB = createSessionToken({ id: userB.id, email: userB.email });
  });

  async function setupCleanedRun(rowCount: number = 60) {
    // Generate CSV data with 60 rows to test 50-row pagination
    const headers = ["id", "name", "formula_col", "num_col"];
    const rows: string[] = [headers.join(",")];
    for (let i = 1; i <= rowCount; i++) {
      rows.push(`${i},Item_${i},=SUM(A${i}:B${i}),-${i * 10}`);
    }
    const csvContent = rows.join("\r\n") + "\r\n";

    const upload = await repo.createUploadedFile({
      userId: userA.id,
      filename: "test_items.csv",
      storageKey: `uploads/test_items_${Date.now()}.csv`,
      fileSizeBytes: csvContent.length,
      mimeType: "text/csv",
      rowCount,
      columnCount: 4,
      uploadStatus: UploadStatus.ACCEPTED,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
    await storage.putObject(upload.storageKey, Buffer.from(csvContent, "utf-8"), "text/csv");

    const report = await repo.createAnalysisReport({
      uploadedFileId: upload.id,
      totalRows: rowCount,
      totalColumns: 4,
    });
    await repo.updateReportStatus(report.id, JobStatus.COMPLETED, 0);

    const run = await repo.createCleaningRun({
      userId: userA.id,
      reportId: report.id,
      selectedOperations: [CleaningOperation.TRIM_WHITESPACE],
      originalRowCount: rowCount,
      requestFingerprint: `fp-${Date.now()}`,
    });

    await processCleaningJob(
      {
        cleaningRunId: run.id,
        reportId: report.id,
        userId: userA.id,
        idempotencyKey: "",
        requestFingerprint: `fp-${Date.now()}`,
      },
      repo,
      storage
    );

    return { upload, report, run };
  }

  // ── Preview Tests ────────────────────────────────────────────────────────
  describe("GET /api/cleaning-runs/[cleaningRunId]/preview", () => {
    it("returns 401 when unauthenticated", async () => {
      const { run } = await setupCleanedRun(10);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/preview`);
      const res = await getPreview(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(401);
    });

    it("returns 404 when non-owner requests preview", async () => {
      const { run } = await setupCleanedRun(10);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/preview`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenB}` },
      });
      const res = await getPreview(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(404);
    });

    it("paginates preview data at default 50 rows per page", async () => {
      const { run } = await setupCleanedRun(65); // 65 rows -> Page 1 has 50, Page 2 has 15
      const reqPage1 = new NextRequest(
        `http://localhost:3000/api/cleaning-runs/${run.id}/preview?page=1`,
        { headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` } }
      );
      const resPage1 = await getPreview(reqPage1, {
        params: Promise.resolve({ cleaningRunId: run.id }),
      });
      expect(resPage1.status).toBe(200);
      const data1 = await resPage1.json();

      expect(data1.pagination.page).toBe(1);
      expect(data1.pagination.pageSize).toBe(50);
      expect(data1.pagination.totalRows).toBe(65);
      expect(data1.pagination.totalPages).toBe(2);
      expect(data1.rows).toHaveLength(50);
      expect(data1.headers).toEqual(["id", "name", "formula_col", "num_col"]);

      // First row: canonical values rendered as plain text
      expect(data1.rows[0][0]).toBe("1");
      expect(data1.rows[0][1]).toBe("Item_1");
      expect(data1.rows[0][2]).toBe("=SUM(A1:B1)"); // canonical has raw formula

      // Page 2
      const reqPage2 = new NextRequest(
        `http://localhost:3000/api/cleaning-runs/${run.id}/preview?page=2`,
        { headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` } }
      );
      const resPage2 = await getPreview(reqPage2, {
        params: Promise.resolve({ cleaningRunId: run.id }),
      });
      expect(resPage2.status).toBe(200);
      const data2 = await resPage2.json();
      expect(data2.pagination.page).toBe(2);
      expect(data2.rows).toHaveLength(15);
    });

    it("includes export safety disclosure and does not expose storage keys", async () => {
      const { run } = await setupCleanedRun(5);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/preview`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` },
      });
      const res = await getPreview(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      const data = await res.json();

      expect(data.disclosure).toContain("Export safety");
      expect(data.disclosure).toContain("apostrophe");
      // Storage keys must not be present
      expect(data.canonicalStorageKey).toBeUndefined();
      expect(data.safeExportStorageKey).toBeUndefined();
    });

    it("returns 410 Gone for expired cleaned file", async () => {
      const { run } = await setupCleanedRun(5);
      const cleanedFile = await repo.getCleanedFileByRun(run.id);
      cleanedFile!.expiresAt = new Date(Date.now() - 1000); // Expired

      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/preview`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` },
      });
      const res = await getPreview(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(410);
    });
  });

  // ── Download Tests ───────────────────────────────────────────────────────
  describe("GET /api/cleaning-runs/[cleaningRunId]/download", () => {
    it("returns 401 when unauthenticated", async () => {
      const { run } = await setupCleanedRun(5);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/download`);
      const res = await getDownload(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(401);
    });

    it("returns 404 when non-owner requests download", async () => {
      const { run } = await setupCleanedRun(5);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/download`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenB}` },
      });
      const res = await getDownload(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(404);
    });

    it("delivers ONLY the spreadsheet-safe CSV representation with formula neutralisation", async () => {
      const { run } = await setupCleanedRun(3);
      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/download`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` },
      });
      const res = await getDownload(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(200);

      // Verify headers
      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      expect(res.headers.get("Cache-Control")).toContain("no-store");

      const bodyText = await res.text();
      // Safe export MUST have formula neutralisation with apostrophe
      expect(bodyText).toContain("'=SUM(A1:B1)");
      expect(bodyText).toContain("'=SUM(A2:B2)");
      // Legitimate negative numbers preserved without apostrophe
      expect(bodyText).toContain("-10");
      expect(bodyText).toContain("-20");
    });

    it("returns 410 Gone when file has expired", async () => {
      const { run } = await setupCleanedRun(3);
      const cleanedFile = await repo.getCleanedFileByRun(run.id);
      cleanedFile!.expiresAt = new Date(Date.now() - 1000); // Expired

      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/download`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` },
      });
      const res = await getDownload(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(410);
    });

    it("returns 410 Gone when file has been deleted", async () => {
      const { run } = await setupCleanedRun(3);
      const cleanedFile = await repo.getCleanedFileByRun(run.id);
      cleanedFile!.fileDeletedAt = new Date();
      cleanedFile!.safeExportFileDeletedAt = new Date();

      const req = new NextRequest(`http://localhost:3000/api/cleaning-runs/${run.id}/download`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenA}` },
      });
      const res = await getDownload(req, { params: Promise.resolve({ cleaningRunId: run.id }) });
      expect(res.status).toBe(410);
    });
  });
});
