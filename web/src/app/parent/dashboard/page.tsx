"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
    Bell,
    CalendarDays,
    Home,
    MessageSquare,
    Settings,
    Users,
} from "lucide-react";
import { parentDashboard } from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import {
    Badge,
    Card,
    CardHeader,
    CardSection,
    EmptyState,
    PageHeader,
    Skeleton,
    StatTile,
} from "@/components/ui";

type Dash = { linkedChildren: number; unreadNotifications: number };

export default function ParentDashboardPage() {
    const user = useCurrentUser("parent");
    const [dash, setDash] = useState<Dash | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        parentDashboard()
            .then(d => {
                if (!cancelled) setDash(d);
            })
            .catch(e => {
                if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load summary");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const greeting = user.firstName ? `Welcome, ${user.firstName}` : "Welcome";
    const subtitle = user.childName
        ? `Quick overview for ${user.childName}.`
        : "Quick overview of your child's school activity.";

    return (
        <div className="ui-page">
            <PageHeader
                title={greeting}
                description={subtitle}
                icon={<Home size={22} />}
                action={
                    <Link href="/parent/chat" className="btn btn-primary">
                        <MessageSquare size={16} /> Open chat
                    </Link>
                }
            />

            {err ? (
                <Card padded>
                    <div role="alert" className="ui-badge ui-badge-danger" style={{ marginBottom: "0.5rem" }}>
                        Error
                    </div>
                    <p style={{ margin: 0, color: "var(--gray-700)" }}>{err}</p>
                </Card>
            ) : null}

            <div className="ui-grid ui-grid-3" style={{ marginTop: "1rem" }}>
                {loading ? (
                    <>
                        <Skeleton height={92} radius={14} />
                        <Skeleton height={92} radius={14} />
                        <Skeleton height={92} radius={14} />
                    </>
                ) : (
                    <>
                        <StatTile
                            label="Linked children"
                            value={dash?.linkedChildren ?? 0}
                            icon={<Users size={16} />}
                            tone="primary"
                        />
                        <StatTile
                            label="Unread notifications"
                            value={dash?.unreadNotifications ?? 0}
                            icon={<Bell size={16} />}
                            tone={(dash?.unreadNotifications ?? 0) > 0 ? "warning" : "info"}
                        />
                        <StatTile
                            label="Family status"
                            value={(dash?.linkedChildren ?? 0) > 0 ? "Active" : "Pending"}
                            icon={<CalendarDays size={16} />}
                            tone={(dash?.linkedChildren ?? 0) > 0 ? "success" : "purple"}
                        />
                    </>
                )}
            </div>

            <div style={{ marginTop: "1.25rem" }}>
                <Card>
                    <CardHeader
                        title="Quick actions"
                        subtitle="Jump straight into the things you do most often."
                    />
                    <CardSection>
                        <div className="ui-grid ui-grid-3">
                            <QuickLink
                                href="/parent/chat"
                                icon={<MessageSquare size={18} />}
                                label="Messages"
                                hint="Talk to teachers"
                            />
                            <QuickLink
                                href="/parent/grades"
                                icon={<Users size={18} />}
                                label="Grades"
                                hint="Latest marks"
                            />
                            <QuickLink
                                href="/parent/settings"
                                icon={<Settings size={18} />}
                                label="Account"
                                hint="Profile & preferences"
                            />
                        </div>
                    </CardSection>
                </Card>
            </div>

            {!loading && !err && (dash?.linkedChildren ?? 0) === 0 ? (
                <div style={{ marginTop: "1.25rem" }}>
                    <Card padded>
                        <EmptyState
                            icon={<Users size={28} />}
                            title="No linked children yet"
                            description="Once the school links a student to your account, you'll see grades, attendance, and announcements here."
                            action={<Badge tone="info" dot>Pending school setup</Badge>}
                        />
                    </Card>
                </div>
            ) : null}
        </div>
    );
}

function QuickLink({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint: string }) {
    return (
        <Link
            href={href}
            className="ui-card ui-card-padded ui-card-interactive"
            style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
            <span
                aria-hidden
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--role-accent-50)",
                    color: "var(--role-accent-600)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                {icon}
            </span>
            <span>
                <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)" }}>{label}</span>
                <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--gray-500)" }}>{hint}</span>
            </span>
        </Link>
    );
}
