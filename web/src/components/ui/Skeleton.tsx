"use client";
import { CSSProperties } from "react";

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    radius?: number | string;
    className?: string;
    style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = 8, className = "", style }: SkeletonProps) {
    return (
        <div
            className={`ui-skeleton ${className}`}
            style={{ width, height, borderRadius: radius, ...style }}
            aria-hidden
        />
    );
}

export function SkeletonText({ lines = 3, lastLineWidth = "60%" }: { lines?: number; lastLineWidth?: string | number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} height={12} width={i === lines - 1 ? lastLineWidth : "100%"} />
            ))}
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div className="ui-card ui-card-padded">
            <Skeleton height={20} width="40%" />
            <div style={{ height: 12 }} />
            <SkeletonText lines={3} />
            <div style={{ height: 16 }} />
            <Skeleton height={36} width={120} radius={10} />
        </div>
    );
}
