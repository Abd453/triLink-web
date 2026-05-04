"use client";
import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

interface ComingSoonProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    note?: string;
}

export default function ComingSoon({ title, description, icon, note }: ComingSoonProps) {
    return (
        <div className="ui-page">
            <PageHeader
                title={title}
                description={description}
                icon={icon ?? <Sparkles size={22} />}
            />
            <div className="ui-card ui-card-padded">
                <EmptyState
                    icon={<Sparkles size={28} />}
                    title="Coming soon"
                    description={
                        note ??
                        "This module is scheduled for the next release. The data model and API are landing first; the UI here will follow."
                    }
                />
            </div>
        </div>
    );
}
