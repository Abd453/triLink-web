"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { clearAuth, getAccessToken, getStoredUser } from "@/lib/auth";
import { roleNav } from "@/lib/role-nav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const user = useCurrentUser("admin");
    const isLoginRoute = pathname === "/admin/login";
    const token = getAccessToken();
    const stored = getStoredUser();
    const isAuthorized = isLoginRoute || (!!token && !!stored && stored.role === "admin");

    useEffect(() => {
        if (isClient && !isLoginRoute && !isAuthorized) {
            clearAuth();
            router.replace("/admin/login");
        }
    }, [isAuthorized, isLoginRoute, router, isClient]);

    if (isLoginRoute) return <>{children}</>;
    
    if (!isClient || !isAuthorized) {
        return (
            <div className="admin-shell-loading">
                <aside className="admin-shell-loading-side">
                    <div className="admin-shell-loading-brand admin-loading-shimmer" />
                    <div className="admin-shell-loading-nav">
                        {Array.from({ length: 11 }).map((_, i) => (
                            <div key={i} className="admin-shell-loading-item admin-loading-shimmer" />
                        ))}
                    </div>
                    <div className="admin-shell-loading-footer admin-loading-shimmer" />
                </aside>
                <main className="admin-shell-loading-main">
                    <header className="admin-shell-loading-head">
                        <div className="admin-shell-loading-search admin-loading-shimmer" />
                        <div className="admin-shell-loading-actions">
                            <div className="admin-shell-loading-chip admin-loading-shimmer" />
                            <div className="admin-shell-loading-icon admin-loading-shimmer" />
                            <div className="admin-shell-loading-icon admin-loading-shimmer" />
                            <div className="admin-shell-loading-user admin-loading-shimmer" />
                        </div>
                    </header>
                    <div className="admin-shell-loading-content">
                        <div className="admin-shell-loading-hero admin-loading-shimmer" />
                        <div className="admin-shell-loading-grid">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="admin-shell-loading-card admin-loading-shimmer" />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const userRole = user.role === "admin" ? "System Administrator" : user.role;

    return (
        <div data-role="admin">
            <Sidebar role="Admin" items={roleNav.admin} />
            <main id="main-content" className="main-content">
                <Header
                    userId={user.id}
                    userName={user.fullName || "Admin User"}
                    userRole={userRole}
                    userInitials={user.initials}
                    userProfileHref="/admin/profile"
                    userProfileImageFileId={user.profileImageFileId}
                />
                <ErrorBoundary>{children}</ErrorBoundary>
            </main>
        </div>
    );
}
