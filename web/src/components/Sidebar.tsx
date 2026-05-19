"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<{ label: string, top: number } | null>(null);
    let currentSection = "";

    // Load collapsible state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("sidebarCollapsed");
        if (stored === "true") {
            setIsCollapsed(true);
        }
    }, []);

    // Sync collapsible state to document body class list and localStorage
    useEffect(() => {
        if (isCollapsed) {
            document.body.classList.add("sidebar-collapsed");
            localStorage.setItem("sidebarCollapsed", "true");
        } else {
            document.body.classList.remove("sidebar-collapsed");
            localStorage.setItem("sidebarCollapsed", "false");
        }
    }, [isCollapsed]);

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
            {!mobileOpen && (
                <button
                    className="sidebar-mobile-toggle"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Toggle menu"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
            )}

            {/* Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${isCollapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}>
                {/* Floating Desktop Collapse Button on Sidebar's Right Border Line */}
                {!mobileOpen && (
                    <button 
                        type="button"
                        className="sidebar-desktop-collapse-btn"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}

                <div className="sidebar-header" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }} aria-label="Go to home page">
                        <div className="sidebar-logo" style={{ overflow: "hidden", borderRadius: "10px", padding: 0, background: "transparent", flexShrink: 0 }}>
                            <img src="https://avatars.githubusercontent.com/u/261413181?s=200&v=4" alt="TriLink" width={36} height={36} style={{ width: 36, height: 36, objectFit: "contain", display: "block" }} />
                        </div>
                        <div className="sidebar-brand-wrapper" style={{ display: isCollapsed ? "none" : "block" }}>
                            <div className="sidebar-brand">Tri<span>Link</span></div>
                            <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {role} Portal
                            </div>
                        </div>
                    </Link>

                    {/* Mobile close button inside the header on the right side */}
                    {mobileOpen && (
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            style={{
                                border: "1px solid var(--gray-200)",
                                background: "#fff",
                                padding: 6,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--gray-500)",
                                position: "absolute",
                                right: "0.75rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                borderRadius: "8px",
                                boxShadow: "var(--shadow-sm)"
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {items.map((item, i) => {
                        const showSection = item.section && item.section !== currentSection;
                        if (item.section) currentSection = item.section;
                        const isActive = pathname === item.href || (item.href !== `/${role.toLowerCase()}/dashboard` && pathname.startsWith(item.href));

                        return (
                            <div key={i}>
                                {showSection && !isCollapsed && (
                                    <div className="sidebar-section">{item.section}</div>
                                )}
                                <Link 
                                    href={item.href} 
                                    className={`nav-item ${isActive ? "active" : ""}`}
                                    onMouseEnter={(e) => {
                                        if (isCollapsed && window.innerWidth >= 769) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 });
                                        }
                                    }}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span className="nav-label" style={{ display: isCollapsed ? "none" : "inline" }}>{item.label}</span>
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
                        onMouseEnter={(e) => {
                            if (isCollapsed && window.innerWidth >= 769) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredItem({ label: "Logout", top: rect.top + rect.height / 2 });
                            }
                        }}
                        onMouseLeave={() => setHoveredItem(null)}
                    >
                        <span className="nav-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </span>
                        <span className="nav-label" style={{ display: isCollapsed ? "none" : "inline" }}>Logout</span>
                    </button>
                </div>

                {/* Fixed tooltip for collapsed layout */}
                {hoveredItem && isCollapsed && (
                    <div style={{
                        position: "fixed",
                        left: "82px",
                        top: hoveredItem.top,
                        transform: "translateY(-50%)",
                        background: "var(--gray-900)",
                        color: "#fff",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        zIndex: 2000,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}>
                        {hoveredItem.label}
                        <div style={{
                            position: "absolute",
                            right: "100%",
                            top: "50%",
                            transform: "translateY(-50%)",
                            borderWidth: "5px",
                            borderStyle: "solid",
                            borderColor: "transparent var(--gray-900) transparent transparent",
                        }} />
                    </div>
                )}
            </aside>
        </>
    );
}