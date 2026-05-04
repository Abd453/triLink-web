"use client";
import { ReactNode } from "react";

export function EmptyState({
    icon,
    title,
    description,
    action,
    compact,
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    compact?: boolean;
}) {
    return (
        <div className={`ui-empty${compact ? " ui-empty-compact" : ""}`} role="status">
            {icon ? <div className="ui-empty-icon" aria-hidden>{icon}</div> : null}
            <h3 className="ui-empty-title">{title}</h3>
            {description ? <p className="ui-empty-description">{description}</p> : null}
            {action ? <div className="ui-empty-action">{action}</div> : null}
        </div>
    );
}
