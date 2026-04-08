"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getApiBase, getFileUrl } from "@/lib/api";
import { useToastStore } from "@/store/toastStore";
import { patchMe, uploadProfileImage } from "@/lib/admin-api";
import { authFetch, refreshStoredProfile } from "@/lib/auth";
import Select from "@/components/Select";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";

const TEACHER_SECURITY_STORAGE_KEY = "trilink-teacher-security-v1";
const DEFAULT_TEACHER_PASSWORD = "Teacher@123!";

type TwoFactorAction = "enable" | "disable";

interface PersistedSecurity {
    password: string;
    twoFactorEnabled: boolean;
    recoveryEmail: string;
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPasswordIssues(current: string, next: string) {
    const issues: string[] = [];
    if (next.length < 12) issues.push("At least 12 characters");
    if (!/[A-Z]/.test(next)) issues.push("At least one uppercase letter");
    if (!/[a-z]/.test(next)) issues.push("At least one lowercase letter");
    if (!/[0-9]/.test(next)) issues.push("At least one number");
    if (!/[^A-Za-z0-9]/.test(next)) issues.push("At least one special character");
    if (/\s/.test(next)) issues.push("No spaces allowed");
    if (next === current) issues.push("New password must be different from current password");
    return issues;
}

type Tab = "profile" | "security" | "notifications" | "appearance";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
        key: "profile",
        label: "Profile",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
    {
        key: "security",
        label: "Security",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
    },
    {
        key: "notifications",
        label: "Notifications",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
        ),
    },
    {
        key: "appearance",
        label: "Appearance",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
        ),
    },
];

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: value ? "var(--primary-500)" : "var(--gray-300)",
                position: "relative",
                transition: "background 0.2s",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: value ? 22 : 2,
                    transition: "left 0.2s",
                    boxShadow: "var(--shadow-sm)",
                }}
            />
        </button>
    );
}

function NotificationRow({ label, description, value, onChange }: {
    label: string;
    description: string;
    value: boolean;
    onChange: () => void;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.875rem 0",
                borderBottom: "1px solid var(--gray-100)",
            }}
        >
            <div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--gray-800)" }}>{label}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--gray-400)", marginTop: 2 }}>{description}</div>
            </div>
            <Toggle value={value} onChange={onChange} />
        </div>
    );
}

function ProfileInput({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <div className="input-group">
            <label>{label}</label>
            <div className="input-field">
                <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
            </div>
        </div>
    );
}

