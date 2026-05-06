"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAcademicYearStore } from "@/store/academicYearStore";
import { clearAuth } from "@/lib/auth";
import { ArrowRight, Search } from "lucide-react";
import { getActiveAcademicYear, listAcademicYears } from "@/lib/admin-api";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useToastStore } from "@/store/toastStore";
import RealtimeToast from "@/components/RealtimeToast";
import Select from "@/components/Select";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";
import { navSearchIndex, type NavRole } from "@/lib/role-nav";

interface HeaderProps {
    userName: string;
    userRole: string;
    userInitials: string;
    userProfileHref?: string;
    userProfileImageFileId?: string;
    userId?: string;
}

const ROLE_ROUTES: Record<string, Array<{ href: string; keywords: string[] }>> = {
    teacher: [
        { href: "/teacher/dashboard", keywords: ["dashboard", "home", "overview"] },
        { href: "/teacher/attendance", keywords: ["attendance", "present", "absent"] },
        { href: "/teacher/announcements", keywords: ["announcement", "announcements", "notice"] },
        { href: "/teacher/exams", keywords: ["exam", "exams", "quiz", "bank", "grade"] },
        { href: "/teacher/students", keywords: ["student", "students", "learner"] },
        { href: "/teacher/notifications", keywords: ["notification", "notifications", "alerts"] },
        { href: "/teacher/chat", keywords: ["chat", "message", "messages", "conversation"] },
        { href: "/teacher/calendar", keywords: ["calendar", "event", "events", "schedule"] },
        { href: "/teacher/settings", keywords: ["setting", "settings", "security", "password", "2fa"] },
        { href: "/teacher/profile", keywords: ["profile", "account"] },
    ],
    admin: [
        { href: "/admin/dashboard", keywords: ["dashboard", "home", "overview"] },
        { href: "/admin/school-setup", keywords: ["school", "setup", "configuration", "config"] },
        { href: "/admin/students", keywords: ["student", "students"] },
        { href: "/admin/teachers", keywords: ["teacher", "teachers", "staff"] },
        { href: "/admin/parents", keywords: ["parent", "parents", "guardian"] },
        { href: "/admin/attendance", keywords: ["attendance", "present", "absent"] },
        { href: "/admin/announcements", keywords: ["announcement", "announcements", "notice"] },
        { href: "/admin/classes", keywords: ["class", "classes"] },
        { href: "/admin/registration", keywords: ["registration", "register", "enroll"] },
        { href: "/admin/chat", keywords: ["chat", "message", "messages", "conversation"] },
        { href: "/admin/feedback", keywords: ["feedback", "review"] },
        { href: "/admin/audit", keywords: ["audit", "log", "activity", "history"] },
        { href: "/admin/settings", keywords: ["setting", "settings", "security"] },
        { href: "/admin/profile", keywords: ["profile", "account"] },
    ],
    student: [
        { href: "/student/dashboard", keywords: ["dashboard", "home", "overview"] },
        { href: "/student/chat", keywords: ["chat", "message", "messages"] },
        { href: "/student/profile", keywords: ["profile", "account"] },
        { href: "/student/settings", keywords: ["settings", "security"] },
        { href: "/student/login", keywords: ["login", "sign in"] },
    ],
    parent: [
        { href: "/parent/dashboard", keywords: ["dashboard", "home", "overview"] },
        { href: "/parent/chat", keywords: ["chat", "message", "messages"] },
        { href: "/parent/profile", keywords: ["profile", "account"] },
        { href: "/parent/settings", keywords: ["settings", "security"] },
    ],
};

