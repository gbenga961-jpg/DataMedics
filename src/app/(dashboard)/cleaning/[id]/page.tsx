"use client";

/**
 * Cleaning Options Page (PRD §10, §9)
 * Route: /cleaning/[id]  where [id] = reportId
 *
 * PRD requirements met:
 * - Exactly 3 operations shown with descriptions and defaults.
 * - Trim whitespace is selected by default.
 * - Remove blank rows and Remove duplicate rows are NOT selected by default.
 * - Warning shown when any row-removal operation is selected.
 * - Explicit user confirmation required (confirm checkbox) before submitting.
 * - At least one operation must be selected.
 * - Client-side UUID as idempotency key — server generates fingerprint.
 * - Redirects to cleaning status page after successful submission.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface CleaningPageProps {
  params: Promise<{ id: string }>;
}

function generateIdempotencyKey(): string {
  // RFC 4122 UUID v4 via crypto.randomUUID (available in modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function WarningBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      style={{
        background: "#fff3cd",
        border: "1px solid #ffc107",
        borderRadius: 6,
        padding: "12px 16px",
        marginBottom: 16,
        color: "#856404",
      }}
    >
      <strong>⚠ Warning:</strong> Row-removal operations permanently reduce the row count
      of your cleaned output. Only the first occurrence of duplicate rows is kept.
      Fully blank rows are removed without recovery. This does not affect your original
      uploaded file, which is kept separately and unmodified.
    </div>
  );
}

export default function CleaningPage({ params }: CleaningPageProps) {
  const router = useRouter();
  const [reportId, setReportId] = React.useState<string>("");

  // Load reportId from params once
  React.useEffect(() => {
    params.then(({ id }) => setReportId(id));
  }, [params]);

  // Operation selections — defaults per PRD §9
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [removeBlankRows, setRemoveBlankRows] = useState(false);
  const [removeDuplicateRows, setRemoveDuplicateRows] = useState(false);

  // Explicit confirmation
  const [confirmed, setConfirmed] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyRowRemoval = removeBlankRows || removeDuplicateRows;
  const atLeastOne = trimWhitespace || removeBlankRows || removeDuplicateRows;

  const canSubmit = atLeastOne && confirmed && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !reportId) return;

    const selectedOperations: string[] = [];
    if (trimWhitespace) selectedOperations.push("TRIM_WHITESPACE");
    if (removeBlankRows) selectedOperations.push("REMOVE_BLANK_ROWS");
    if (removeDuplicateRows) selectedOperations.push("REMOVE_DUPLICATE_ROWS");

    const idempotencyKey = generateIdempotencyKey();

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${reportId}/cleaning-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOperations, idempotencyKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to start cleaning. Please try again.");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      // Redirect to cleaning status page
      router.push(`/cleaning-status/${data.cleaningRunId}`);
    } catch {
      setError("A network error occurred. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Controlled Cleaning</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Select the operations to apply to your cleaned output. Your original file is
        kept separately and is never modified.
      </p>

      <form onSubmit={handleSubmit}>
        {/* ── Operations ──────────────────────────────────────────────── */}
        <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <legend style={{ fontWeight: 600, padding: "0 8px" }}>Cleaning Operations</legend>

          {/* 1. Trim whitespace */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={trimWhitespace}
              onChange={(e) => setTrimWhitespace(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18 }}
            />
            <div>
              <strong>Trim leading and trailing whitespace</strong>{" "}
              <span style={{ color: "#28a745", fontSize: 12 }}>(selected by default)</span>
              <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>
                Removes spaces, tabs, and other whitespace characters from the beginning
                and end of every cell value. Does not affect spaces between words.
              </p>
            </div>
          </label>

          {/* 2. Remove blank rows */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={removeBlankRows}
              onChange={(e) => setRemoveBlankRows(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18 }}
            />
            <div>
              <strong>Remove fully blank rows</strong>
              <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>
                Removes rows where every cell is empty or contains only whitespace.
                These rows contain no data. <strong>This operation reduces the row count.</strong>
              </p>
            </div>
          </label>

          {/* 3. Remove duplicate rows */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={removeDuplicateRows}
              onChange={(e) => setRemoveDuplicateRows(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18 }}
            />
            <div>
              <strong>Remove exact duplicate rows</strong>
              <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>
                Keeps the first occurrence of each row and removes subsequent exact
                duplicates. Comparison is case-sensitive and exact.{" "}
                <strong>This operation reduces the row count.</strong>
              </p>
            </div>
          </label>
        </fieldset>

        {/* ── Row-removal warning ──────────────────────────────────────── */}
        <WarningBanner show={anyRowRemoval} />

        {/* ── Validation error ─────────────────────────────────────────── */}
        {!atLeastOne && (
          <p role="alert" style={{ color: "#dc3545", marginBottom: 12 }}>
            At least one operation must be selected.
          </p>
        )}

        {/* ── Explicit confirmation ────────────────────────────────────── */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 20,
            padding: "12px 16px",
            background: "#f8f9fa",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18 }}
          />
          <div>
            <strong>I confirm my selections and understand the operations above.</strong>
            <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>
              The cleaning will produce a separate cleaned output. Your original file is
              not affected.
            </p>
          </div>
        </label>

        {/* ── API error ────────────────────────────────────────────────── */}
        {error && (
          <p role="alert" style={{ color: "#dc3545", marginBottom: 12 }}>
            {error}
          </p>
        )}

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "10px 24px",
            background: canSubmit ? "#0070f3" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {submitting ? "Starting cleaning…" : "Start Cleaning"}
        </button>
      </form>
    </main>
  );
}
