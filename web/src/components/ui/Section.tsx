"use client";

import React from "react";

/**
 * Wrapper card for grouping content blocks with a consistent header/title row.
 * Use `actions` to put filter buttons or CTAs on the right.
 */
export function Section({
  title,
  description,
  actions,
  children,
  padded = true,
  bordered = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  bordered?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        border: bordered ? "1.5px solid var(--gray-100)" : undefined,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0.95rem 1.25rem",
            borderBottom: "1.5px solid var(--gray-100)",
            background: "linear-gradient(180deg,#fff,#fafafa)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--gray-900)" }}>
                {title}
              </div>
            )}
            {description && (
              <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginTop: 2 }}>
                {description}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>
          )}
        </div>
      )}
      <div style={{ padding: padded ? "1rem 1.25rem" : 0 }}>{children}</div>
    </div>
  );
}