export default function Header({ userName, userRole, userInitials, userProfileHref, userProfileImageFileId, userId }: HeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [searchText, setSearchText] = useState("");
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [suggestions, setSuggestions] = useState<{ href: string; label: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchMessage, setSearchMessage] = useState("");
    const searchRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        }
        if (showUserMenu || showSuggestions) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showUserMenu, showSuggestions]);
    
    // Academic year: admin dropdown is loaded from API (not the static list in the store).
    const { currentSystemYear, adminSelectedYear, setAdminSelectedYear } = useAcademicYearStore();
    const [adminYearLabels, setAdminYearLabels] = useState<string[]>([]);
    const [portalYearLabel, setPortalYearLabel] = useState<string | null>(null);

    const role = pathname.split("/").filter(Boolean)[0] ?? "";

    useEffect(() => {
        if (role !== "admin") {
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const list = await listAcademicYears();
                if (cancelled) return;
                const labels = list.map((y) => y.label);
                setAdminYearLabels(labels);
                const prev = useAcademicYearStore.getState().adminSelectedYear;
                const active = list.find((y) => y.isActive && !y.isArchived);
                const next = labels.includes(prev) ? prev : active?.label ?? labels[0] ?? prev;
                if (next !== prev) useAcademicYearStore.getState().setAdminSelectedYear(next);
            } catch {
                if (!cancelled) {
                    setAdminYearLabels([]);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [role, pathname]);

    useEffect(() => {
        if (role === "admin") {
            return;
        }
        if (!["teacher", "student", "parent"].includes(role)) {
            return;
        }
        let cancelled = false;
        getActiveAcademicYear()
            .then((y) => {
                if (!cancelled) setPortalYearLabel(y?.label ?? null);
            })
            .catch(() => {
                if (!cancelled) setPortalYearLabel(null);
            });
        return () => {
            cancelled = true;
        };
    }, [role, pathname]);
    
    // Real-time notifications
    const { toast, setToast } = useRealtimeNotifications(userId, userName);
    const { toast: manualToast, hideToast } = useToastStore();

    useEffect(() => {
        const q = searchText.trim().toLowerCase();
        if (q.length < 2) {
            setSuggestions([]);
            setSearchMessage("");
            return;
        }
        const rts = navSearchIndex[role as NavRole] || ROLE_ROUTES[role] || [];
        const filtered = rts.filter(r => 
            r.href.toLowerCase().includes(q) || 
            r.keywords.some(k => k.toLowerCase().includes(q)) ||
            (r.href.split("/").pop() || "").includes(q)
        ).map(r => ({
            href: r.href,
            label: r.href.split("/").pop()?.replace(/-/g, " ").replace(/^\w/, c => c.toUpperCase()) || "Page"
        }));
        setSuggestions(filtered.slice(0, 5));
        setSearchMessage(filtered.length === 0 ? "No matching page. Try students, exams, grades, chat, or settings." : "");
        setShowSuggestions(true);
    }, [searchText, role]);

    const quickActionRoutes: Record<string, { notifications?: string; messages? : string }> = {
        teacher: { notifications: "/teacher/notifications", messages: "/teacher/chat" },
        admin: { notifications: "/admin/announcements", messages: "/admin/chat" },
        student: { messages: "/student/chat" },
        parent: { messages: "/parent/chat" },
    };

    const notificationsHref = quickActionRoutes[role]?.notifications;
    const messagesHref = quickActionRoutes[role]?.messages;

    function getSearchTarget(query: string) {
        const q = query.trim().toLowerCase().replace(/\s+/g, " ");
        if (!q) return null;

        // Allow direct path navigation from search input.
        if (q.startsWith("/")) {
            return q;
        }

        const routes = navSearchIndex[role as NavRole] ?? ROLE_ROUTES[role] ?? [];

        // First pass: exact/contains match against route path.
        const byPath = routes.find((item) => item.href.toLowerCase().includes(q.replace(/\s+/g, "-")));
        if (byPath) return byPath.href;

        // Second pass: keyword scoring for better fuzzy navigation.
        let best: { href: string; score: number } | null = null;
        for (const item of routes) {
            let score = 0;
            for (const kw of item.keywords) {
                const k = kw.toLowerCase();
                if (k === q) score += 4;
                else if (k.startsWith(q) || q.startsWith(k)) score += 2;
                else if (k.includes(q) || q.includes(k)) score += 1;
            }
            if (score > 0 && (!best || score > best.score)) {
                best = { href: item.href, score };
            }
        }
        return best?.href ?? null;
    }

    function submitSearch() {
        const query = searchText.trim();
        if (!query) return;
        const target = getSearchTarget(query);
        if (!target) {
            setSearchMessage("No matching page. Try students, exams, grades, chat, or settings.");
            setShowSuggestions(true);
            return;
        }
        router.push(target);
        setSearchText("");
        setShowSuggestions(false);
        setSearchMessage("");
    }

    function handleLogout() {
        clearAuth();
        const role = pathname.split("/").filter(Boolean)[0] ?? "admin";
        router.push(`/${role}/login`);
    }

    const userBlock = (
        <div style={{ position: "relative" }} ref={userMenuRef}>
            <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                aria-label="User menu"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                <div className="header-user">
                    <div className="header-user-info" style={{ display: "var(--user-info-display, flex)" }}>
                        <div className="header-user-name">{userName}</div>
                        <div className="header-user-role">{userRole}</div>
                    </div>
<AuthenticatedAvatar
    fileId={userProfileImageFileId}
    initials={userInitials}
    size={36}
    alt={userName}
/>
                </div>
            </button>
            {showUserMenu && (
                <>
                    {/* Dropdown */}
                    <div style={{
                        position: "absolute", right: 0, top: "calc(100% + 8px)",
                        background: "#fff", borderRadius: 12, zIndex: 1000,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                        border: "1px solid var(--gray-100)",
                        minWidth: 180, overflow: "hidden",
                    }}>
                        {userProfileHref && (
                            <Link
                                href={userProfileHref}
                                onClick={() => setShowUserMenu(false)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "12px 16px", textDecoration: "none",
                                    color: "var(--gray-700)", fontSize: 14, fontWeight: 500,
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                                View Profile
                            </Link>
                        )}
                        <div style={{ borderTop: "1px solid var(--gray-100)" }} />
                        <button
                            onClick={handleLogout}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                width: "100%", padding: "12px 16px",
                                background: "none", border: "none", cursor: "pointer",
                                color: "#dc2626", fontSize: 14, fontWeight: 500,
                                textAlign: "left",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <header className="top-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="header-search-wrap" ref={searchRef} style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div className="header-search">
                <button type="button" className="header-search-btn" onClick={submitSearch} aria-label="Search">
                    <Search className="search-icon" size={16} />
                </button>
                <input
                    type="text"
                    placeholder="Search pages, people, classes..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onFocus={() => {
                        if (searchText.trim().length >= 2) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            submitSearch();
                        } else if (e.key === "Escape") {
                            setShowSuggestions(false);
                        }
                    }}
                />
            </div>
            {showSuggestions && (suggestions.length > 0 || searchMessage) ? (
                <div className="header-search-panel" role="listbox" aria-label="Search suggestions">
                    <div className="header-search-panel-title">Quick navigation</div>
                    {suggestions.map((item) => (
                        <button
                            key={item.href}
                            type="button"
                            className="header-search-result"
                            onClick={() => {
                                router.push(item.href);
                                setSearchText("");
                                setShowSuggestions(false);
                                setSearchMessage("");
                            }}
                        >
                            <span>{item.label}</span>
                            <small>{item.href}</small>
                            <ArrowRight size={15} />
                        </button>
                    ))}
                    {searchMessage ? <div className="header-search-empty">{searchMessage}</div> : null}
                </div>
            ) : null}
            </div>

            <div className="header-actions" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "nowrap" }}>
                {/* Academic Year Control */}
                {role === "admin" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "1rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--gray-500)", fontWeight: 600 }}>Year:</span>
                        <Select
                            value={
                                adminYearLabels.includes(adminSelectedYear)
                                    ? adminSelectedYear
                                    : adminYearLabels[0] ?? ""
                            }
                            onChange={(e) => setAdminSelectedYear(e.target.value)}
                            disabled={adminYearLabels.length === 0}
                            style={{
                                padding: "0.3rem 0.8rem",
                                borderRadius: "20px",
                                border: "1px solid var(--gray-200)",
                                fontSize: "0.85rem",
                                background: "var(--gray-50)",
                                cursor: adminYearLabels.length === 0 ? "not-allowed" : "pointer",
                                outline: "none",
                                fontWeight: 600,
                                color: "var(--gray-800)",
                            }}
                        >
                            {adminYearLabels.length === 0 ? (
                                <option value="">No academic years</option>
                            ) : (
                                adminYearLabels.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))
                            )}
                        </Select>
                    </div>
                ) : (
                    <div style={{ marginRight: "0.5rem", padding: "0.25rem 0.6rem", background: "var(--primary-50)", color: "var(--primary-600)", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap", display: "var(--year-display, flex)" }}>
                        {portalYearLabel ?? currentSystemYear}
                    </div>
                )}

                {notificationsHref ? (
                    <Link href={notificationsHref} className="header-icon-btn" title="Notifications" aria-label="Open notifications">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        <span className="notification-dot"></span>
                    </Link>
                ) : (
                    <button className="header-icon-btn" title="Notifications" aria-label="Notifications" type="button" aria-disabled="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        <span className="notification-dot"></span>
                    </button>
                )}

                {messagesHref ? (
                    <Link href={messagesHref} className="header-icon-btn" title="Messages" aria-label="Open chat">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </Link>
                ) : (
                    <button className="header-icon-btn" title="Messages" aria-label="Messages" type="button" aria-disabled="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </button>
                )}

                {userBlock}
            </div>

            <RealtimeToast 
                toast={toast || manualToast} 
                onClose={() => {
                    if (toast) setToast(null);
                    if (manualToast) hideToast();
                }} 
            />
        </header>
    );
}
