"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useNotificationStore } from "@/store/notificationStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getAccessToken, getStoredUser, clearAuth, refreshStoredProfile } from "@/lib/auth";
import RealtimeToast from "@/components/RealtimeToast";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { roleNav } from "@/lib/role-nav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const user = useCurrentUser("teacher");
    const { total, readIds } = useNotificationStore();
    const notifUnread = Math.max(0, total - readIds.length);
    
    // Realtime notifications integration
    const { toast, setToast } = useRealtimeNotifications(user.id, user.fullName);
    
    useEffect(() => {
        setIsClient(true);
    }, []);
    
    useEffect(() => {
        if (!isClient) return;
        if (pathname === "/teacher/login") {
            setIsAuthorized(true);
            return;
        }

        const token = getAccessToken();
        const userStored = getStoredUser();

        if (!token || !userStored || userStored.role !== "teacher") {
            clearAuth();
            setIsAuthorized(false);
            router.replace("/teacher/login");
            return;
        }

        setIsAuthorized(true);
        // Background refresh to ensure any admin changes (like subject mapping) are picked up
        void refreshStoredProfile();
    }, [pathname, router, isClient]);

    if (!isClient) {
        return (
            <div className="admin-shell-loading">
                <main className="admin-shell-loading-main" style={{ marginLeft: 0 }}>
                    <div className="admin-shell-loading-content">
                        <div className="admin-shell-loading-hero admin-loading-shimmer" />
                    </div>
                </main>
            </div>
        );
    }

    if (pathname === "/teacher/login") return <>{children}</>;
    if (!isAuthorized) return null;

    const navItems = roleNav.teacher.map(item =>
        item.href === "/teacher/notifications" && notifUnread > 0
            ? { ...item, badge: notifUnread }
            : item,
    );

    return (
        <div data-role="teacher">
            <Sidebar role="Teacher" items={navItems} />
            <main id="main-content" className="main-content">
                <Header
                    userId={user.id}
                    userName={user.fullName || "Teacher"}
                    userRole={(user.subject && user.section) ? `${user.subject} Teacher · ${user.section}` : user.subject ? `${user.subject} Teacher` : "Teacher"}
                    userInitials={user.initials}
                    userProfileHref="/teacher/profile"
                    userProfileImageFileId={user.profileImageFileId}
                />
                <div style={{ padding: "1.5rem" }}>
                    <ErrorBoundary>{children}</ErrorBoundary>
                </div>
            </main>
            <RealtimeToast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}
