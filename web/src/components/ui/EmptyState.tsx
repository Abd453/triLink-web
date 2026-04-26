"use client";

import React from "react";

/**
 * Consistent empty / zero-data state for any page.
 * Shows an icon, headline, supporting text, and an optional CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `card` (default, white card) or `inline` (no background, smaller). */
  variant?: "card" | "inline";
}) {
  const card = variant === "card";
  return (
    <div
      style={{
        background: card ? "#fff" : "transparent",
        borderRadius: card ? 20 : 0,
        padding: card ? "3rem 2rem" : "1.5rem 1rem",
        textAlign: "center",
        border: card ? "1.5px solid var(--gray-100)" : undefined,
        boxShadow: card ? "0 1px 4px rgba(0,0,0,0.04)" : undefined,
      }}
    >
      {icon && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--primary-50)",
            color: "var(--primary-500)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
            border: "1px solid var(--primary-100, #ede9fe)",
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--gray-800)", marginBottom: "0.35rem" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: "0.88rem", color: "var(--gray-500)", marginBottom: action ? "1.1rem" : 0, maxWidth: 460, margin: "0 auto" }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: "1.1rem", display: "flex", justifyContent: "center" }}>{action}</div>}
    </div>
  );
}
