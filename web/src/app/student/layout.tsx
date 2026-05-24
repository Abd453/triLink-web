"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { clearAuth, getAccessToken, getStoredUser } from "@/lib/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import RealtimeToast from "@/components/RealtimeToast";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser("student");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (pathname === "/student/login") {
      setIsAuthorized(true);
      return;
    }

    const token = getAccessToken();
    const stored = getStoredUser();

    if (!token || !stored || stored.role !== "student") {
      clearAuth();
      setIsAuthorized(false);
      router.replace("/student/login");
      return;
    }

    setIsAuthorized(true);
  }, [pathname, router]);

  const { toast, setToast } = useRealtimeNotifications(user.id, user.fullName);

  // Exam session has its own full-screen layout (no sidebar/header)
  if (pathname.startsWith("/student/exam/")) {
    if (!isAuthorized) return null;
    return <>{children}</>;
  }

  // Login page - no layout
  if (pathname === "/student/login") {
    return <>{children}</>;
  }

  if (!isAuthorized) return null;

  const gradeLabel = [user.grade, user.section].filter(Boolean).join("-") || "Student";

  function handleLogout() {
    clearAuth();
    router.push("/student/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray-50)" }}>
      <header className="student-header">
        <div className="student-header-brand">
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, var(--primary-500), var(--primary-700))",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: "1rem",
            }}
          >
            △
          </div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--gray-900)" }}>
            TriLink <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>|</span>{" "}
            <span style={{ fontWeight: 500, color: "var(--primary-600)", fontSize: "0.9rem" }}>Exam Portal</span>
          </span>
        </div>
        <div className="student-header-user">
          <a
            href="/student/dashboard"
            className="student-desktop-link"
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "8px",
              background: pathname === "/student/dashboard" ? "var(--primary-50)" : "transparent",
              color: pathname === "/student/dashboard" ? "var(--primary-600)" : "var(--gray-600)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid transparent",
            }}
          >
            Exams
          </a>
          <a
            href="/student/tutor"
            className="student-desktop-link"
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "8px",
              background: pathname === "/student/tutor" ? "var(--primary-50)" : "transparent",
              color: pathname === "/student/tutor" ? "var(--primary-600)" : "var(--gray-600)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid transparent",
            }}
          >
            AI Tutor
          </a>
          <a
            href="/student/settings"
            className="student-desktop-link"
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "8px",
              background: pathname.startsWith("/student/settings") ? "var(--primary-50)" : "transparent",
              color: pathname.startsWith("/student/settings") ? "var(--primary-600)" : "var(--gray-600)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid transparent",
            }}
          >
            Settings
          </a>
          <a
            href="/student/grades"
            className="student-desktop-link"
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "8px",
              background: pathname.startsWith("/student/grades") ? "var(--primary-50)" : "transparent",
              color: pathname.startsWith("/student/grades") ? "var(--primary-600)" : "var(--gray-600)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid transparent",
            }}
          >
            Grades
          </a>
          <div className="student-header-user-info">
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                background: "var(--primary-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--primary-600)",
              }}
            >
              {user.initials}
            </div>
            <div className="student-header-user-details">
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.fullName || "Student"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>{gradeLabel}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="student-logout-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.4rem 0.75rem",
              borderRadius: "8px",
              background: "var(--danger-light)",
              color: "#991b1b",
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid rgba(239,68,68,0.2)",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>
      <main className="student-main">{children}</main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="student-mobile-bottom-nav">
        <a href="/student/dashboard" className={`student-mobile-nav-item ${pathname === "/student/dashboard" ? "active" : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Exams</span>
        </a>
        <a href="/student/tutor" className={`student-mobile-nav-item ${pathname === "/student/tutor" ? "active" : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>AI Tutor</span>
        </a>
        <a href="/student/grades" className={`student-mobile-nav-item ${pathname.startsWith("/student/grades") ? "active" : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10" />
            <path d="M18 20V4" />
            <path d="M6 20v-4" />
          </svg>
          <span>Grades</span>
        </a>
        <a href="/student/settings" className={`student-mobile-nav-item ${pathname.startsWith("/student/settings") ? "active" : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </a>
      </nav>
      <RealtimeToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
