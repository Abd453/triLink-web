"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parentDashboard } from "@/lib/admin-api";

export default function ParentDashboardPage() {
  const [dash, setDash] = useState<{ linkedChildren: number; unreadNotifications: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    parentDashboard()
      .then((d) => {
        if (!c) setDash(d);
      })
      .catch((e) => {
        if (!c) setErr(e instanceof Error ? e.message : "Could not load summary");
      });
    return () => {
      c = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.5rem" }}>Welcome</h1>
      <p style={{ color: "var(--gray-600)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
        Linked children and notifications are loaded from your TriLink account.
      </p>

      {err && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "var(--danger-light)", color: "#991b1b", marginBottom: "1rem" }}>
          {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ padding: "1rem", borderRadius: 12, background: "#fff", border: "1px solid var(--gray-200)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600 }}>Linked children</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)" }}>{dash ? dash.linkedChildren : "—"}</div>
        </div>
        <div style={{ padding: "1rem", borderRadius: 12, background: "#fff", border: "1px solid var(--gray-200)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600 }}>Unread notifications</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)" }}>{dash ? dash.unreadNotifications : "—"}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        <Link
          href="/parent/children"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: 12,
            background: "#7c3aed",
            border: "1px solid #7c3aed",
            textDecoration: "none",
            color: "#fff",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          👨‍👩‍👧 View Children&apos;s Exams &amp; Assignments
        </Link>
        <Link
          href="/parent/chat"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--gray-200)",
            textDecoration: "none",
            color: "#7c3aed",
            fontWeight: 700,
          }}
        >
          Messages
        </Link>
        <Link
          href="/parent/settings"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--gray-200)",
            textDecoration: "none",
            color: "var(--gray-800)",
            fontWeight: 700,
          }}
        >
          Account settings
        </Link>
      </div>
    </div>
  );
}
