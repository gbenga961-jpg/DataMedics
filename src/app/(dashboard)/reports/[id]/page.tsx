"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DataQualityIssue {
  id: string;
  issueType: string;
  affectedColumn: string;
  issueCount: number;
  title: string;
  description: string;
  recommendation: string;
  detectionStatus: string;
  detectedPattern?: string | null;
  matchPercentage?: number | null;
  details?: Record<string, unknown> | null;
}

interface ReportData {
  report: {
    id: string;
    status: string;
    analysisDate: string;
    completedAt: string | null;
    totalIssues: number;
    totalRows: number;
    totalColumns: number;
    ruleVersion: string;
    failureCode?: string | null;
  };
  upload: {
    id: string;
    filename: string;
    fileSizeBytes: number;
    uploadedAt: string;
    expiresAt: string;
  };
  issues: DataQualityIssue[];
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${id}`);
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          setError("Report not found or access denied.");
          return;
        }
        const reportData = await res.json();
        setData(reportData);
      } catch {
        setError("Network error while loading report.");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id, router]);

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#6b7280" }}>
        Loading data quality report...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: "600px", margin: "4rem auto", padding: "2rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ color: "#b91c1c", marginBottom: "1rem" }}>Error Loading Report</h2>
        <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>{error || "Report could not be found."}</p>
        <Link href="/dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const { report, upload, issues } = data;

  const missingIssues = issues.filter((i) => i.issueType === "MISSING_VALUES");
  const duplicateIssues = issues.filter((i) => i.issueType === "EXACT_DUPLICATE_ROWS");
  const formatIssues = issues.filter((i) => i.issueType === "INCONSISTENT_FORMATS");
  const whitespaceIssues = issues.filter((i) => i.issueType === "UNNECESSARY_WHITESPACE");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top Navbar */}
      <nav style={{ padding: "1rem 2rem", backgroundColor: "#ffffff", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}>
            ← Back to Dashboard
          </Link>
          <span style={{ color: "#d1d5db" }}>|</span>
          <span style={{ fontWeight: 600, color: "#111827" }}>Analysis Report</span>
        </div>
      </nav>

      <main style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header Metadata */}
        <section style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: "0.25rem" }}>
                {upload.filename}
              </h1>
              <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Analyzed on {new Date(report.analysisDate).toLocaleString()} • Engine v{report.ruleVersion}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: report.status === "COMPLETED" ? "#dcfce7" : "#fee2e2",
                  color: report.status === "COMPLETED" ? "#15803d" : "#b91c1c",
                }}
              >
                {report.status}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid #f3f4f6" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Total Rows</span>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: "0.25rem 0 0 0" }}>{report.totalRows.toLocaleString()}</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Total Columns</span>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: "0.25rem 0 0 0" }}>{report.totalColumns}</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Issue Instances</span>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#b91c1c", margin: "0.25rem 0 0 0" }}>{report.totalIssues}</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>File Size</span>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: "0.25rem 0 0 0" }}>
                {(upload.fileSizeBytes / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        </section>

        {/* Guidance Notice */}
        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: "1rem", borderRadius: "8px", marginBottom: "2rem", fontSize: "0.9rem", color: "#1e40af" }}>
          <strong>Understanding Issue Instances (PRD §15.12):</strong> The total issue count represents the sum of defect instances identified across individual cells and rows. Your original file remains completely untouched.
        </div>

        {/* Category 1: Missing Values */}
        <section style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
            1. Missing Values
          </h2>
          {missingIssues.length === 0 ? (
            <p style={{ color: "#15803d", fontSize: "0.9rem" }}>✓ No missing values detected in any column.</p>
          ) : (
            <div>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
                Empty and whitespace-only cells detected. Valid business values (0, NULL, N/A) are retained.
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                    <th style={{ padding: "0.5rem" }}>Affected Column</th>
                    <th style={{ padding: "0.5rem" }}>Missing Count</th>
                    <th style={{ padding: "0.5rem" }}>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {missingIssues.map((iss) => (
                    <tr key={iss.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "0.5rem", fontWeight: 500, color: "#111827" }}>{iss.affectedColumn}</td>
                      <td style={{ padding: "0.5rem", color: "#b91c1c", fontWeight: 600 }}>{iss.issueCount} cells</td>
                      <td style={{ padding: "0.5rem", color: "#4b5563" }}>{iss.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Category 2: Exact Duplicate Rows */}
        <section style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
            2. Exact Duplicate Rows
          </h2>
          {duplicateIssues.length === 0 ? (
            <p style={{ color: "#15803d", fontSize: "0.9rem" }}>✓ No exact duplicate rows found.</p>
          ) : (
            <div>
              {duplicateIssues.map((iss) => (
                <div key={iss.id} style={{ fontSize: "0.9rem", color: "#374151" }}>
                  <p style={{ fontWeight: 600, color: "#b91c1c", marginBottom: "0.25rem" }}>
                    {iss.issueCount} duplicate row occurrences identified
                  </p>
                  <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>{iss.description}</p>
                  <p style={{ color: "#4b5563", fontSize: "0.85rem" }}><strong>Recommendation:</strong> {iss.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Category 3: Inconsistent Formats */}
        <section style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
            3. Inconsistent Formats
          </h2>
          {formatIssues.length === 0 ? (
            <p style={{ color: "#15803d", fontSize: "0.9rem" }}>✓ Formats are consistent across all assessed columns.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                  <th style={{ padding: "0.5rem" }}>Column</th>
                  <th style={{ padding: "0.5rem" }}>Dominant Pattern</th>
                  <th style={{ padding: "0.5rem" }}>Match %</th>
                  <th style={{ padding: "0.5rem" }}>Non-Conforming</th>
                </tr>
              </thead>
              <tbody>
                {formatIssues.map((iss) => (
                  <tr key={iss.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 500 }}>{iss.affectedColumn}</td>
                    <td style={{ padding: "0.5rem", color: "#4b5563" }}>{iss.detectedPattern || "—"}</td>
                    <td style={{ padding: "0.5rem", color: "#1e40af", fontWeight: 600 }}>{iss.matchPercentage}%</td>
                    <td style={{ padding: "0.5rem", color: "#b91c1c", fontWeight: 600 }}>{iss.issueCount} values</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Category 4: Unnecessary Whitespace */}
        <section style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
            4. Unnecessary Whitespace
          </h2>
          {whitespaceIssues.length === 0 ? (
            <p style={{ color: "#15803d", fontSize: "0.9rem" }}>✓ No accidental leading or trailing whitespace detected.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                  <th style={{ padding: "0.5rem" }}>Column</th>
                  <th style={{ padding: "0.5rem" }}>Affected Cells</th>
                  <th style={{ padding: "0.5rem" }}>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {whitespaceIssues.map((iss) => (
                  <tr key={iss.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 500 }}>{iss.affectedColumn}</td>
                    <td style={{ padding: "0.5rem", color: "#b91c1c", fontWeight: 600 }}>{iss.issueCount} cells</td>
                    <td style={{ padding: "0.5rem", color: "#4b5563" }}>{iss.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Cleaning Action Callout */}
        <section
          style={{
            backgroundColor: "#ffffff",
            padding: "2rem",
            borderRadius: "8px",
            border: "2px solid #2563eb",
            textAlign: "center",
            boxShadow: "0 2px 4px rgba(37,99,235,0.06)",
          }}
        >
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
            Ready to Clean This Dataset?
          </h2>
          <p style={{ color: "#4b5563", fontSize: "0.95rem", maxWidth: "600px", margin: "0 auto 1.5rem auto" }}>
            Choose from the three approved cleaning operations: trim whitespace, remove blank rows, or remove duplicate rows. Your original file will remain untouched.
          </p>
          <Link
            href={`/cleaning/${report.id}`}
            style={{
              display: "inline-block",
              padding: "0.85rem 2rem",
              borderRadius: "6px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Proceed to Controlled Cleaning →
          </Link>
        </section>
      </main>
    </div>
  );
}
