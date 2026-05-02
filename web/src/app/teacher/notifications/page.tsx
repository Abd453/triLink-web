"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
    MessageSquare, Calendar, Megaphone, ClipboardList,
    Bell, CheckCheck, Clock, ChevronRight,
} from "lucide-react";
import {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    type BackendNotification,
} from "@/lib/admin-api";
import { PageHeader, EmptyState } from "@/components/ui";

// ─── category meta ────────────────────────────────────────────────────────────
type Category = "message" | "calendar" | "announcement" | "exam" | "other";

const CAT_META: Record<Category, { label: string; accent: string; bg: string; iconColor: string }> = {
    message:      { label: "Message",      accent: "var(--primary-500)", bg: "var(--primary-100)",   iconColor: "var(--primary-600)" },
    calendar:     { label: "Calendar",     accent: "var(--warning)",     bg: "var(--warning-light)", iconColor: "#92400e" },
    announcement: { label: "Announcement", accent: "var(--purple)",      bg: "var(--purple-light)",  iconColor: "#7c3aed" },
    exam:         { label: "Exam",         accent: "var(--danger)",      bg: "var(--danger-light)",  iconColor: "#991b1b" },
    other:        { label: "Other",        accent: "var(--gray-500)",    bg: "var(--gray-100)",      iconColor: "var(--gray-600)" },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string): string {
    try {
        const ago = Date.now() - new Date(iso).getTime();
        const min = Math.floor(ago / 60_000);
        if (min < 1)  return "Just now";
        if (min < 60) return `${min}m ago`;
        const h = Math.floor(min / 60);
        if (h < 24)   return `${h}h ago`;
        const dy = Math.floor(h / 24);
        if (dy < 7)   return `${dy}d ago`;
        const dt = new Date(iso);
        const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${MN[dt.getMonth()]} ${dt.getDate()}`;
    } catch { return ""; }
}

function typeToCategory(type: string): Category {
    const t = type?.toLowerCase() ?? "";
    if (t.includes("message") || t.includes("chat")) return "message";
    if (t.includes("calendar") || t.includes("event")) return "calendar";
    if (t.includes("announcement")) return "announcement";
    if (t.includes("exam") || t.includes("submission") || t.includes("grade") || t.includes("result")) return "exam";
    return "other";
}

function categoryHref(cat: Category): string {
    switch (cat) {
        case "message": return "/teacher/chat";
        case "calendar": return "/teacher/calendar";
        case "announcement": return "/teacher/announcements";
        case "exam": return "/teacher/exams";
        default: return "/teacher/dashboard";
    }
}

// ─── filter tabs ──────────────────────────────────────────────────────────────
type FilterTab = "all" | Category;

const FILTER_TABS: { key: FilterTab; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
    { key: "all",          label: "All",           Icon: Bell },
    { key: "message",      label: "Messages",      Icon: MessageSquare },
    { key: "calendar",     label: "Calendar",      Icon: Calendar },
    { key: "announcement", label: "Announcements", Icon: Megaphone },
    { key: "exam",         label: "Exams",         Icon: ClipboardList },
];

// ─── main component ───────────────────────────────────────────────────────────
export default function TeacherNotifications() {
    const [notifications, setNotifications] = useState<BackendNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>("all");

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const data = await listNotifications();
            setNotifications(data);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── derived ──
    const items = useMemo(() =>
        notifications
            .map(n => ({
                ...n,
                category: typeToCategory(n.type),
                timeLabel: relTime(n.createdAt),
                isRead: !!n.readAt,
            }))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]);

    const counts = useMemo(() => {
        const next: Record<FilterTab, number> = { all: 0, message: 0, calendar: 0, announcement: 0, exam: 0, other: 0 };
        for (const n of items) {
            if (!n.isRead) {
                next.all += 1;
                if (n.category in next) next[n.category as FilterTab] += 1;
            }
        }
        return next;
    }, [items]);

    const filtered = useMemo(
        () => activeTab === "all" ? items : items.filter(n => n.category === activeTab),
        [activeTab, items],
    );

    const totalUnread = counts.all;

    async function handleMarkRead(id: string) {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
        } catch { /* ignore */ }
    }

    async function handleMarkAll() {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        } catch { /* ignore */ }
    }

    return (
        <div className="page-wrapper">
            <PageHeader
                kicker="Inbox"
                title="Notifications"
                subtitle={loading ? "Loading…" : (totalUnread > 0 ? `${totalUnread} unread notification${totalUnread !== 1 ? "s" : ""}` : "All caught up!")}
                icon={<Bell size={22} />}
                variant="light"
                actions={(
                    <div style={{ display: "flex", gap: 8 }}>
                        {totalUnread > 0 && (
                            <button className="btn btn-secondary" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, borderRadius: 12 }} onClick={() => void handleMarkAll()}>
                                <CheckCheck size={14} strokeWidth={2} /> Mark all read
                            </button>
                        )}
                        <Link href="/teacher/calendar" className="btn btn-outline" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, borderRadius: 12 }}>
                            <Calendar size={14} strokeWidth={2} /> Calendar
                        </Link>
                    </div>
                )}
            />

            {err && <div className="card" style={{ marginBottom: "1rem", color: "var(--danger)" }}>{err}</div>}

            {/* ── filter tabs ── */}
            <div
                style={{
                    display: "flex",
                    gap: "0.25rem",
                    background: "#fff",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--gray-100)",
                    padding: "0.375rem",
                    marginBottom: "1.25rem",
                    boxShadow: "var(--shadow-card)",
                    overflowX: "auto",
                }}
            >
                {FILTER_TABS.map(({ key, label, Icon }) => {
                    const uc = counts[key] ?? 0;
                    const active = activeTab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.5rem 0.875rem",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.8125rem",
                                fontWeight: active ? 600 : 500,
                                color: active ? "var(--primary-700)" : "var(--gray-500)",
                                background: active ? "var(--primary-50)" : "transparent",
                                border: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                transition: "all var(--transition-fast)",
                            }}
                        >
                            <Icon size={14} strokeWidth={2} />
                            {label}
                            {uc > 0 && (
                                <span
                                    style={{
                                        minWidth: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        background: active ? "var(--primary-600)" : "var(--danger)",
                                        color: "#fff",
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "0 4px",
                                    }}
                                >
                                    {uc}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── notification list ── */}
            {loading ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--gray-400)" }}>
                    Loading notifications…
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<Bell size={26} />}
                    title="No notifications"
                    description="You're all caught up in this category."
                />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {filtered.map((notif) => {
                        const meta = CAT_META[notif.category] ?? CAT_META.other;
                        const accent = meta.accent;
                        const bg = meta.bg;
                        const iconColor = meta.iconColor;
                        const isRead = notif.isRead;

                        const IconComp =
                            notif.category === "message"      ? MessageSquare :
                            notif.category === "calendar"     ? Calendar :
                            notif.category === "announcement" ? Megaphone :
                            notif.category === "exam"         ? ClipboardList :
                            Bell;

                        return (
                            <div
                                key={notif.id}
                                className="card"
                                onClick={() => void handleMarkRead(notif.id)}
                                style={{
                                    padding: "1rem 1.25rem",
                                    borderLeft: `4px solid ${isRead ? "var(--gray-200)" : accent}`,
                                    cursor: "pointer",
                                    opacity: isRead ? 0.7 : 1,
                                    transition: "opacity var(--transition-fast), box-shadow var(--transition-fast)",
                                    position: "relative",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                                    {/* icon circle */}
                                    <div
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "var(--radius-full)",
                                            background: isRead ? "var(--gray-100)" : bg,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            color: isRead ? "var(--gray-400)" : iconColor,
                                        }}
                                    >
                                        <IconComp size={18} strokeWidth={2} />
                                    </div>

                                    {/* content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: 2 }}>
                                            <span
                                                style={{
                                                    fontSize: "0.875rem",
                                                    fontWeight: isRead ? 500 : 600,
                                                    color: isRead ? "var(--gray-500)" : "var(--gray-800)",
                                                }}
                                            >
                                                {notif.title}
                                            </span>
                                        </div>
                                        <p
                                            style={{
                                                fontSize: "0.8125rem",
                                                color: "var(--gray-400)",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                maxWidth: "100%",
                                            }}
                                        >
                                            {notif.body}
                                        </p>
                                    </div>

                                    {/* right side: time + unread dot + action */}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-end",
                                            gap: "0.4rem",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.4rem",
                                                fontSize: "0.75rem",
                                                color: "var(--gray-400)",
                                            }}
                                        >
                                            <Clock size={12} strokeWidth={2} />
                                            {notif.timeLabel}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                            {!isRead && (
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        background: accent,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                            <Link
                                                href={categoryHref(notif.category)}
                                                onClick={(e) => { e.stopPropagation(); void handleMarkRead(notif.id); }}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    color: "var(--primary-500)",
                                                    padding: "2px 4px",
                                                    borderRadius: 4,
                                                }}
                                            >
                                                <ChevronRight size={14} strokeWidth={2} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
