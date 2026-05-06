"use client";
import { ReactNode } from "react";

export function StatTile({
    label,
    value,
    delta,
    icon,
    tone = "primary",
}: {
    label: string;
    value: string | number;
    delta?: { value: string; positive?: boolean };
    icon?: ReactNode;
    tone?: "primary" | "success" | "warning" | "danger" | "info" | "purple";
}) {
    return (
        <div className={`ui-stat ui-stat-${tone}`}>
            <div className="ui-stat-meta">
                <span className="ui-stat-label">{label}</span>
                {icon ? <span className="ui-stat-icon" aria-hidden>{icon}</span> : null}
            </div>
            <div className="ui-stat-value">{value}</div>
            {delta ? (
                <div className={`ui-stat-delta${delta.positive ? " ui-stat-delta-positive" : " ui-stat-delta-negative"}`}>
                    {delta.value}
                </div>
            ) : null}
        </div>
    );
}
