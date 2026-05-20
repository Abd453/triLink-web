"use client";

import React from "react";

/**
 * Low-level shimmer block. Use it to compose page-specific skeletons.
 * Reuses the existing `.shimmer` and `.admin-skeleton` classes in globals.css.
 */
export function Skeleton({
  width,
  height = 16,
  rounded = 8,
  style,
  className,
}: {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`admin-skeleton shimmer ${className ?? ""}`}
      style={{
        width: width ?? "100%",
        height,
        borderRadius: rounded,
        ...style,
      }}
    />
  );
}

/** Skeleton for a generic content card (title + lines). */
export function CardSkeleton({
  lines = 3,
  showHeader = true,
  style,
}: {
  lines?: number;
  showHeader?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid var(--gray-100)",
        borderRadius: 16,
        padding: "1.1rem 1.25rem",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
          <Skeleton width="42%" height={18} rounded={6} />
          <Skeleton width={84} height={28} rounded={999} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? "70%" : "100%"} height={12} rounded={6} />
        ))}
      </div>
    </div>
  );
}

/** Grid of stat-card skeletons, defaults to 4 across. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
        gap: 12,
        marginBottom: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            border: "1.5px solid var(--gray-100)",
            borderRadius: 16,
            padding: "1rem 1.15rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <Skeleton width={88} height={10} rounded={4} style={{ marginBottom: 10 }} />
          <Skeleton width={120} height={22} rounded={6} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton table with N rows and M columns. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid var(--gray-100)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.25rem", borderBottom: "1.5px solid var(--gray-100)", background: "var(--gray-50)" }}>
          <Skeleton width={200} height={16} rounded={6} />
          <Skeleton width={120} height={32} rounded={999} />
        </div>
      )}
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 16,
              padding: "0.85rem 1.25rem",
              borderBottom: r === rows - 1 ? "none" : "1px solid var(--gray-100)",
              alignItems: "center",
            }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} width={c === 0 ? "60%" : c === columns - 1 ? "40%" : "75%"} height={12} rounded={6} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for vertical lists (announcements, notifications, messages, etc.) */
export function ListSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            border: "1.5px solid var(--gray-100)",
            borderRadius: 14,
            padding: "0.9rem 1.1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          {avatar && <Skeleton width={42} height={42} rounded={12} />}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton width="40%" height={13} rounded={6} />
            <Skeleton width="65%" height={10} rounded={4} />
          </div>
          <Skeleton width={64} height={26} rounded={999} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the hero header used by `PageHeader`. */
export function PageHeaderSkeleton({ withActions = true }: { withActions?: boolean }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a, #1e293b 70%, #0f172a)",
        borderRadius: 24,
        padding: "1.5rem 2rem",
        marginBottom: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 50px rgba(15,23,42,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 200 }}>
        <div style={{ height: 10, width: 120, background: "rgba(255,255,255,0.18)", borderRadius: 4 }} />
        <div style={{ height: 28, width: "60%", maxWidth: 380, background: "rgba(255,255,255,0.28)", borderRadius: 8 }} />
        <div style={{ height: 12, width: "75%", maxWidth: 540, background: "rgba(255,255,255,0.16)", borderRadius: 4 }} />
      </div>
      {withActions && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ height: 38, width: 110, background: "rgba(255,255,255,0.18)", borderRadius: 12 }} />
          <div style={{ height: 38, width: 140, background: "rgba(255,255,255,0.28)", borderRadius: 12 }} />
        </div>
      )}
    </div>
  );
}

/** Full-page skeleton: header + stats + content (table or cards). */
export function PageSkeleton({
  variant = "table",
  stats = 4,
  rows = 6,
  columns = 5,
}: {
  variant?: "table" | "list" | "cards" | "none";
  stats?: number;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      {stats > 0 && <StatGridSkeleton count={stats} />}
      {variant === "table" && <TableSkeleton rows={rows} columns={columns} />}
      {variant === "list" && <ListSkeleton rows={rows} />}
      {variant === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {Array.from({ length: rows }).map((_, i) => <CardSkeleton key={i} lines={3} />)}
        </div>
      )}
    </div>
  );
}
