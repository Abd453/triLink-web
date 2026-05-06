"use client";
import { ReactNode } from "react";

export function PageHeader({
    title,
    description,
    breadcrumb,
    action,
    icon,
}: {
    title: string;
    description?: string;
    breadcrumb?: ReactNode;
    action?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <header className="ui-page-header">
            {breadcrumb ? <div className="ui-page-breadcrumb">{breadcrumb}</div> : null}
            <div className="ui-page-header-row">
                <div className="ui-page-header-titles">
                    {icon ? <div className="ui-page-header-icon" aria-hidden>{icon}</div> : null}
                    <div>
                        <h1 className="ui-page-title">{title}</h1>
                        {description ? <p className="ui-page-description">{description}</p> : null}
                    </div>
                </div>
                {action ? <div className="ui-page-header-action">{action}</div> : null}
            </div>
        </header>
    );
}
