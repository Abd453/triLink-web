"use client";
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean;
    padded?: boolean;
}

export function Card({ interactive, padded = false, className = "", children, ...rest }: CardProps) {
    const cls = [
        "ui-card",
        interactive ? "ui-card-interactive" : "",
        padded ? "ui-card-padded" : "",
        className,
    ].filter(Boolean).join(" ");
    return <div className={cls} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
    return (
        <div className="ui-card-header">
            <div>
                <h3 className="ui-card-title">{title}</h3>
                {subtitle ? <p className="ui-card-subtitle">{subtitle}</p> : null}
            </div>
            {action ? <div className="ui-card-action">{action}</div> : null}
        </div>
    );
}

export function CardSection({ children }: { children: ReactNode }) {
    return <div className="ui-card-section">{children}</div>;
}
