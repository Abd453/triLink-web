"use client";
import { ReactNode } from "react";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "purple";

export function Badge({ tone = "neutral", children, dot, className = "" }: {
    tone?: Tone;
    children: ReactNode;
    dot?: boolean;
    className?: string;
}) {
    return (
        <span className={`ui-badge ui-badge-${tone} ${className}`.trim()}>
            {dot ? <span className="ui-badge-dot" aria-hidden /> : null}
            {children}
        </span>
    );
}
