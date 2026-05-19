"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, patchUser, uploadProfileImage, type PublicUser } from "@/lib/admin-api";
import { authFetch, getStoredUser, setStoredUser } from "@/lib/auth";
import { apiPath, getApiBase } from "@/lib/api";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";
import { useToastStore } from "@/store/toastStore";
import { PageHeader, PageHeaderSkeleton, CardSkeleton } from "@/components/ui";
import { UserCircle2, ShieldCheck, Mail, Phone, Lock, Edit3 } from "lucide-react";

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
    case "parent":
      return "Parent";
    default:
      return role;
  }
}

export default function AdminProfile() {
  const stored = getStoredUser();
  const [u, setU] = useState<PublicUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Form states
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  // Active focus trackers
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const uid = stored?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await getUser(uid);
        setU(row);
        setFirstName(row.firstName);
        setLastName(row.lastName);
        setPhone(row.phone ?? "");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [stored?.id]);

  const saveProfile = async () => {
    if (!stored?.id) return;
    setErr(null);
    try {
      const row = await patchUser(stored.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      setU(row);
      // Sync localStorage so the Header re-renders with the updated name
      const current = getStoredUser();
      if (current) {
        setStoredUser({
          ...current,
          firstName: row.firstName,
          lastName: row.lastName,
        });
      }
      showToast("Profile updated successfully", "success", true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErr(null);
    if (!curPwd) {
      setPwdErr("Enter your current password.");
      return;
    }
    if (!newPwd || newPwd.length < 8) {
      setPwdErr("New password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdErr("New passwords do not match.");
      return;
    }
    if (curPwd === newPwd) {
      setPwdErr("Choose a different new password.");
      return;
    }
    setPwdLoading(true);
    try {
      const r = await authFetch(`${getApiBase()}${apiPath.changePassword}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.message === "string" ? data.message : "Could not change password");
      
      showToast("Password updated successfully", "success", true);
      setCurPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      setPwdErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setPwdLoading(false);
    }
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!stored?.id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be 5MB or less.");
      return;
    }
    try {
      setAvatarUploading(true);
      const uploaded = await uploadProfileImage(file);
      const row = await patchUser(stored.id, { profileImageFileId: uploaded.id });
      setU(row);
      // Sync localStorage so Header avatar in the top-right corner updates immediately
      const current = getStoredUser();
      if (current) {
        setStoredUser({
          ...current,
          profileImageFileId: uploaded.id,
        });
      }
      showToast("Profile photo updated successfully", "success", true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Image upload failed");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  if (!stored?.id) {
    return (
      <div className="page-wrapper">
        <p style={{ color: "var(--gray-500)" }}>Not logged in.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <PageHeaderSkeleton />
        <div className="content-grid" style={{ alignItems: "start" }}>
          <CardSkeleton lines={6} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  }

  const initials = `${firstName[0] ?? "?"}${lastName[0] ?? ""}`.toUpperCase();
  const memberSince = u?.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

  // Premium, highly visible input fields styling tokens
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.88rem",
    fontWeight: 600,
    color: "var(--gray-700)",
    marginBottom: "0.45rem",
  };

  const inputStyle = (fieldName: string): React.CSSProperties => ({
    display: "block",
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "12px",
    border: focusedField === fieldName ? "1.5px solid var(--primary-500)" : "1.5px solid var(--gray-300)",
    backgroundColor: focusedField === fieldName ? "#fff" : "var(--gray-50)",
    fontSize: "0.95rem",
    outline: "none",
    color: "var(--gray-800)",
    boxShadow: focusedField === fieldName ? "0 0 0 3px var(--primary-50)" : "inset 0 1px 2px rgba(0,0,0,0.02)",
    transition: "all 0.2s ease-in-out",
  });

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="Account"
        title="Your profile"
        subtitle="Contact details and account security."
        icon={<UserCircle2 size={22} />}
        variant="light"
        actions={(
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            style={{ borderRadius: 12, padding: "0.65rem 1.5rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <ShieldCheck size={16} /> Save changes
          </button>
        )}
      />
      {err && (
        <div className="card" style={{ color: "var(--danger)", marginBottom: "1.5rem", background: "#fef2f2", border: "1.5px solid #fca5a5" }}>
          {err}
        </div>
      )}

      <div className="content-grid" style={{ alignItems: "start", gap: "1.5rem" }}>
        
        {/* Left Side: Summary Card */}
        <div
          className="card"
          style={{
            padding: "2.5rem 2rem",
            background: "linear-gradient(160deg, #f5f3ff 0%, #ffffff 40%, #f0fdf4 100%)",
            border: "1.5px solid #e9d5ff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Elegant Avatar with Dual ring Gradient and soft purple shadow */}
          <div style={{ position: "relative", width: 100, height: 100, marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #a78bfa, #818cf8)",
              padding: "3px",
              boxShadow: "0 6px 20px rgba(124, 58, 237, 0.25)",
            }}>
              <div style={{ background: "#fff", width: "100%", height: "100%", borderRadius: "50%", padding: "2px" }}>
                <AuthenticatedAvatar
                  fileId={u?.profileImageFileId}
                  initials={initials}
                  size={88}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <label style={{ display: "inline-flex", margin: "0 auto 1rem", cursor: avatarUploading ? "not-allowed" : "pointer" }}>
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarSelected}
                disabled={avatarUploading}
                style={{ display: "none" }}
              />
              <span className="btn btn-secondary btn-sm" style={{ borderRadius: 20, padding: "0.45rem 1.25rem", border: "1.5px solid var(--gray-200)", fontWeight: 600, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <Edit3 size={12} /> {avatarUploading ? "Uploading…" : "Change photo"}
              </span>
            </label>
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, textAlign: "center", margin: "0 0 0.35rem", color: "#0f172a" }}>
            {firstName} {lastName}
          </h2>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--gray-600)", fontSize: "0.9rem", textAlign: "center", marginBottom: "1rem" }}>
            <Mail size={14} />
            <span>{u?.email}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", width: "100%", borderTop: "1.5px dashed #e2e8f0", paddingTop: "1.25rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0.45rem 0.95rem",
                borderRadius: 999,
                background: "linear-gradient(135deg, #ede9fe, #dbeafe)",
                color: "#4c1d95",
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.08)",
                display: "inline-block",
              }}
            >
              {roleLabel(stored.role ?? "admin")}
            </span>
            {memberSince && (
              <span style={{ fontSize: "0.8rem", color: "var(--gray-500)", fontWeight: 500 }}>
                Member since {memberSince}
              </span>
            )}
          </div>
          
          <p style={{ fontSize: "0.85rem", color: "var(--gray-600)", marginTop: "1.5rem", textAlign: "center", lineHeight: 1.6, padding: "0 0.5rem" }}>
            This is the account you use to manage the school operations. Keep your login credentials private and secure.
          </p>
          
          <div style={{ marginTop: "1.5rem", width: "100%" }}>
            <Link
              href="/admin/settings"
              className="btn btn-secondary"
              style={{ width: "100%", textAlign: "center", borderRadius: 12, padding: "0.6rem 1rem", fontSize: "0.88rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              School &amp; display settings
            </Link>
          </div>
        </div>

        {/* Right Side: Contact & Security Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Contact Information Card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: "0.35rem", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Phone size={18} style={{ color: "var(--primary-500)" }} /> Contact information
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--gray-500)", marginBottom: "1.5rem" }}>Manage your first name, last name, and direct telephone number.</p>
            
            <div style={{ display: "grid", gap: "1.25rem", maxWidth: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label style={labelStyle}>
                  First name
                  <input
                    value={firstName}
                    placeholder="e.g. Abdallah"
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => setFocusedField("firstName")}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle("firstName")}
                  />
                </label>
                <label style={labelStyle}>
                  Last name
                  <input
                    value={lastName}
                    placeholder="e.g. Al-Farsi"
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => setFocusedField("lastName")}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle("lastName")}
                  />
                </label>
              </div>
              <label style={labelStyle}>
                Phone number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +251 91 234 5678"
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                  style={inputStyle("phone")}
                />
              </label>
            </div>
          </div>

          {/* Password Security Card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: "0.35rem", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Lock size={18} style={{ color: "var(--primary-500)" }} /> Password &amp; Security
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--gray-500)", marginBottom: "1.5rem" }}>Ensure your account uses a secure, strong password to prevent unauthorized access.</p>
            
            {pwdErr && (
              <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "var(--danger)", fontSize: "0.875rem", fontWeight: 500, marginBottom: "1rem" }}>
                {pwdErr}
              </div>
            )}
            
            <form onSubmit={changePassword} style={{ display: "grid", gap: "1.25rem", maxWidth: "100%" }}>
              <label style={labelStyle}>
                Current password
                <input
                  type="password"
                  value={curPwd}
                  placeholder="•••••••• (Current password)"
                  onChange={(e) => setCurPwd(e.target.value)}
                  autoComplete="current-password"
                  onFocus={() => setFocusedField("curPwd")}
                  onBlur={() => setFocusedField(null)}
                  style={inputStyle("curPwd")}
                />
              </label>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label style={labelStyle}>
                  New password
                  <input
                    type="password"
                    value={newPwd}
                    placeholder="•••••••• (Min. 8 chars)"
                    onChange={(e) => setNewPwd(e.target.value)}
                    autoComplete="new-password"
                    onFocus={() => setFocusedField("newPwd")}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle("newPwd")}
                  />
                </label>
                <label style={labelStyle}>
                  Confirm new password
                  <input
                    type="password"
                    value={confirmPwd}
                    placeholder="•••••••• (Confirm password)"
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    autoComplete="new-password"
                    onFocus={() => setFocusedField("confirmPwd")}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle("confirmPwd")}
                  />
                </label>
              </div>

              <div style={{ marginTop: "0.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={pwdLoading}
                  style={{ borderRadius: 12, padding: "0.65rem 1.5rem", fontWeight: 600 }}
                >
                  {pwdLoading ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
