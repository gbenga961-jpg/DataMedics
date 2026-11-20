import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, assertOwnership } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id: reportId } = await params;
  const repo = getDataRepository();
  const report = await repo.getAnalysisReport(reportId);

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const upload = await repo.getUploadedFile(report.uploadedFileId);
  if (!upload) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  // Enforce ownership
  try {
    assertOwnership(upload.userId, user.id);
  } catch {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const issues = await repo.getIssuesByReport(report.id);

  return NextResponse.json({
    report: {
      id: report.id,
      status: report.status,
      analysisDate: report.analysisDate,
      completedAt: report.completedAt,
      totalIssues: report.totalIssues,
      totalRows: report.totalRows,
      totalColumns: report.totalColumns,
      ruleVersion: report.ruleVersion,
      failureCode: report.failureCode,
    },
    upload: {
      id: upload.id,
      filename: upload.filename,
      fileSizeBytes: upload.fileSizeBytes,
      uploadedAt: upload.uploadedAt,
      expiresAt: upload.expiresAt,
    },
    issues: issues.map((iss) => ({
      id: iss.id,
      issueType: iss.issueType,
      affectedColumn: iss.affectedColumn,
      issueCount: iss.issueCount,
      title: iss.title,
      description: iss.description,
      recommendation: iss.recommendation,
      detectionStatus: iss.detectionStatus,
      detectedPattern: iss.detectedPattern,
      matchPercentage: iss.matchPercentage,
      details: iss.details,
    })),
  });
}
