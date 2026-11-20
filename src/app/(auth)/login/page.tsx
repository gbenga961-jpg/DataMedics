"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sign in.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>
          Sign in to DataMedics
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Enter your credentials to access your dashboard and analyses.
        </p>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              borderRadius: "6px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "6px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "1rem",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#6b7280" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
