"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UploadItem {
  id: string;
  filename: string;
  fileSizeBytes: number;
  rowCount: number;
  columnCount: number;
  uploadStatus: string;
  uploadedAt: string;
  expiresAt: string;
  report?: {
    id: string;
    status: string;
    totalIssues: number;
    completedAt: string | null;
    failureCode: string | null;
  } | null;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      if (!userRes.ok) {
        router.push("/login");
        return;
      }
      const userData = await userRes.json();
      setUser(userData.user);

      const uploadsRes = await fetch("/api/uploads");
      if (uploadsRes.ok) {
        const data = await uploadsRes.json();
        setUploads(data.uploads || []);
      }
    } catch {
      // Handled silently for polling
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setUploadError("Only .csv files are supported.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.errorMessage || data.error || "Upload validation failed.");
      } else {
        setSelectedFile(null);
        // Refresh uploads list
        await fetchDashboardData();
        if (data.reportId) {
          router.push(`/reports/${data.reportId}`);
        }
      }
    } catch {
      setUploadError("Network error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Navigation Header */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1.25rem", color: "#1e40af" }}>DataMedics</span>
          <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.875rem", color: "#4b5563" }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Welcome Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", marginBottom: "0.25rem" }}>
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.95rem" }}>
            Upload CSV files to inspect data quality, review reports, and perform controlled cleaning.
          </p>
        </div>

        {/* Upload Card */}
        <section
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "1.5rem",
            marginBottom: "2.5rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem", color: "#111827" }}>
            Upload New CSV File
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.25rem" }}>
            Comma-separated CSV only. Max 25 MB and 100,000 rows. Your original file is preserved privately.
          </p>

          {uploadError && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "6px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              <strong>Upload Error:</strong> {uploadError}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{
                fontSize: "0.9rem",
                color: "#374151",
              }}
            />
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: "6px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                cursor: !selectedFile || uploading ? "not-allowed" : "pointer",
                opacity: !selectedFile || uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Validating & Uploading..." : "Analyze CSV"}
            </button>
          </form>
        </section>

        {/* Uploads & Reports History */}
        <section
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "1.5rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111827" }}>
              Your Uploads & Reports
            </h2>
            <button
              onClick={fetchDashboardData}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
                backgroundColor: "#f9fafb",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Refresh Status
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading your uploads...</p>
          ) : uploads.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#6b7280" }}>
              <p style={{ marginBottom: "0.5rem", fontWeight: 500 }}>No CSV files uploaded yet.</p>
              <p style={{ fontSize: "0.875rem" }}>Upload a CSV file above to run data-quality checks.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#4b5563" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>File Name</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Uploaded</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Dimensions</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Issues Found</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((item) => {
                    const status = item.report?.status || item.uploadStatus;
                    const isCompleted = status === "COMPLETED";

                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.75rem 0.5rem", fontWeight: 500, color: "#111827" }}>
                          {item.filename}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#6b7280" }}>
                          {new Date(item.uploadedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#6b7280" }}>
                          {item.rowCount} rows × {item.columnCount} cols
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor:
                                status === "COMPLETED"
                                  ? "#dcfce7"
                                  : status === "PROCESSING"
                                  ? "#dbeafe"
                                  : status === "FAILED"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                              color:
                                status === "COMPLETED"
                                  ? "#15803d"
                                  : status === "PROCESSING"
                                  ? "#1d4ed8"
                                  : status === "FAILED"
                                  ? "#b91c1c"
                                  : "#b45309",
                            }}
                          >
                            {status}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#374151" }}>
                          {item.report ? `${item.report.totalIssues} instances` : "—"}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          {item.report && isCompleted ? (
                            <Link
                              href={`/reports/${item.report.id}`}
                              style={{
                                color: "#2563eb",
                                textDecoration: "none",
                                fontWeight: 500,
                              }}
                            >
                              View Report →
                            </Link>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>Processing...</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
