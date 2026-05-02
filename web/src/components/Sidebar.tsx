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
    let currentSection = "";

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
                        <div className="sidebar-logo" style={{ overflow: "hidden", borderRadius: "10px", padding: 0, background: "transparent" }}>
                            <img src="https://avatars.githubusercontent.com/u/261413181?s=200&v=4" alt="TriLink" width={36} height={36} style={{ width: 36, height: 36, objectFit: "contain", display: "block" }} />
                        </div>
                        <div>
                            <div className="sidebar-brand">Tri<span>Link</span></div>
                            <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {role} Portal
                            </div>
                        </div>
                    </Link>
                </div>

                <nav className="sidebar-nav">
                    {items.map((item, i) => {
                        const showSection = item.section && item.section !== currentSection;
                        if (item.section) currentSection = item.section;
                        const isActive = pathname === item.href || (item.href !== `/${role.toLowerCase()}/dashboard` && pathname.startsWith(item.href));

                        return (
                            <div key={i}>
                                {showSection && (
                                    <div className="sidebar-section">{item.section}</div>
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
