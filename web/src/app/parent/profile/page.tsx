"use client";

import { useRef, useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";
import { useToastStore } from "@/store/toastStore";
import { patchMe, uploadProfileImage } from "@/lib/admin-api";
import { refreshStoredProfile } from "@/lib/auth";
import Select from "@/components/Select";

type ParentProfile = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    relationship: string;
    childName: string;
    childGrade: string;
    childSection: string;
    occupation: string;
    country: string;
    cityState: string;
    postalCode: string;
};

const defaultProfile: ParentProfile = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    relationship: "",
    childName: "",
    childGrade: "",
    childSection: "",
    occupation: "",
    country: "",
    cityState: "",
    postalCode: "",
};

function StaticField({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                border: "1px solid var(--gray-200)",
                background: "var(--gray-50)",
                borderRadius: "var(--radius-md)",
                padding: "0.8rem 0.95rem",
                minHeight: 68,
            }}
        >
            <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginBottom: "0.35rem", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.35 }}>{value || "—"}</div>
        </div>
    );
}

function EditableField({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    readOnly = false,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
    disabled?: boolean;
}) {
    return (
        <div className="input-group">
            <label>{label}</label>
            <div className="input-field">
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    disabled={disabled}
                    style={readOnly ? { background: "var(--gray-50)", cursor: "not-allowed" } : {}}
                />
            </div>
        </div>
    );
}

export default function ParentProfilePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<ParentProfile>(defaultProfile);
    const [draft, setDraft] = useState<ParentProfile>(defaultProfile);
    const [saving, setSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const { showToast } = useToastStore();
    const user = useCurrentUser("parent");

    useEffect(() => {
        if (user && user.email) {
            const next: ParentProfile = {
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                relationship: user.relationship || "",
                childName: user.childName || "",
                childGrade: user.grade || "",
                childSection: user.section || "",
                occupation: user.occupation || "",
                country: user.country || "",
                cityState: user.cityState || "",
                postalCode: user.postalCode || "",
            };
            setProfile(next);
            if (!isEditing) setDraft(next);
        }
    }, [user, isEditing]);

    const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
    const fullName = `${profile.firstName} ${profile.lastName}`;
    const quickStats = [
        { label: "Relationship", value: profile.relationship },
        { label: "Child", value: profile.childName },
        { label: "Grade", value: profile.childGrade },
    ];

    function startEditing() {
        setDraft(profile);
        setIsEditing(true);
    }

    function cancelEditing() {
        setDraft(profile);
        setIsEditing(false);
    }

    async function saveProfile() {
        if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
            showToast("First name, last name, and email are required.", "error", false);
            return;
        }

        try {
            setSaving(true);
            await patchMe(draft);
            await refreshStoredProfile();
            setProfile(draft);
            setIsEditing(false);
            showToast("Profile updated successfully");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to update profile", "error", false);
        } finally {
            setSaving(false);
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

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ marginBottom: "1rem" }}>
                <h1 className="page-title">My Profile</h1>
                {!isEditing ? (
                    <button className="btn btn-primary" onClick={startEditing}>Edit</button>
                ) : (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.9fr)", gap: "1rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                        <AuthenticatedAvatar
                            fileId={user.profileImageFileId}
                            initials={initials || "P"}
                            size={110}
                            alt={fullName || "User"}
                            style={{ border: "4px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        />

                        <div>
                            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--gray-900)" }}>{fullName}</h2>
                            <p style={{ color: "var(--gray-500)", fontSize: "0.95rem", marginTop: "0.2rem" }}>{profile.relationship} of {profile.childName}</p>
                            <p style={{ color: "var(--gray-400)", fontSize: "0.9rem", marginTop: "0.2rem" }}>{profile.cityState}{profile.cityState && profile.country ? ", " : ""}{profile.country}</p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "stretch" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.65rem" }}>
                            {quickStats.map((item) => (
                                <div key={item.label} style={{ padding: "0.75rem 0.85rem", border: "1px solid var(--gray-200)", background: "#fff", borderRadius: "var(--radius-md)" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--gray-400)", textTransform: "uppercase" }}>{item.label}</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--gray-800)" }}>{item.value || "—"}</div>
                                </div>
                            ))}
                        </div>

                        {isEditing && (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
                                    {avatarUploading ? "Uploading..." : "Upload Photo"}
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)", gap: "1rem", marginTop: "1rem", alignItems: "start" }}>
                <div className="card" style={{ marginTop: 0 }}>
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Personal Information</h3>
                    {!isEditing ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.8rem" }}>
                            {[
                                { label: "First Name", value: profile.firstName },
                                { label: "Last Name", value: profile.lastName },
                                { label: "Email Address", value: profile.email },
                                { label: "Phone no", value: profile.phone },
                                { label: "Occupation", value: profile.occupation },
                                { label: "Relationship", value: profile.relationship },
                            ].map((item) => (
                                <StaticField key={item.label} label={item.label} value={item.value} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.85rem" }}>
                            <EditableField label="First Name" value={draft.firstName} onChange={(value) => setDraft((prev) => ({ ...prev, firstName: value }))} placeholder="First name" disabled={saving} />
                            <EditableField label="Last Name" value={draft.lastName} onChange={(value) => setDraft((prev) => ({ ...prev, lastName: value }))} placeholder="Last name" disabled={saving} />
                            <EditableField label="Email Address" type="email" value={draft.email} onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))} placeholder="parent@email.com" disabled />
                            <EditableField label="Phone no" value={draft.phone} onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))} placeholder="+251 9XX XXX XXX" disabled={saving} />
                            <EditableField label="Occupation" value={draft.occupation} onChange={(value) => setDraft((prev) => ({ ...prev, occupation: value }))} placeholder="Occupation" disabled={saving} />
                            <div className="input-group">
                                <label>Relationship</label>
                                <Select
                                    value={draft.relationship}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, relationship: e.target.value }))}
                                    disabled={saving}
                                >
                                    <option value="">Select relationship</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Guardian">Guardian</option>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card" style={{ marginTop: 0 }}>
                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Location</h3>
                    {!isEditing ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.8rem" }}>
                            {[
                                { label: "Country", value: profile.country },
                                { label: "City/State", value: profile.cityState },
                                { label: "Postal Code", value: profile.postalCode },
                            ].map((item) => (
                                <StaticField key={item.label} label={item.label} value={item.value} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem" }}>
                            <EditableField label="Country" value={draft.country} onChange={(value) => setDraft((prev) => ({ ...prev, country: value }))} placeholder="Country" disabled={saving} />
                            <EditableField label="City/State" value={draft.cityState} onChange={(value) => setDraft((prev) => ({ ...prev, cityState: value }))} placeholder="City or State" disabled={saving} />
                            <EditableField label="Postal Code" value={draft.postalCode} onChange={(value) => setDraft((prev) => ({ ...prev, postalCode: value }))} placeholder="Postal code" disabled={saving} />
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ marginTop: "1rem" }}>
                <h3 className="card-title" style={{ marginBottom: "1rem" }}>Child Information (Read Only)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.8rem" }}>
                    <StaticField label="Child Name" value={profile.childName} />
                    <StaticField label="Grade" value={profile.childGrade} />
                    <StaticField label="Section" value={profile.childSection} />
                </div>
            </div>
        </div>
    );
}
