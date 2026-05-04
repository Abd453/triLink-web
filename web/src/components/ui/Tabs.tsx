"use client";
import { ReactNode } from "react";

export interface Tab {
    id: string;
    label: string;
    icon?: ReactNode;
    badge?: number | string;
}

export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
    return (
        <div className="ui-tabs" role="tablist">
            {tabs.map(tab => {
                const active = tab.id === value;
                return (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={active}
                        className={`ui-tab${active ? " ui-tab-active" : ""}`}
                        onClick={() => onChange(tab.id)}
                        type="button"
                    >
                        {tab.icon ? <span aria-hidden>{tab.icon}</span> : null}
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && tab.badge !== null && tab.badge !== "" ? (
                            <span className="ui-tab-badge">{tab.badge}</span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
