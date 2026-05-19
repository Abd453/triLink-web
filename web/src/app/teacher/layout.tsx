"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useNotificationStore } from "@/store/notificationStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getAccessToken, getStoredUser, clearAuth, refreshStoredProfile } from "@/lib/auth";
import RealtimeToast from "@/components/RealtimeToast";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

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
            <div className="admin-shell-loading" suppressHydrationWarning>
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

    const teacherNavItems = [
        {
            label: "Dashboard", href: "/teacher/dashboard", section: "Main",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
        },
        {
            label: "Attendance", href: "/teacher/attendance",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></svg>,
        },
        {
            label: "Announcements", href: "/teacher/announcements",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>,
        },
        {
            label: "Exams", href: "/teacher/exams", section: "Academic",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m9 15 2 2 4-4" /></svg>,
        },
        {
            label: "Students", href: "/teacher/students",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
        },
        {
            label: "Gradebook", href: "/teacher/grades",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
        },
        {
            label: "Assignments", href: "/teacher/assignments",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
        },
        {
            label: "Homeroom", href: "/teacher/homeroom",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
        },
        {
            label: "Report Cards", href: "/teacher/report-cards",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
        },
        {
            label: "Notifications", href: "/teacher/notifications", section: "Communication", badge: notifUnread > 0 ? notifUnread : undefined,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" /></svg>,
        },
        {
            label: "Chat", href: "/teacher/chat",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
        },
        {
            label: "Calendar", href: "/teacher/calendar", section: "Other",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>,
        },
        {
            label: "Settings", href: "/teacher/settings",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
        },
    ];

    return (
        <div>
            <Sidebar role="Teacher" items={teacherNavItems} />
            <div className="main-content">
                <Header
                    userId={user.id}
                    userName={user.fullName || "Teacher"}
                    userRole={(user.subject && user.section) ? `${user.subject} Teacher · ${user.section}` : user.subject ? `${user.subject} Teacher` : "Teacher"}
                    userInitials={user.initials}
                    userProfileHref="/teacher/profile"
                    userProfileImageFileId={user.profileImageFileId}
                />
                <div style={{ padding: "1.5rem" }}>
                    {children}
                </div>
            </div>
            {toast && (
                <RealtimeToast
                    toast={toast}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
