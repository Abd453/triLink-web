"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
import { clearAuth } from "@/lib/auth";

export interface NavItem {
    label: string;
    href: string;
    icon: ReactNode;
    badge?: number;
    section?: string;
}

interface SidebarProps {
    role: string;
    items: NavItem[];
    roleColor?: string;
}

export default function Sidebar({ role, items, roleColor }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);
    const sectionByIndex = items.map((item, index) => {
        const previousSection = index > 0 ? items[index - 1]?.section : undefined;
        return item.section && item.section !== previousSection ? item.section : null;
    });
    const roleTone = roleColor || "var(--role-accent-600)";
    const portalLabel = `${role} workspace`;

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Close on ESC
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                className="sidebar-mobile-toggle"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {mobileOpen ? (
                        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    ) : (
                        <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                    )}
                </svg>
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }} aria-label="Go to home page">
                        <div className="sidebar-logo" style={{ overflow: "hidden", padding: 0 }}>
                            <img src="/trilink-logo.png" alt="TriLink" width={40} height={40} style={{ width: 40, height: 40, objectFit: "contain", display: "block" }} />
                        </div>
                        <div>
                            <div className="sidebar-brand">Tri<span>Link</span></div>
                            <div className="sidebar-portal-label">
                                {portalLabel}
                            </div>
                        </div>
                    </Link>
                    <div className="sidebar-role-chip" style={{ color: roleTone }}>
                        Live
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {items.map((item, i) => {
                        const sectionLabel = sectionByIndex[i];
                        const isActive = pathname === item.href || (item.href !== `/${role.toLowerCase()}/dashboard` && pathname.startsWith(item.href));

                        return (
                            <div key={i}>
                                {sectionLabel && (
                                    <div className="sidebar-section">{sectionLabel}</div>
                                )}
                                <Link href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
                                    <span className="nav-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.badge && item.badge > 0 && (
                                        <span className="nav-badge">{item.badge}</span>
                                    )}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-status-card">
                        <div>
                            <span className="sidebar-status-dot" />
                            Secure session
                        </div>
                        <small>Synced with school data</small>
                    </div>
                    <button
                        type="button"
                        className="nav-item"
                        style={{ color: "var(--danger)", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => {
                            clearAuth();
                            router.push(`/${role.toLowerCase()}/login`);
                        }}
                    >
                        <span className="nav-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </span>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
