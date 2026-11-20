"use client";

/**
 * Cleaning Status & Cleaned Data Preview Page (PRD §10, §11, §18)
 * Route: /cleaning-status/[cleaningRunId]
 *
 * Features:
 * - Polls GET /api/cleaning-runs/[cleaningRunId] until completed or failed
 * - Authenticated download button for spreadsheet-safe output
 * - Read-only Cleaned Data Preview with server-side 50-row pagination
 * - Displays cleaning summary metrics (original rows, final rows, trimmed, blank removed, duplicate removed, export protected)
 * - Clear export-safety disclosure
 * - Remaining data quality issues
 * - Cleaned file details and expiration date
 */

import React, { useEffect, useState, useCallback } from "react";

interface CleaningStatusPageProps {
  params: Promise<{ cleaningRunId: string }>;
}

interface CleaningRunData {
  id: string;
  reportId: string;
  status: string;
  selectedOperations: string[];
  originalRowCount: number;
  finalRowCount: number | null;
  whitespaceCellsTrimmed: number;
  blankRowsRemoved: number;
  duplicateRowsRemoved: number;
  attempts: number;
  lastErrorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface CleanedFileData {
  id: string;
  filename: string;
  fileSizeBytes: number;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  expiresAt: string | null;
}

interface RemainingIssue {
  id: string;
  issueType: string;
  affectedColumn: string;
  issueCount: number;
  recommendation: string;
  detectionStatus: string;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  metrics: {
    originalRowCount: number;
    finalRowCount: number;
    whitespaceCellsTrimmed: number;
    blankRowsRemoved: number;
    duplicateRowsRemoved: number;
    exportProtectedValueCount: number;
  };
  disclosure: string;
}

const OPERATION_LABELS: Record<string, string> = {
  TRIM_WHITESPACE: "Trim leading/trailing whitespace",
  REMOVE_BLANK_ROWS: "Remove fully blank rows",
  REMOVE_DUPLICATE_ROWS: "Remove exact duplicate rows",
};

export default function CleaningStatusPage({ params }: CleaningStatusPageProps) {
  const [cleaningRunId, setCleaningRunId] = useState<string>("");
  const [run, setRun] = useState<CleaningRunData | null>(null);
  const [cleanedFile, setCleanedFile] = useState<CleanedFileData | null>(null);
  const [remainingIssues, setRemainingIssues] = useState<RemainingIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  React.useEffect(() => {
    params.then(({ cleaningRunId: id }) => setCleaningRunId(id));
  }, [params]);

  // Load preview data for a specific page
  const loadPreview = useCallback(
    async (page: number) => {
      if (!cleaningRunId) return;
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await fetch(`/api/cleaning-runs/${cleaningRunId}/preview?page=${page}&pageSize=50`);
        if (!res.ok) {
          const errData = await res.json();
          setPreviewError(errData.error || "Failed to load preview.");
          setLoadingPreview(false);
          return;
        }
        const data: PreviewData = await res.json();
        setPreview(data);
        setCurrentPage(data.pagination.page);
      } catch {
        setPreviewError("Network error while loading preview.");
      } finally {
        setLoadingPreview(false);
      }
    },
    [cleaningRunId]
  );

