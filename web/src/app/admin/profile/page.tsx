"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, patchUser, uploadProfileImage, type PublicUser } from "@/lib/admin-api";
import { authFetch, getStoredUser, setStoredUser } from "@/lib/auth";
import { apiPath, getApiBase } from "@/lib/api";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";
import { useToastStore } from "@/store/toastStore";

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

  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

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
      <div className="page-wrapper" style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "36px", height: "36px", border: "3px solid var(--gray-200)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ color: "var(--gray-500)", fontWeight: 500 }}>Loading profile...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const initials = `${firstName[0] ?? "?"}${lastName[0] ?? ""}`.toUpperCase();
  const memberSince = u?.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your profile</h1>
          <p className="page-subtitle">Contact details and account security</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveProfile}>
          Save changes
        </button>
      </div>
      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}

      <div className="content-grid" style={{ alignItems: "start" }}>
        <div
          className="card"
          style={{
            padding: "1.75rem",
            background: "linear-gradient(160deg, #f5f3ff 0%, #fff 45%, #eef2ff 100%)",
            border: "1px solid #e9d5ff",
          }}
        >
          <AuthenticatedAvatar
            fileId={u?.profileImageFileId}
            initials={initials}
            size={88}
            alt="Profile"
            style={{ margin: "0 auto 1rem", border: "3px solid #ddd6fe" }}
          />
          <div style={{ textAlign: "center" }}>
            <label style={{ display: "inline-flex", margin: "0 auto 0.75rem", cursor: avatarUploading ? "not-allowed" : "pointer" }}>
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarSelected}
                disabled={avatarUploading}
                style={{ display: "none" }}
              />
              <span className="btn btn-secondary btn-sm">{avatarUploading ? "Uploading…" : "Upload photo"}</span>
            </label>
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, textAlign: "center", margin: "0 0 0.35rem" }}>
            {firstName} {lastName}
          </h2>
          <p style={{ color: "var(--gray-600)", fontSize: "0.9rem", textAlign: "center", margin: "0 0 0.75rem" }}>{u?.email}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                background: "#ede9fe",
                color: "#5b21b6",
              }}
            >
              {roleLabel(stored.role ?? "admin")}
            </span>
            {memberSince && (
              <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>Member since {memberSince}</span>
            )}
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--gray-600)", marginTop: "1.25rem", textAlign: "center", lineHeight: 1.5 }}>
            This is the account you use to manage the school. Keep your password private and update your phone so staff can reach you if needed.
          </p>
          <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
            <Link href="/admin/settings" className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>
              School &amp; display settings
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: "1rem" }}>
              Contact information
            </h3>
            <div style={{ display: "grid", gap: "0.85rem", maxWidth: 420 }}>
              <label>
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251…" style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: "0.5rem" }}>
              Password
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--gray-600)", marginBottom: "1rem" }}>Use a strong password you do not use on other sites.</p>
            {pwdErr && <p style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{pwdErr}</p>}
            <form onSubmit={changePassword} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
              <label>
                Current password
                <input type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} autoComplete="current-password" style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
              <label>
                New password
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
              <label>
                Confirm new password
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" style={{ display: "block", width: "100%", marginTop: 6, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }} />
              </label>
              <button type="submit" className="btn btn-primary" disabled={pwdLoading}>
                {pwdLoading ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
