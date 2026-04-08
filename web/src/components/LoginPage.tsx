"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStoredProfile, setTokens, setStoredUser } from "@/lib/auth";
import { apiPath, getApiBase } from "@/lib/api";

type PortalRole = "admin" | "teacher" | "student" | "parent";

interface LoginPageProps {
    role: string;
    rolePlural: string;
    dashboardPath: string;
    gradient?: string;
    tagline?: string;
}

export default function LoginPage({ role, rolePlural, dashboardPath, gradient, tagline }: LoginPageProps) {
    const canUseForgotPassword = role.toLowerCase() !== "admin";
    const normalizedRole = role.toLowerCase() as PortalRole;
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const [resetError, setResetError] = useState("");
    const [resetting, setResetting] = useState(false);
    const router = useRouter();


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        if (!email || !password) {
            setLoginError("Please enter your email and password.");
            return;
        }

        setLoading(true);

        try {
            const apiBase = getApiBase();
            const loginPath = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH ?? apiPath.login;

            const res = await fetch(`${apiBase}${loginPath}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.toLowerCase(), password, role: role.toLowerCase() }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || "Invalid email or password.");
            }

            // Store JWT so authFetch can attach it to subsequent requests
            setTokens(data.accessToken ?? "", data.refreshToken);

            // Store user profile so layouts can show real name/initials
            if (data.user ?? data.id ?? data.firstName) {
                const u = data.user ?? data;
                setStoredUser({
                    id: u.id,
                    firstName: u.firstName ?? "",
                    lastName: u.lastName ?? "",
                    email: u.email ?? email.toLowerCase(),
                    role: (u.role ?? role).toLowerCase(),
                    grade: u.grade,
                    section: u.section,
                    subject: u.subject,
                    department: u.department,
                    childName: u.childName,
                    relationship: u.relationship,
                    profileImageFileId: u.profileImageFileId || data.profileImageFileId || data.profileImageId || data.avatarId,
                });
            } else {
                // Fallback: at minimum store email + role
                setStoredUser({ firstName: "", lastName: "", email: email.toLowerCase(), role: role.toLowerCase() });
            }

            await refreshStoredProfile();

            router.push(dashboardPath);
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : "Login failed. Please try again.");
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError("");
        setResetMessage("");
        
        if (!forgotEmail) {
            setResetError("Please enter your email address");
            return;
        }

        setResetting(true);

        try {
            const resetPayload = {
                emailType: "reset-password",
                to: forgotEmail.toLowerCase(),
                role: normalizedRole,
                resetLink: `${window.location.origin}/reset-password?email=${encodeURIComponent(forgotEmail.toLowerCase())}&role=${normalizedRole}`,
            };

            const res = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(resetPayload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to send reset email");
            }

            setResetMessage(`Password reset instructions have been sent to ${forgotEmail}`);
            setForgotEmail("");
            
            setTimeout(() => {
                setShowForgotPassword(false);
                setResetMessage("");
            }, 3000);
        } catch (err) {
            setResetError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-left">
                <div className="login-card">
                    <div className="login-logo-wrapper">
                        <div className="login-logo">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
                            </svg>
                        </div>
                    </div>
                    <div className="login-heading">
                        <h1>Welcome to TriLink</h1>
                        <p>{tagline || "Learn smarter, grow faster"}</p>
                    </div>

                    {!showForgotPassword || !canUseForgotPassword ? (
                        <>
                            <form className="login-form" onSubmit={handleLogin}>
                                {loginError && (
                                    <div style={{ marginBottom: "0.1rem", color: "#dc2626", fontSize: "0.82rem", fontWeight: 600, lineHeight: 1.25 }}>
                                        {loginError}
                                    </div>
                                )}

                                <div className="input-group">
                                    <label htmlFor="login-email">Email</label>
                                    <div className="input-field">
                                        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2" />
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                        </svg>
                                        <input
                                            id="login-email"
                                            type="email"
                                            placeholder={`${role.toLowerCase()}@school.edu`}
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                if (loginError) {
                                                    setLoginError("");
                                                }
                                            }}
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label htmlFor="login-password">Password</label>
                                    <div className="input-field">
                                        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                        <input
                                            id="login-password"
                                            type={showPwd ? "text" : "password"}
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                if (loginError) {
                                                    setLoginError("");
                                                }
                                            }}
                                            disabled={loading}
                                        />
                                        <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ color: "var(--gray-400)" }} disabled={loading}>
                                            {showPwd ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                                    <line x1="2" x2="22" y1="2" y2="22" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {canUseForgotPassword && (
                                    <div className="login-forgot">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            style={{ background: "none", border: "none", color: "var(--blue-600)", cursor: "pointer", textDecoration: "underline" }}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {loginError && (
                                    <div style={{
                                        padding: "0.75rem 1rem",
                                        marginBottom: "0.75rem",
                                        background: "var(--red-50, #fff5f5)",
                                        border: "1px solid var(--red-300, #fc8181)",
                                        borderRadius: "var(--radius-md, 8px)",
                                        color: "var(--red-700, #c53030)",
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                    }}>
                                        {loginError}
                                    </div>
                                )}

                                <button type="submit" className="login-btn" disabled={loading}>
                                    {loading ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                                            </svg>
                                            Logging in...
                                        </span>
                                    ) : "LOG IN"}
                                </button>
                            </form>

                            <div className="login-offline">
                                <a href="#">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                                        <line x1="12" y1="20" x2="12.01" y2="20" />
                                    </svg>
                                    Continue offline
                                </a>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--blue-50)", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--blue-500)" }}>
                                <p style={{ fontSize: "0.875rem", color: "var(--blue-700)" }}>
                                    Enter your email and we'll send you a link to reset your password.
                                </p>
                            </div>

                            <form className="login-form" onSubmit={handleForgotPassword}>
                                <div className="input-group">
                                    <label htmlFor="forgot-email">Email Address</label>
                                    <div className="input-field">
                                        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2" />
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                        </svg>
                                        <input
                                            id="forgot-email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            disabled={resetting}
                                        />
                                    </div>
                                </div>

                                {resetError && (
                                    <div style={{ padding: "0.75rem", marginBottom: "1rem", background: "var(--red-50)", borderRadius: "var(--radius-md)", color: "var(--red-700)", fontSize: "0.875rem" }}>
                                        {resetError}
                                    </div>
                                )}

                                {resetMessage && (
                                    <div style={{ padding: "0.75rem", marginBottom: "1rem", background: "var(--green-50)", borderRadius: "var(--radius-md)", color: "var(--green-700)", fontSize: "0.875rem" }}>
                                        {resetMessage}
                                    </div>
                                )}

                                <button type="submit" className="login-btn" disabled={resetting} style={{ marginBottom: "0.75rem" }}>
                                    {resetting ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                                            </svg>
                                            Sending...
                                        </span>
                                    ) : "SEND RESET LINK"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForgotPassword(false);
                                        setForgotEmail("");
                                        setResetError("");
                                        setResetMessage("");
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem 1rem",
                                        background: "var(--gray-100)",
                                        border: "1px solid var(--gray-200)",
                                        borderRadius: "var(--radius-md)",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        color: "var(--gray-700)",
                                    }}
                                >
                                    Back to Login
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <div className="login-right" style={gradient ? { background: gradient } : {}}>
                <div className="login-right-content">
                    <h2>{role} Portal</h2>
                    <p>
                        {role === "Student"
                            ? "Access your exams, view grades, and stay connected with your learning journey."
                            : role === "Teacher"
                                ? "Manage classes, create assessments, and track student progress with powerful tools."
                                : role === "Admin"
                                    ? "Oversee school operations, manage registrations, and monitor performance analytics."
                                    : "Stay connected with your child's education, view attendance, and communicate with teachers."}
                    </p>
                </div>
            </div>
        </div>
    );
}
