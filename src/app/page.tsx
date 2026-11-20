import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#111827", lineHeight: 1.6 }}>
      {/* Navigation Header */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.35rem", color: "#1e40af" }}>
          DataMedics
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link
            href="/login"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              textDecoration: "none",
              color: "#374151",
              fontWeight: 500,
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ maxWidth: "840px", margin: "4rem auto 3rem auto", textAlign: "center", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: "2.75rem", fontWeight: 800, color: "#111827", marginBottom: "1.25rem" }}>
          Controlled CSV Data-Quality Analysis & Cleaning
        </h1>
        <p style={{ fontSize: "1.25rem", color: "#4b5563", marginBottom: "2rem" }}>
          Diagnose spreadsheet defects with deterministic rules. Preview and apply only the cleaning operations you approve. Never lose or overwrite your original data.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link
            href="/register"
            style={{
              padding: "0.85rem 1.75rem",
              borderRadius: "8px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "1.1rem",
            }}
          >
            Start Analyzing Free
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: "0.85rem 1.75rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              color: "#374151",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "1.1rem",
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </section>

      {/* 4 Core Inspection Categories */}
      <section style={{ maxWidth: "1000px", margin: "0 auto 4rem auto", padding: "0 1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 700, textAlign: "center", marginBottom: "2rem" }}>
          Four Deterministic Data-Quality Checks
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#1e40af", marginBottom: "0.5rem" }}>1. Missing Values</h3>
            <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
              Identifies empty cells and whitespace-only values while preserving valid business indicators like 0, NULL, and N/A.
            </p>
          </div>
          <div style={{ padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#1e40af", marginBottom: "0.5rem" }}>2. Exact Duplicates</h3>
            <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
              Exact string comparison across all fields. Accurately reports duplicate occurrences and groups without modifying data.
            </p>
          </div>
          <div style={{ padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#1e40af", marginBottom: "0.5rem" }}>3. Inconsistent Formats</h3>
            <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
              Conservative 80% threshold rule for dates, numbers, and booleans. Never guesses ambiguous formats.
            </p>
          </div>
          <div style={{ padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#1e40af", marginBottom: "0.5rem" }}>4. Unnecessary Whitespace</h3>
            <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
              Detects accidental leading and trailing spaces, tabs, and Unicode spaces without disturbing internal spacing.
            </p>
          </div>
        </div>
      </section>

      {/* Safety & Controlled Cleaning Workflow */}
      <section style={{ backgroundColor: "#f3f4f6", padding: "3rem 1.5rem", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
            Zero Guesswork. Total User Control.
          </h2>
          <p style={{ color: "#4b5563", marginBottom: "2rem" }}>
            Your original uploaded CSV is stored privately and is never modified. Cleaned data is generated as a separate output only after you confirm your selected operations.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap", textAlign: "left" }}>
            <div style={{ flex: "1 1 250px", backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "6px" }}>
              <strong>1. Upload & Validate</strong>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0.5rem 0 0 0" }}>Strict RFC 4180 parsing, UTF-8 checks, and server-side safety boundaries.</p>
            </div>
            <div style={{ flex: "1 1 250px", backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "6px" }}>
              <strong>2. Inspect & Choose</strong>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0.5rem 0 0 0" }}>Review detailed findings with explanations before deciding which cleaning rules to apply.</p>
            </div>
            <div style={{ flex: "1 1 250px", backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "6px" }}>
              <strong>3. Preview & Download</strong>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0.5rem 0 0 0" }}>Read-only paginated preview and spreadsheet-safe formula injection protection.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "2rem", textAlign: "center", fontSize: "0.875rem", color: "#6b7280", borderTop: "1px solid #e5e7eb" }}>
        DataMedics — Deterministic CSV Quality & Cleaning • Version 1.0
      </footer>
    </div>
  );
}
