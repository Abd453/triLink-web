"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { clearAuth, getAccessToken, getStoredUser } from "@/lib/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import RealtimeToast from "@/components/RealtimeToast";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser("parent");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
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
  }, [pathname, router]);

  const { toast, setToast } = useRealtimeNotifications(user.id, user.fullName);

  if (pathname === "/parent/login") return <>{children}</>;
  if (!isAuthorized) return null;

  const subtitle = user.childName
    ? `${user.relationship ?? "Parent"} of ${user.childName}`
    : "Parent Portal";

  function handleLogout() {
    clearAuth();
    router.push("/parent/login");
  }

  const nav = [
    { label: "Home", href: "/parent/dashboard", icon: "🏠" },
    { label: "My Children", href: "/parent/children", icon: "👨‍👩‍👧" },
    { label: "Chat", href: "/parent/chat", icon: "💬" },
    { label: "Profile", href: "/parent/profile", icon: "👤" },
    { label: "Settings", href: "/parent/settings", icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray-50)" }}>
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--gray-200)",
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: "0 1.5rem",
          gap: "1rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
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
            <span style={{ fontWeight: 500, color: "#7c3aed", fontSize: "0.9rem" }}>Parent Portal</span>
          </span>
        </div>

        <nav style={{ display: "flex", gap: "0.25rem", marginLeft: "1rem", flexWrap: "wrap" }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "8px",
                background: pathname === item.href ? "#ede9fe" : "transparent",
                color: pathname === item.href ? "#7c3aed" : "var(--gray-600)",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                background: "#ede9fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#7c3aed",
              }}
            >
              {user.initials}
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.fullName || "Parent"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>{subtitle}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
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
            Logout
          </button>
        </div>
      </header>
      <main style={{ padding: 0 }}>{children}</main>
      <RealtimeToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
