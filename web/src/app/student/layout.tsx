"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { clearAuth, getAccessToken, getStoredUser } from "@/lib/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import RealtimeToast from "@/components/RealtimeToast";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useCurrentUser("student");
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isClient, setIsClient] = useState(false);

    const { toast, setToast } = useRealtimeNotifications(user.id, user.fullName);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;
        if (pathname === "/student/login") {
            setIsAuthorized(true);
            return;
        }
        const token = getAccessToken();
        const userStored = getStoredUser();
        if (!token || !userStored || userStored.role !== "student") {
            clearAuth();
            setIsAuthorized(false);
            router.replace("/student/login");
            return;
        }
        setIsAuthorized(true);
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

    if (pathname === "/student/login") return <>{children}</>;
    if (!isAuthorized) return null;

    const studentNavItems = [
        {
            label: "Dashboard", href: "/student/dashboard", section: "Main",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
        },
        {
            label: "Grades", href: "/student/grades",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
        },
        {
            label: "Assignments", href: "/student/assignments",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
        },
        {
            label: "Chat", href: "/student/chat", section: "Communication",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
        },
        {
            label: "Profile", href: "/student/profile", section: "Account",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
        },
        {
            label: "Settings", href: "/student/settings",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
        },
    ];

    return (
        <div>
            <Sidebar role="Student" items={studentNavItems} />
            <div className="main-content">
                <Header
                    userId={user.id}
                    userName={user.fullName || "Student"}
                    userRole={user.grade && user.section ? `Grade ${user.grade} · Section ${user.section}` : "Student"}
                    userInitials={user.initials}
                    userProfileHref="/student/profile"
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
