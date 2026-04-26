"use client";

import React from "react";

/**
 * Compact metric tile used in dashboards / lists.
 *
 *  - `tone` colors the icon chip.
 *  - `delta` renders a small "+12%" / "-3%" chip when provided.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "primary",
  delta,
  helper,
  onClick,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  delta?: { value: number; direction?: "up" | "down" };
  helper?: React.ReactNode;
  onClick?: () => void;
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    primary: { bg: "var(--primary-50)", fg: "var(--primary-600)" },
    success: { bg: "rgba(16,185,129,0.10)", fg: "var(--success, #059669)" },
    warning: { bg: "rgba(245,158,11,0.12)", fg: "var(--warning, #d97706)" },
    danger: { bg: "rgba(239,68,68,0.10)", fg: "var(--danger, #dc2626)" },
    info: { bg: "rgba(14,165,233,0.10)", fg: "#0284c7" },
    neutral: { bg: "var(--gray-100)", fg: "var(--gray-700)" },
  };
  const colors = toneMap[tone] ?? toneMap.primary;
  const deltaUp = delta && (delta.direction ?? (delta.value >= 0 ? "up" : "down")) === "up";

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "1rem 1.15rem",
        border: "1.5px solid var(--gray-100)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(15,23,42,0.10)"; } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--gray-400)",
            fontWeight: 700,
          }}
        >
          {label}
        </div>
        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: colors.bg,
              color: colors.fg,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 850, marginTop: 6, color: "var(--gray-900)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {delta && (
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "0.15rem 0.5rem",
              borderRadius: 999,
              background: deltaUp ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.10)",
              color: deltaUp ? "var(--success, #059669)" : "var(--danger, #dc2626)",
            }}
          >
            {deltaUp ? "▲" : "▼"} {Math.abs(delta.value)}%
          </span>
        )}
        {helper && (
          <span style={{ fontSize: "0.72rem", color: "var(--gray-500)" }}>{helper}</span>
        )}
      </div>
    </div>
  );
}
