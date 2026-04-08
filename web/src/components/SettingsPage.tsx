"use client";

import { useEffect, useState } from "react";
import { authFetch, getStoredUser } from "@/lib/auth";
import { apiPath, getApiBase } from "@/lib/api";
import { useToastStore } from "@/store/toastStore";

export default function SettingsPage() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPwd, setShowCurrentPwd] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToastStore();
    const [errorMessage, setErrorMessage] = useState("");
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [sessionTimeout, setSessionTimeout] = useState(30);

    // Read the real logged-in user from localStorage
    const storedUser = getStoredUser();
    const user = {
        id: storedUser?.id ?? "—",
        name: storedUser ? `${storedUser.firstName} ${storedUser.lastName}`.trim() : "—",
        email: storedUser?.email ?? "—",
        role: storedUser?.role ?? "user",
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        if (!currentPassword) { setErrorMessage("Current password is required"); return; }
        if (!newPassword) { setErrorMessage("New password is required"); return; }
        if (newPassword.length < 8) { setErrorMessage("New password must be at least 8 characters"); return; }
        if (newPassword !== confirmPassword) { setErrorMessage("Passwords do not match"); return; }
        if (currentPassword === newPassword) { setErrorMessage("New password must be different from current password"); return; }

        setLoading(true);

        try {
            const apiBase = getApiBase();

            const response = await authFetch(`${apiBase}${apiPath.changePassword}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }

            showToast("Password changed successfully!", "success", true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTwoFactor = async () => {
        setTwoFactorEnabled(!twoFactorEnabled);
        showToast(
            twoFactorEnabled ? "Two-factor authentication disabled" : "Two-factor authentication enabled",
            "success",
            true
        );
    };


    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Account Settings</h1>
                    <p className="page-subtitle">Manage your password, security, and preferences</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 0.8fr)", gap: "1.5rem" }}>
                {/* Account Information */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Account Information</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600, marginBottom: "0.35rem" }}>
                                Name
                            </div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)" }}>{user.name}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600, marginBottom: "0.35rem" }}>
                                Email
                            </div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)" }}>{user.email}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600, marginBottom: "0.35rem" }}>
                                Role
                            </div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)" }}>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Quick Actions</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <button
                            className="btn btn-outline"
                            style={{ fontSize: "0.875rem" }}
                        >
                            View Activity Log
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ fontSize: "0.875rem" }}
                        >
                            Active Sessions
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => alert("Download account data")}
                            style={{ fontSize: "0.875rem" }}
                        >
                            Download Data
                        </button>
                    </div>
                </div>

                {/* Change Password */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Change Password</h3>



                    {errorMessage && (
                        <div style={{
                            padding: "0.75rem",
                            marginBottom: "1rem",
                            background: "#f8d7da",
                            border: "1px solid #f5c6cb",
                            borderRadius: "var(--radius-md)",
                            color: "#721c24",
                            fontSize: "0.875rem",
                        }}>
                            ✗ {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleChangePassword}>
                        <div className="input-group">
                            <label htmlFor="current-pwd">Current Password</label>
                            <div className="input-field">
                                <input
                                    id="current-pwd"
                                    type={showCurrentPwd ? "text" : "password"}
                                    placeholder="Enter current password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                                    style={{ color: "var(--gray-400)" }}
                                    disabled={loading}
                                >
                                    {showCurrentPwd ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                            <line x1="2" x2="22" y1="2" y2="22" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="new-pwd">New Password</label>
                            <div className="input-field">
                                <input
                                    id="new-pwd"
                                    type={showNewPwd ? "text" : "password"}
                                    placeholder="Enter new password (min 8 characters)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPwd(!showNewPwd)}
                                    style={{ color: "var(--gray-400)" }}
                                    disabled={loading}
                                >
                                    {showNewPwd ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                            <line x1="2" x2="22" y1="2" y2="22" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="confirm-pwd">Confirm Password</label>
                            <div className="input-field">
                                <input
                                    id="confirm-pwd"
                                    type={showConfirmPwd ? "text" : "password"}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                    style={{ color: "var(--gray-400)" }}
                                    disabled={loading}
                                >
                                    {showConfirmPwd ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                            <line x1="2" x2="22" y1="2" y2="22" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
                            {loading ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                                    </svg>
                                    Updating...
                                </span>
                            ) : "Update Password"}
                        </button>
                    </form>
                </div>

                {/* Security Settings */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Security</h3>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", marginBottom: "1rem", background: "var(--gray-50)", borderRadius: "var(--radius-md)" }}>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Two-Factor Authentication</div>
                            <div style={{ fontSize: "0.875rem", color: "var(--gray-500)" }}>
                                {twoFactorEnabled ? "Enabled" : "Disabled"}
                            </div>
                        </div>
                        <button
                            onClick={handleToggleTwoFactor}
                            className="btn btn-outline"
                            style={{ fontSize: "0.875rem" }}
                        >
                            {twoFactorEnabled ? "Disable" : "Enable"}
                        </button>
                    </div>

                    <div style={{ padding: "0.75rem", background: "var(--blue-50)", borderLeft: "3px solid var(--blue-500)", borderRadius: "var(--radius-md)" }}>
                        <div style={{ fontSize: "0.875rem", color: "var(--blue-700)", fontWeight: 500 }}>
                            ✓ Session timeout set to {sessionTimeout} minutes
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