export default function TeacherSettings() {
    const [activeTab, setActiveTab] = useState<Tab>("profile");
    const { showToast } = useToastStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile state
    const user = useCurrentUser("teacher");
    
    const [profile, setProfile] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        subject: "",
        department: "",
        homeroomClass: "",
        experience: "",
        country: "",
        cityState: "",
        postalCode: "",
        officeRoom: "",
    });

    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Hydrate profile correctly avoiding SSR mismatch
    useEffect(() => {
        if (user && user.email) {
            setProfile((prev) => ({
                ...prev,
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                subject: user.subject || "",
                department: user.department || "",
                homeroomClass: user.homeroomClass || "",
                experience: user.experience || "",
                country: user.country || "",
                cityState: user.cityState || "",
                postalCode: user.postalCode || "",
                officeRoom: user.officeRoom || "",
            }));
        }
    }, [user]);

    // Security state
    const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
    const [showPasswords, setShowPasswords] = useState({ current: false, newPass: false, confirm: false });
    const [storedPassword, setStoredPassword] = useState(DEFAULT_TEACHER_PASSWORD);
    const [twoFactor, setTwoFactor] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [twoFactorAction, setTwoFactorAction] = useState<TwoFactorAction | null>(null);
    const [twoFactorPendingCode, setTwoFactorPendingCode] = useState<string | null>(null);
    const [twoFactorCodeInput, setTwoFactorCodeInput] = useState("");
    const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState("");
    const [twoFactorCodeExpiresAt, setTwoFactorCodeExpiresAt] = useState<number | null>(null);

    // Notifications state
    const [notifications, setNotifications] = useState({
        newMessages: true,
        examSubmissions: true,
        attendanceReminders: true,
        announcements: true,
        parentMessages: true,
        systemUpdates: false,
        emailDigest: false,
        gradeAlerts: true,
    });

    // Appearance state
    const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
    const [language, setLanguage] = useState("en");
    const [compactMode, setCompactMode] = useState(false);
    
    const profileQuickStats = [
        { label: "Department", value: profile.department },
        { label: "Homeroom", value: profile.homeroomClass },
        { label: "Office", value: profile.officeRoom },
    ];
    const passwordIssues = useMemo(() => getPasswordIssues(storedPassword, passwords.newPass), [passwords.newPass, storedPassword]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TEACHER_SECURITY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<PersistedSecurity>;
            if (parsed.password && typeof parsed.password === "string") {
                setStoredPassword(parsed.password);
            }
            if (typeof parsed.twoFactorEnabled === "boolean") {
                setTwoFactor(parsed.twoFactorEnabled);
            }
            if (parsed.recoveryEmail && typeof parsed.recoveryEmail === "string") {
                setRecoveryEmail(parsed.recoveryEmail);
            }
        } catch {
            // Ignore
        }
    }, []);

    useEffect(() => {
        const payload: PersistedSecurity = {
            password: storedPassword,
            twoFactorEnabled: twoFactor,
            recoveryEmail,
        };
        window.localStorage.setItem(TEACHER_SECURITY_STORAGE_KEY, JSON.stringify(payload));
    }, [storedPassword, twoFactor, recoveryEmail]);

    async function handleSaveProfile() {
        if (!profile.firstName.trim() || !profile.email.trim()) {
            showToast("First name and email are required.", "error", false);
            return;
        }

        try {
            setLoading(true);
            await patchMe({
                phone: profile.phone?.trim(),
                experience: profile.experience?.trim(),
                officeRoom: profile.officeRoom?.trim(),
                country: profile.country?.trim(),
                cityState: profile.cityState?.trim(),
                postalCode: profile.postalCode?.trim(),
                department: profile.department?.trim(),
                homeroomClass: profile.homeroomClass?.trim(),
            });
            await refreshStoredProfile();
            showToast("Profile updated successfully!");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to update profile", "error", false);
        } finally {
            setLoading(false);
        }
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setAvatarUploading(true);
            const res = await uploadProfileImage(file);
            await patchMe({ profileImageFileId: res.id });
            await refreshStoredProfile();
            showToast("Profile photo updated successfully!");
        } catch (e) {
            showToast("Failed to upload photo.", "error", false);
        } finally {
            setAvatarUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleChangePassword() {
        if (!passwords.current || !passwords.newPass || !passwords.confirm) {
            showToast("Please fill in all password fields.", "error", false);
            return;
        }
        if (passwordIssues.length > 0) {
            showToast(`Password requirements not met: ${passwordIssues[0]}.`, "error", false);
            return;
        }
        if (passwords.newPass !== passwords.confirm) {
            showToast("New passwords do not match.", "error", false);
            return;
        }

        try {
            const apiBase = getApiBase();
            const { apiPath } = await import("@/lib/api");
            const res = await authFetch(`${apiBase}${apiPath.changePassword}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                showToast(data.message || "Current password is incorrect.", "error", false);
                return;
            }

            setPasswords({ current: "", newPass: "", confirm: "" });
            setShowPasswords({ current: false, newPass: false, confirm: false });
            showToast("Password changed successfully!");
        } catch {
            showToast("Failed to change password.", "error", false);
        }
    }

    function requestTwoFactorCode(action: TwoFactorAction) {
        if (action === "disable" && twoFactorDisablePassword !== storedPassword) {
            showToast("Enter your current password to disable 2FA.", "error", false);
            return;
        }
        if (action === "enable" && !recoveryEmail.trim()) {
            showToast("Enter a recovery email before enabling 2FA.", "error", false);
            return;
        }
        const code = generateCode();
        setTwoFactorAction(action);
        setTwoFactorPendingCode(code);
        setTwoFactorCodeExpiresAt(Date.now() + 5 * 60 * 1000);
        setTwoFactorCodeInput("");
        showToast(`Verification code: ${code} (valid for 5 minutes)`);
    }

    function verifyTwoFactorCode() {
        if (!twoFactorPendingCode || !twoFactorAction) {
            showToast("Request a verification code first.", "error", false);
            return;
        }
        if (!twoFactorCodeExpiresAt || Date.now() > twoFactorCodeExpiresAt) {
            setTwoFactorPendingCode(null);
            setTwoFactorCodeInput("");
            setTwoFactorAction(null);
            showToast("Verification code expired. Request a new one.", "error", false);
            return;
        }
        if (twoFactorCodeInput.trim() !== twoFactorPendingCode) {
            showToast("Invalid verification code.", "error", false);
            return;
        }

        const enabling = twoFactorAction === "enable";
        setTwoFactor(enabling);
        setTwoFactorPendingCode(null);
        setTwoFactorCodeInput("");
        setTwoFactorAction(null);
        setTwoFactorDisablePassword("");
        setTwoFactorCodeExpiresAt(null);
        showToast(enabling ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
    }

    function toggleNotif(key: keyof typeof notifications) {
        setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    function handleSaveAppearance() {
        showToast("Appearance preferences saved!");
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Manage your account preferences and configurations.</p>
                </div>
            </div>

            <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
                {/* Sidebar Tabs */}
                <div
                    className="card"
                    style={{ width: 220, flexShrink: 0, padding: "0.5rem", display: "flex", flexDirection: "column", gap: 2 }}
                >
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.625rem",
                                padding: "0.65rem 0.875rem",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.875rem",
                                fontWeight: activeTab === tab.key ? 600 : 500,
                                color: activeTab === tab.key ? "var(--primary-700)" : "var(--gray-600)",
                                background: activeTab === tab.key ? "var(--primary-50)" : "transparent",
                                border: "none",
                                cursor: "pointer",
                                transition: "all var(--transition-fast)",
                                textAlign: "left",
                                width: "100%",
                            }}
                        >
                            <span style={{ color: activeTab === tab.key ? "var(--primary-600)" : "var(--gray-400)" }}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>

                    {/* ── PROFILE TAB ── */}
                    {activeTab === "profile" && (
                        <>
                            <div className="card">
                                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.9fr)", gap: "1rem", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                                        <div style={{ position: "relative" }}>
                                            <AuthenticatedAvatar
                                                fileId={user.profileImageFileId}
                                                initials={`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`}
                                                size={80}
                                                alt={profile.firstName}
                                                style={{ border: "4px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                                            />
                                            {avatarUploading && (
                                                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <div style={{ width: 24, height: 24, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--gray-900)" }}>
                                                {profile.firstName} {profile.lastName}
                                            </h3>
                                            <p style={{ fontSize: "0.925rem", color: "var(--gray-500)", marginTop: "0.15rem" }}>
                                                {profile.subject ? `${profile.subject} Teacher` : "Teacher"}
                                            </p>
                                            <p style={{ fontSize: "0.875rem", color: "var(--gray-400)", marginTop: "0.2rem" }}>
                                                {profile.cityState}{profile.cityState && profile.country ? ", " : ""}{profile.country}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.65rem" }}>
                                            {profileQuickStats.map((item) => (
                                                <div key={item.label} style={{ padding: "0.75rem 0.85rem", border: "1px solid var(--gray-200)", background: "#fff", borderRadius: "var(--radius-md)" }}>
                                                    <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--gray-400)", textTransform: "uppercase" }}>{item.label}</div>
                                                    <div style={{ marginTop: "0.35rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--gray-800)" }}>{item.value || "—"}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
                                                {avatarUploading ? "Uploading..." : "Upload Photo"}
                                            </button>
                                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)", gap: "1rem", alignItems: "start" }}>
                                <div className="card">
                                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Personal Information</h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.85rem" }}>
                                        <ProfileInput label="First Name" value={profile.firstName} onChange={(value) => setProfile({ ...profile, firstName: value })} placeholder="First name" disabled={true} />
                                        <ProfileInput label="Last Name" value={profile.lastName} onChange={(value) => setProfile({ ...profile, lastName: value })} placeholder="Last name" disabled={true} />
                                        <ProfileInput label="Email Address" type="email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} placeholder="teacher@school.edu" disabled />
                                        <ProfileInput label="Phone no" value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} placeholder="+251 9XX XXX XXX" disabled={loading} />
                                        <ProfileInput label="Subject" value={profile.subject} onChange={(value) => setProfile({ ...profile, subject: value })} placeholder="Mathematics" disabled={true} />
                                        <ProfileInput label="Experience" value={profile.experience} onChange={(value) => setProfile({ ...profile, experience: value })} placeholder="Years of experience" disabled={loading} />
                                    </div>
                                </div>

                                <div className="card">
                                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>School Details</h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem" }}>
                                        <ProfileInput label="Department" value={profile.department} onChange={(value) => setProfile({ ...profile, department: value })} placeholder="Mathematics" disabled={loading} />
                                        <ProfileInput label="Homeroom Class" value={profile.homeroomClass} onChange={(value) => setProfile({ ...profile, homeroomClass: value })} placeholder="Grade 11-A" disabled={loading} />
                                        <ProfileInput label="Country" value={profile.country} onChange={(value) => setProfile({ ...profile, country: value })} placeholder="Country" disabled={loading} />
                                        <ProfileInput label="City / State" value={profile.cityState} onChange={(value) => setProfile({ ...profile, cityState: value })} placeholder="City / State" disabled={loading} />
                                        <ProfileInput label="Postal Code" value={profile.postalCode} onChange={(value) => setProfile({ ...profile, postalCode: value })} placeholder="Postal code" disabled={loading} />
                                        <ProfileInput label="Office Room" value={profile.officeRoom} onChange={(value) => setProfile({ ...profile, officeRoom: value })} placeholder="Office room" disabled={loading} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                                        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── SECURITY TAB ── */}
                    {activeTab === "security" && (
                        <>
                            {/* Same security content as before, but with global toasts */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Change Password</h3>
                                </div>
                                <p style={{ fontSize: "0.875rem", color: "var(--gray-500)", marginBottom: "1.25rem" }}>
                                    Use a strong password with at least 12 characters.
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {(
                                        [
                                            { key: "current", label: "Current Password" },
                                            { key: "newPass", label: "New Password" },
                                            { key: "confirm", label: "Confirm New Password" },
                                        ] as { key: keyof typeof passwords; label: string }[]
                                    ).map(({ key, label }) => (
                                        <div className="input-group" key={key}>
                                            <label>{label}</label>
                                            <div className="input-field">
                                                <input
                                                    type={showPasswords[key] ? "text" : "password"}
                                                    value={passwords[key]}
                                                    onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    onClick={() =>
                                                        setShowPasswords({ ...showPasswords, [key]: !showPasswords[key] })
                                                    }
                                                    style={{ color: "var(--gray-400)", cursor: "pointer", flexShrink: 0 }}
                                                >
                                                    {showPasswords[key] ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                            <line x1="1" y1="1" x2="23" y2="23" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ padding: "0.75rem 0.9rem", borderRadius: "var(--radius-md)", background: "var(--gray-50)", border: "1px solid var(--gray-200)", fontSize: "0.78rem" }}>
                                        <div style={{ fontWeight: 700, color: "var(--gray-600)", marginBottom: "0.4rem" }}>Requirements</div>
                                        <div style={{ color: passwordIssues.length === 0 && passwords.newPass ? "#065f46" : "var(--gray-500)" }}>
                                            {passwords.newPass
                                                ? (passwordIssues.length === 0 ? "Satisfied." : passwordIssues.join(" · "))
                                                : "Start typing."}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                                    <button className="btn btn-primary" onClick={handleChangePassword}>
                                        Update Password
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── NOTIFICATIONS TAB ── */}
                    {activeTab === "notifications" && (
                        <div className="card">
                            <h3 className="card-title">Notifications</h3>
                            <NotificationRow label="Exam Submissions" description="When a student submits." value={notifications.examSubmissions} onChange={() => toggleNotif("examSubmissions")} />
                            <NotificationRow label="New Messages" description="From students or admin." value={notifications.newMessages} onChange={() => toggleNotif("newMessages")} />
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                                <button className="btn btn-primary" onClick={() => showToast("Saved!")}>
                                    Save
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── APPEARANCE TAB ── */}
                    {activeTab === "appearance" && (
                        <div className="card">
                            <h3 className="card-title">Appearance</h3>
                            <div style={{ display: "grid", gap: "1rem" }}>
                                <div className="input-group">
                                    <label>Language</label>
                                    <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                                        <option value="en">English</option>
                                        <option value="am">Amharic</option>
                                    </Select>
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                                <button className="btn btn-primary" onClick={handleSaveAppearance}>
                                    Save Preferences
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
