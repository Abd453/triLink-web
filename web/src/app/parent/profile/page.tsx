"use client";

import { useEffect, useRef, useState } from "react";
import Select from "@/components/Select";
import { useCurrentUser } from "@/lib/useCurrentUser";

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

const initialProfile: ParentProfile = {
    firstName: "Fatima",
    lastName: "Mohammed",
    email: "fatima.mohammed@email.com",
    phone: "+251 912 345 678",
    relationship: "Mother",
    childName: "Ahmed Mohammed",
    childGrade: "Grade 11",
    childSection: "A",
    occupation: "Teacher",
    country: "Ethiopia",
    cityState: "Addis Ababa",
    postalCode: "1000",
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
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.35 }}>{value}</div>
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
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
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
                    style={readOnly ? { background: "var(--gray-50)", cursor: "not-allowed" } : {}}
                />
            </div>
        </div>
    );
}

export default function ParentProfilePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<ParentProfile>(initialProfile);
    const [draft, setDraft] = useState<ParentProfile>(initialProfile);
    const user = useCurrentUser("parent");

    useEffect(() => {
        if (user && user.email) {
            const next = {
                ...profile,
                firstName: user.firstName || profile.firstName,
                lastName: user.lastName || profile.lastName,
                email: user.email || profile.email,
                relationship: user.relationship || profile.relationship,
                childName: user.childName || profile.childName,
                childGrade: user.grade || profile.childGrade,
                childSection: user.section || profile.childSection,
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

    function saveProfile() {
        if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
            window.alert("First name, last name, and email are required.");
            return;
        }

        // Call backend to save changes
        const updatePayload = {
            ...draft,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            occupation: draft.occupation.trim(),
            country: draft.country.trim(),
            cityState: draft.cityState.trim(),
            postalCode: draft.postalCode.trim(),
        };

        // TODO: Implement actual API call
        // fetch(`/api/parent/${profile.email}`, { method: "PUT", body: JSON.stringify(updatePayload) })

        setProfile(updatePayload);
        setIsEditing(false);
    }

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ marginBottom: "1rem" }}>
                <h1 className="page-title">My Profile</h1>
                {!isEditing ? (
                    <button className="btn btn-primary" onClick={startEditing}>Edit</button>
                ) : (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-secondary" onClick={cancelEditing}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveProfile}>Save Changes</button>
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.9fr)", gap: "1rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                        <div
                            className="avatar avatar-xl avatar-initials"
                            style={{ fontSize: "1.5rem", flexShrink: 0, background: "linear-gradient(135deg, #9333ea, #7e22ce)" }}
                        >
                            {initials || "P"}
                        </div>

                        <div>
                            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--gray-900)" }}>{fullName}</h2>
                            <p style={{ color: "var(--gray-500)", fontSize: "0.95rem", marginTop: "0.2rem" }}>{profile.relationship} of {profile.childName}</p>
                            <p style={{ color: "var(--gray-400)", fontSize: "0.9rem", marginTop: "0.2rem" }}>{profile.cityState}, {profile.country}</p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "stretch" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.65rem" }}>
                            {quickStats.map((item) => (
                                <div key={item.label} style={{ padding: "0.75rem 0.85rem", border: "1px solid var(--gray-200)", background: "#fff", borderRadius: "var(--radius-md)" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--gray-400)", textTransform: "uppercase" }}>{item.label}</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--gray-800)" }}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        {isEditing && (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                                    Upload Photo
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />
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
                            <EditableField label="First Name" value={draft.firstName} onChange={(value) => setDraft((prev) => ({ ...prev, firstName: value }))} placeholder="First name" />
                            <EditableField label="Last Name" value={draft.lastName} onChange={(value) => setDraft((prev) => ({ ...prev, lastName: value }))} placeholder="Last name" />
                            <EditableField label="Email Address" type="email" value={draft.email} onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))} placeholder="parent@email.com" />
                            <EditableField label="Phone no" value={draft.phone} onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))} placeholder="+251 9XX XXX XXX" />
                            <EditableField label="Occupation" value={draft.occupation} onChange={(value) => setDraft((prev) => ({ ...prev, occupation: value }))} placeholder="Occupation" />
                            <div className="input-group">
                                <label>Relationship</label>
                                <Select
                                    value={draft.relationship}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, relationship: e.target.value }))}
                                    style={{
                                        padding: "0.75rem",
                                        background: "var(--gray-50)",
                                        border: "1.5px solid var(--gray-200)",
                                        borderRadius: "var(--radius-md)",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <option>Father</option>
                                    <option>Mother</option>
                                    <option>Guardian</option>
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
                            <EditableField label="Country" value={draft.country} onChange={(value) => setDraft((prev) => ({ ...prev, country: value }))} placeholder="Country" />
                            <EditableField label="City/State" value={draft.cityState} onChange={(value) => setDraft((prev) => ({ ...prev, cityState: value }))} placeholder="City or State" />
                            <EditableField label="Postal Code" value={draft.postalCode} onChange={(value) => setDraft((prev) => ({ ...prev, postalCode: value }))} placeholder="Postal code" />
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
