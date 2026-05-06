"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { refreshStoredProfile, setTokens, setStoredUser } from "@/lib/auth";
import { apiPath, getApiBase } from "@/lib/api";
import { Button, Input } from "@/components/ui";

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
                            <form className="login-form" onSubmit={handleLogin} noValidate>
                                <Input
                                    id="login-email"
                                    label="Email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder={`${role.toLowerCase()}@school.edu`}
                                    leftIcon={<Mail size={16} />}
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (loginError) setLoginError("");
                                    }}
                                    disabled={loading}
                                />

                                <Input
                                    id="login-password"
                                    label="Password"
                                    type={showPwd ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    leftIcon={<Lock size={16} />}
                                    rightAddon={
                                        <button
                                            type="button"
                                            onClick={() => setShowPwd((v) => !v)}
                                            disabled={loading}
                                            aria-label={showPwd ? "Hide password" : "Show password"}
                                            style={{ background: "none", border: "none", padding: "0 4px", color: "var(--gray-400)", cursor: "pointer", display: "inline-flex" }}
                                        >
                                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    }
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (loginError) setLoginError("");
                                    }}
                                    disabled={loading}
                                />

                                {canUseForgotPassword && (
                                    <div className="login-forgot">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: "0.875rem" }}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {loginError && (
                                    <div role="alert" style={{
                                        padding: "0.75rem 1rem",
                                        marginBottom: "0.75rem",
                                        background: "#fef2f2",
                                        border: "1px solid #fecaca",
                                        borderRadius: "8px",
                                        color: "#991b1b",
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                    }}>
                                        {loginError}
                                    </div>
                                )}

                                <Button type="submit" loading={loading} fullWidth size="lg">
                                    {loading ? "Logging in…" : "Log in"}
                                </Button>
                            </form>

                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: "1rem", padding: "0.75rem 0.875rem", background: "#eff6ff", borderRadius: "8px", borderLeft: "3px solid #3b82f6" }}>
                                <p style={{ margin: 0, fontSize: "0.875rem", color: "#1e40af" }}>
                                    Enter your email and we&apos;ll send you a link to reset your password.
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
                                    <div role="alert" style={{ padding: "0.75rem 0.875rem", marginBottom: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "0.875rem" }}>
                                        {resetError}
                                    </div>
                                )}

                                {resetMessage && (
                                    <div role="status" style={{ padding: "0.75rem 0.875rem", marginBottom: "0.75rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", fontSize: "0.875rem" }}>
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
                                        background: "var(--gray-100, #f3f4f6)",
                                        border: "1px solid var(--gray-200, #e5e7eb)",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        color: "var(--gray-700, #374151)",
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
