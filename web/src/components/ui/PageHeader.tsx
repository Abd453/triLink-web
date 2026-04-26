"use client";

import React from "react";

/**
 * Polished hero-style page header used at the top of every role page.
 *
 * `variant`:
 *  - "dark"  → indigo/slate gradient (default, for dashboards & key features)
 *  - "light" → white card on neutral background (for utility pages)
 */
export function PageHeader({
  kicker,
  title,
  subtitle,
  icon,
  actions,
  variant = "dark",
  accent,
  children,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "dark" | "light";
  /** Optional accent color override for the kicker dot and accent glow. */
  accent?: string;
  /** Extra content rendered below the title row (e.g. tabs, filters). */
  children?: React.ReactNode;
}) {
  const dark = variant === "dark";
  const accentColor = accent ?? (dark ? "#34d399" : "#7c3aed");

  const wrapperStyle: React.CSSProperties = dark
    ? {
        background: "linear-gradient(135deg, #0f172a, #1e293b 70%, #0f172a)",
        color: "#fff",
        borderRadius: 24,
        padding: "1.5rem 2rem",
        marginBottom: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 50px rgba(15,23,42,0.18)",
      }
    : {
        background: "#fff",
        color: "var(--gray-900)",
        borderRadius: 20,
        padding: "1.4rem 1.75rem",
        marginBottom: 16,
        border: "1.5px solid var(--gray-100)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      };

  const subtitleColor = dark ? "rgba(255,255,255,0.78)" : "var(--gray-500)";
  const kickerColor = dark ? "rgba(255,255,255,0.7)" : "var(--gray-500)";

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 240 }}>
          {icon && (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: dark ? "rgba(255,255,255,0.08)" : "var(--primary-50)",
                color: dark ? "#fff" : "var(--primary-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gray-100)",
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: kickerColor,
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor }} />
                {kicker}
              </div>
            )}
            <h1
              style={{
                fontSize: "1.7rem",
                fontWeight: 850,
                lineHeight: 1.15,
                margin: kicker ? "0.3rem 0 0" : 0,
                color: dark ? "#fff" : "var(--gray-900)",
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: "0.9rem", color: subtitleColor, margin: "0.3rem 0 0", maxWidth: 760 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {actions}
          </div>
        )}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}