  useEffect(() => {
    if (!cleaningRunId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/cleaning-runs/${cleaningRunId}`);
        if (!res.ok) {
          setError("Could not load cleaning status.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setRun(data.cleaningRun);
        setCleanedFile(data.cleanedFile ?? null);
        setRemainingIssues(data.remainingIssues ?? []);

        if (data.cleaningRun.status === "COMPLETED") {
          // Load the initial preview page
          loadPreview(1);
        } else if (data.cleaningRun.status === "QUEUED" || data.cleaningRun.status === "PROCESSING") {
          setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setError("A network error occurred.");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [cleaningRunId, loadPreview]);

  if (error) {
    return (
      <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#dc3545" }}>{error}</p>
      </main>
    );
  }

  if (!run) {
    return (
      <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
        <p>Loading cleaning status…</p>
      </main>
    );
  }

  const isComplete = run.status === "COMPLETED";
  const isFailed = run.status === "FAILED";
  const isPending = !isComplete && !isFailed;

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Controlled Cleaning Output</h1>

      {/* Status badge */}
      <p style={{ marginBottom: 16 }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 20,
            fontWeight: 600,
            fontSize: 14,
            background: isComplete ? "#d4edda" : isFailed ? "#f8d7da" : "#fff3cd",
            color: isComplete ? "#155724" : isFailed ? "#721c24" : "#856404",
          }}
        >
          {run.status}
        </span>
        {isPending && (
          <span style={{ marginLeft: 12, color: "#555", fontSize: 14 }}>
            Processing… (attempt {run.attempts}/3)
          </span>
        )}
      </p>

      {/* Operations selected */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Applied Operations</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {run.selectedOperations.map((op) => (
            <li key={op}>{OPERATION_LABELS[op] ?? op}</li>
          ))}
        </ul>
      </section>

      {/* Metrics — only when complete */}
      {isComplete && (
        <section style={{ marginBottom: 20, background: "#f8f9fa", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Cleaning Summary</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Original row count</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>{run.originalRowCount}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Final row count</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>
                  {run.finalRowCount ?? "—"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Whitespace cells trimmed</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>
                  {run.whitespaceCellsTrimmed}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Blank rows removed</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>{run.blankRowsRemoved}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Duplicate rows removed</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>
                  {run.duplicateRowsRemoved}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#555" }}>Formula-like values protected for export</td>
                <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>
                  {preview?.metrics.exportProtectedValueCount ?? 0}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Export safety disclosure banner */}
      {isComplete && (
        <div
          role="region"
          aria-label="Export safety disclosure"
          style={{
            background: "#e8f4fd",
            border: "1px solid #b8daff",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 20,
            fontSize: 14,
            color: "#004085",
          }}
        >
          <strong>🛡 Export Safety Notice:</strong>{" "}
          {preview?.disclosure ??
            "Potentially dangerous formula-like values (such as those starting with '=', '+', '-', or '@') are safely neutralized with an apostrophe in the downloadable file to protect spreadsheet applications. Your canonical cleaned data is preserved without alteration."}
        </div>
      )}

      {/* Cleaned file info & Download button */}
      {cleanedFile && isComplete && (
        <section
          style={{
            marginBottom: 24,
            background: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: 8,
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, margin: "0 0 4px", color: "#155724" }}>Cleaned Output Ready</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#155724" }}>
              <strong>{cleanedFile.filename}</strong> — {cleanedFile.rowCount} rows, {cleanedFile.columnCount}{" "}
              columns, {(cleanedFile.fileSizeBytes / 1024).toFixed(1)} KB
            </p>
            {cleanedFile.expiresAt && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
                Retained for 30 days. Expires: {new Date(cleanedFile.expiresAt).toLocaleString()}
              </p>
            )}
          </div>
          <a
            href={`/api/cleaning-runs/${run.id}/download`}
            style={{
              display: "inline-block",
              background: "#28a745",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Download Spreadsheet-Safe CSV
          </a>
        </section>
      )}

      {/* Read-only Cleaned Data Preview */}
      {isComplete && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Cleaned Data Preview</h2>
            {preview && (
              <span style={{ fontSize: 13, color: "#666" }}>
                Showing page {preview.pagination.page} of {preview.pagination.totalPages} (
                {preview.pagination.totalRows} total rows)
              </span>
            )}
          </div>

          {loadingPreview && <p style={{ color: "#666" }}>Loading preview page…</p>}
          {previewError && <p style={{ color: "#dc3545" }}>{previewError}</p>}

          {preview && preview.rows.length > 0 && (
            <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead style={{ background: "#f1f3f5" }}>
                  <tr>
                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #ccc", width: 48, color: "#666" }}>
                      #
                    </th>
                    {preview.headers.map((h, i) => (
                      <th key={i} style={{ padding: "8px 12px", borderBottom: "2px solid #ccc", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, rIdx) => {
                    const rowNumber = (preview.pagination.page - 1) * preview.pagination.pageSize + rIdx + 1;
                    return (
                      <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", color: "#888" }}>
                          {rowNumber}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              padding: "8px 12px",
                              borderBottom: "1px solid #eee",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {preview && preview.rows.length === 0 && (
            <p style={{ color: "#666", fontStyle: "italic" }}>Cleaned dataset contains no data rows.</p>
          )}

          {/* Pagination Controls */}
          {preview && preview.pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => loadPreview(currentPage - 1)}
                disabled={currentPage <= 1 || loadingPreview}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  background: currentPage <= 1 ? "#eee" : "#fff",
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: 13, color: "#555" }}>
                Page {currentPage} of {preview.pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => loadPreview(currentPage + 1)}
                disabled={currentPage >= preview.pagination.totalPages || loadingPreview}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  background: currentPage >= preview.pagination.totalPages ? "#eee" : "#fff",
                  cursor: currentPage >= preview.pagination.totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      )}

      {/* Remaining issues after cleaning */}
      {isComplete && remainingIssues.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Remaining Data Quality Findings</h2>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
            These issues remain in the cleaned output after the selected operations were applied.
          </p>
          {remainingIssues.map((iss) => (
            <div
              key={iss.id}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 8 }}
            >
              <strong style={{ fontSize: 14 }}>{iss.issueType.replace(/_/g, " ")}</strong>
              {iss.affectedColumn !== "ALL_COLUMNS" && (
                <span style={{ fontSize: 12, color: "#555", marginLeft: 8 }}>
                  Column: {iss.affectedColumn}
                </span>
              )}
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
                {iss.issueCount} instance{iss.issueCount !== 1 ? "s" : ""} · {iss.recommendation}
              </p>
            </div>
          ))}
        </section>
      )}

      {isComplete && remainingIssues.length === 0 && (
        <p style={{ color: "#155724", background: "#d4edda", padding: "10px 16px", borderRadius: 6, fontSize: 14 }}>
          ✓ No remaining data quality issues detected in the cleaned output.
        </p>
      )}

      {/* Failure info */}
      {isFailed && (
        <div
          role="alert"
          style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: 6, padding: 16 }}
        >
          <strong>Cleaning failed</strong>
          {run.lastErrorCode && <p style={{ margin: "4px 0 0", fontSize: 14 }}>Error: {run.lastErrorCode}</p>}
          <p style={{ margin: "8px 0 0", fontSize: 14 }}>Please return to the report and try again.</p>
        </div>
      )}

      {/* Back link */}
      <p style={{ marginTop: 24 }}>
        <a href={`/reports/${run.reportId}`} style={{ color: "#0070f3" }}>
          ← Back to report
        </a>
      </p>
    </main>
  );
}
