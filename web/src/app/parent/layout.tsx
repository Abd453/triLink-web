"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { clearAuth, getAccessToken, getStoredUser, refreshStoredProfile } from "@/lib/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useNotificationStore } from "@/store/notificationStore";
import RealtimeToast from "@/components/RealtimeToast";
import { roleNav } from "@/lib/role-nav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useCurrentUser("parent");
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const { total, readIds } = useNotificationStore();
    const notifUnread = Math.max(0, total - readIds.length);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;
        if (pathname === "/parent/login") {
            setIsAuthorized(true);
            return;
        }
        const token = getAccessToken();
        const stored = getStoredUser();
        if (!token || !stored || stored.role !== "parent") {
            clearAuth();
            setIsAuthorized(false);
            router.replace("/parent/login");
            return;
        }
        setIsAuthorized(true);
        void refreshStoredProfile();
    }, [pathname, router, isClient]);

    const { toast, setToast } = useRealtimeNotifications(user.id, user.fullName);

    if (pathname === "/parent/login") return <>{children}</>;
    if (!isClient || !isAuthorized) return null;

    const navItems = roleNav.parent.map(item =>
        item.href === "/parent/notifications" && notifUnread > 0
            ? { ...item, badge: notifUnread }
            : item,
    );

    const subtitle = user.childName
        ? `${user.relationship ?? "Parent"} of ${user.childName}`
        : "Parent Portal";

    return (
        <div data-role="parent">
            <Sidebar role="Parent" items={navItems} />
            <main id="main-content" className="main-content">
                <Header
                    userId={user.id}
                    userName={user.fullName || "Parent"}
                    userRole={subtitle}
                    userInitials={user.initials}
                    userProfileHref="/parent/profile"
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
