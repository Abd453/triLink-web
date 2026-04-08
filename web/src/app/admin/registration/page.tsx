"use client";
import { useEffect, useState } from "react";
import {
    BookOpen,
    CheckCircle2,
    GraduationCap,
    MailCheck,
    ShieldCheck,
    Sparkles,
    Users,
    type LucideIcon,
} from "lucide-react";
import { apiPath, getApiBase } from "@/lib/api";
import { authFetch, getAccessToken } from "@/lib/auth";
import { listUsers, type PublicUser } from "@/lib/admin-api";
import Select from "@/components/Select";
import { useToastStore } from "@/store/toastStore";

type RegistrationType = "student" | "teacher" | "parent";

interface BaseFormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
}

interface StudentFormData extends BaseFormData {
    type: "student";
    grade: string;
    section: string;
}

interface TeacherFormData extends BaseFormData {
    type: "teacher";
    subject: string;
    department: string;
}

interface ParentFormData extends BaseFormData {
    type: "parent";
    /** Required — backend links parent to this student user id */
    linkedStudentId: string;
    relationship: string;
    /** Optional display label for emails */
    childName?: string;
}

type FormData = StudentFormData | TeacherFormData | ParentFormData;

interface FormErrors {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    grade?: string;
    section?: string;
    subject?: string;
    department?: string;
    childName?: string;
    linkedStudentId?: string;
    relationship?: string;
}

interface SuccessInfo {
    firstName: string;
    lastName: string;
    email: string;
    role: RegistrationType;
    tempPassword: string;
    /** From API: true when the server sent the welcome email via SMTP */
    registrationEmailSent: boolean;
}

const ROLE_META = {
    student: { icon: GraduationCap as LucideIcon, color: "#4f46e5", light: "#eef2ff", label: "Student" },
    teacher: { icon: BookOpen as LucideIcon, color: "#0891b2", light: "#ecfeff", label: "Teacher" },
    parent:  { icon: Users as LucideIcon, color: "#7c3aed", light: "#f5f3ff", label: "Parent" },
};

export default function AdminRegistration() {
    const [regType, setRegType] = useState<RegistrationType>("student");
    const [loading, setLoading] = useState(false);
    const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const { showToast } = useToastStore();
    const [emailStatus, setEmailStatus] = useState<"idle" | "sent" | "failed" | "skipped">("idle");
    const [studentOptions, setStudentOptions] = useState<PublicUser[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        grade: "Grade 9",
        section: "A",
        subject: "",
        department: "",
        childName: "",
        linkedStudentId: "",
        relationship: "Father",
    });

    useEffect(() => {
        if (regType !== "parent") return;
        let c = false;
        setLoadingStudents(true);
        (async () => {
            try {
                const studs = await listUsers("student");
                if (!c) {
                    setStudentOptions(studs);
                    setFormData((fd) => ({
                        ...fd,
                        linkedStudentId: fd.linkedStudentId || studs[0]?.id || "",
                    }));
                }
            } catch {
                if (!c) setStudentOptions([]);
            } finally {
                if (!c) setLoadingStudents(false);
            }
        })();
        return () => {
            c = true;
        };
    }, [regType]);

    const validateEmail = (email: string): boolean =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    /** Match API: strip spaces/dashes/parens, then 9–15 digits, optional leading + */
    const normalizePhone = (phone: string): string => phone.trim().replace(/[\s\-().]/g, "");

    const validatePhone = (phone: string): boolean => {
        const n = normalizePhone(phone);
        return /^\+?[1-9]\d{8,14}$/.test(n);
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
        if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
        if (!formData.email.trim()) newErrors.email = "Email is required";
        else if (!validateEmail(formData.email)) newErrors.email = "Invalid email format";
        if (!formData.phone.trim()) newErrors.phone = "Phone is required";
        else if (!validatePhone(formData.phone)) {
            newErrors.phone = "Invalid phone (use 9–15 digits, optional + country code)";
        }

        if (regType === "student") {
            if (!formData.grade) newErrors.grade = "Grade is required";
            if (!formData.section) newErrors.section = "Section is required";
        } else if (regType === "teacher") {
            if (!formData.subject.trim()) newErrors.subject = "Subject is required";
            if (!formData.department.trim()) newErrors.department = "Department is required";
        } else if (regType === "parent") {
            if (!formData.linkedStudentId) newErrors.linkedStudentId = "Select a student to link";
            if (!formData.relationship) newErrors.relationship = "Relationship is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const prepareSubmitData = (): FormData | null => {
        const baseData = {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: normalizePhone(formData.phone),
        };

        if (regType === "student") {
            return { type: "student", ...baseData, grade: formData.grade, section: formData.section } as StudentFormData;
        } else if (regType === "teacher") {
            return { type: "teacher", ...baseData, subject: formData.subject.trim(), department: formData.department.trim() } as TeacherFormData;
        } else if (regType === "parent") {
            const sel = studentOptions.find((s) => s.id === formData.linkedStudentId);
            const childName = sel ? `${sel.firstName} ${sel.lastName}`.trim() : undefined;
            return {
                type: "parent",
                ...baseData,
                linkedStudentId: formData.linkedStudentId,
                relationship: formData.relationship,
                childName,
            } as ParentFormData;
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessInfo(null);
        setErrorMessage("");
        setEmailStatus("idle");

        if (!validateForm()) {
            setErrorMessage("Please check the form for missing or invalid fields (e.g. Phone, Subject, etc.)");
            return;
        }

        setLoading(true);

        try {
            const submitData = prepareSubmitData();
            if (!submitData) throw new Error("Invalid form data");

            const registrationPayload: Record<string, unknown> = { ...submitData };

            const accessToken = getAccessToken();
            if (!accessToken) throw new Error("Admin session expired. Please log in again.");

            const response = await authFetch(`${getApiBase()}${apiPath.register}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(registrationPayload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Registration failed with status ${response.status}`);
            }

            const result = await response.json();
            const tempPwd: string = result.tempPassword ?? "—";
            const registrationEmailSent = Boolean(result.registrationEmailSent);

            const info: SuccessInfo = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                role: regType,
                tempPassword: tempPwd,
                registrationEmailSent,
            };

            setSuccessInfo(info);
            setEmailStatus(registrationEmailSent ? "sent" : "skipped");
            showToast(`${regType.charAt(0).toUpperCase() + regType.slice(1)} registered successfully!`, "success", true);

            // Reset form
            setFormData({
                firstName: "", lastName: "", email: "", phone: "",
                grade: "Grade 9", section: "A",
                subject: "", department: "",
                childName: "", linkedStudentId: studentOptions[0]?.id ?? "", relationship: "Father",
            });
            setErrors({});
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleTypeChange = (type: RegistrationType) => {
        setRegType(type);
        setErrors({});
        setSuccessInfo(null);
        setErrorMessage("");
        setEmailStatus("idle");
    };

    const meta = ROLE_META[regType];
    const RoleIcon = meta.icon;

    return (
        <div className="page-wrapper">
            <div className="registration-hero">
                <div>
                    <p className="registration-kicker">
                        <Sparkles size={14} />
                        Onboarding Studio
                    </p>
                    <h1 className="registration-title">Registration</h1>
                    <p className="registration-subtitle">Register students, teachers, and parents with role-specific data</p>
                </div>
                <div className="admin-dash-pill">
                    <ShieldCheck size={15} />
                    Admin-only flow
                </div>
            </div>

            {/* Role tabs */}
            <div className="registration-role-tabs">
                {(["student", "teacher", "parent"] as const).map(t => (
                    <button
                        key={t}
                        className={`registration-role-tab ${regType === t ? "active" : ""}`}
                        onClick={() => handleTypeChange(t)}
                        disabled={loading}
                    >
                        {(() => {
                            const Icon = ROLE_META[t].icon;
                            return <Icon size={16} />;
                        })()}
                        {ROLE_META[t].label}
                    </button>
                ))}
            </div>

            {/* ── Success Card ── */}
            {successInfo && (
                <div style={{
                    marginBottom: "1.5rem",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                    border: `1.5px solid ${ROLE_META[successInfo.role].color}33`,
                    background: "#fff",
                }}>
                    {/* Card header */}
                    <div style={{
                        background: `linear-gradient(135deg, ${ROLE_META[successInfo.role].color}, ${ROLE_META[successInfo.role].color}cc)`,
                        padding: "20px 28px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: "50%",
                            background: "rgba(255,255,255,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff",
                        }}>
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                                Registration Successful
                            </p>
                            <p style={{ margin: "2px 0 0", color: "#fff", fontSize: 20, fontWeight: 800 }}>
                                {successInfo.firstName} {successInfo.lastName}
                            </p>
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 40 }}>
                            {(() => {
                                const SuccessIcon = ROLE_META[successInfo.role].icon;
                                return <SuccessIcon size={36} color="#fff" />;
                            })()}
                        </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "24px 28px" }}>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px",
                            marginBottom: "20px",
                        }}>
                            <InfoRow label="Email" value={successInfo.email} />
                            <InfoRow label="Role" value={
                                <span style={{
                                    background: ROLE_META[successInfo.role].light,
                                    color: ROLE_META[successInfo.role].color,
                                    padding: "2px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                                }}>{ROLE_META[successInfo.role].label}</span>
                            } />
                        </div>

                        {/* Credentials box */}
                        <div style={{
                            background: `linear-gradient(135deg, ${ROLE_META[successInfo.role].color}10, ${ROLE_META[successInfo.role].color}05)`,
                            border: `2px dashed ${ROLE_META[successInfo.role].color}44`,
                            borderRadius: 12,
                            padding: "18px 22px",
                            marginBottom: "16px",
                        }}>
                            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>
                                Temporary Password
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <code style={{
                                    fontSize: 26, fontWeight: 800, letterSpacing: 6,
                                    color: ROLE_META[successInfo.role].color,
                                    background: "#fff",
                                    padding: "8px 20px", borderRadius: 8,
                                    border: `1.5px solid ${ROLE_META[successInfo.role].color}30`,
                                    fontFamily: "monospace",
                                }}>
                                    {successInfo.tempPassword}
                                </code>
                                <button
                                    onClick={() => navigator.clipboard.writeText(successInfo.tempPassword)}
                                    title="Copy password"
                                    style={{
                                        padding: "8px 14px", borderRadius: 8,
                                        background: ROLE_META[successInfo.role].light,
                                        color: ROLE_META[successInfo.role].color,
                                        border: `1px solid ${ROLE_META[successInfo.role].color}33`,
                                        cursor: "pointer", fontWeight: 600, fontSize: 13,
                                    }}
                                >
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <MailCheck size={14} />
                                        Copy
                                    </span>
                                </button>
                            </div>
                            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#92400e", background: "#fffbeb", padding: "8px 12px", borderRadius: 6, border: "1px solid #fde68a" }}>
                                ⚠️ The user must change this password on first login.
                            </p>
                        </div>

                        {/* Email status */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 16px", borderRadius: 10,
                            background:
                                emailStatus === "sent"
                                    ? "#f0fdf4"
                                    : emailStatus === "failed"
                                      ? "#fff5f5"
                                      : emailStatus === "skipped"
                                        ? "#fffbeb"
                                        : "#f8fafc",
                            border: `1px solid ${
                                emailStatus === "sent"
                                    ? "#86efac"
                                    : emailStatus === "failed"
                                      ? "#fca5a5"
                                      : emailStatus === "skipped"
                                        ? "#fcd34d"
                                        : "#e2e8f0"
                            }`,
                        }}>
                            {emailStatus === "sent" && (
                                <>
                                    <span style={{ fontSize: 18 }}>✅</span>
                                    <span style={{ fontSize: 14, color: "#166534" }}>Confirmation email sent to <strong>{successInfo.email}</strong></span>
                                </>
                            )}
                            {emailStatus === "failed" && (
                                <>
                                    <span style={{ fontSize: 18 }}>⚠️</span>
                                    <span style={{ fontSize: 14, color: "#991b1b" }}>Email delivery failed — check SMTP settings in <code>.env.local</code></span>
                                </>
                            )}
                            {emailStatus === "skipped" && (
                                <>
                                    <span style={{ fontSize: 18 }}>ℹ️</span>
                                    <span style={{ fontSize: 14, color: "#92400e" }}>
                                        No email was sent — configure <code>SMTP_HOST</code> (and related vars) on the <strong>API server</strong> so new users receive their temporary password by email.
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Error message */}
            {errorMessage && (
                <div style={{
                    padding: "1rem", marginBottom: "1rem",
                    background: "#fff5f5", border: "1px solid #fca5a5",
                    borderRadius: "var(--radius-md)", color: "#991b1b",
                }}>
                    {errorMessage}
                </div>
            )}

            {/* ── Form ── */}
            <div className="card registration-form-card">
                <h3 className="card-title registration-form-title" style={{ marginBottom: "1.25rem" }}>
                    <RoleIcon size={18} /> Register New {meta.label}
                </h3>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                        <div className="input-group">
                            <label htmlFor="firstName">First Name <span style={{ color: "var(--red-500)" }}>*</span></label>
                            <div className="input-field">
                                <input
                                    id="firstName"
                                    placeholder="First name"
                                    value={formData.firstName}
                                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                                    disabled={loading}
                                    style={errors.firstName ? { borderColor: "var(--red-500)" } : {}}
                                />
                            </div>
                            {errors.firstName && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.firstName}</p>}
                        </div>

                        <div className="input-group">
                            <label htmlFor="lastName">Last Name <span style={{ color: "var(--red-500)" }}>*</span></label>
                            <div className="input-field">
                                <input
                                    id="lastName"
                                    placeholder="Last name"
                                    value={formData.lastName}
                                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                                    disabled={loading}
                                    style={errors.lastName ? { borderColor: "var(--red-500)" } : {}}
                                />
                            </div>
                            {errors.lastName && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.lastName}</p>}
                        </div>

                        <div className="input-group">
                            <label htmlFor="email">Email <span style={{ color: "var(--red-500)" }}>*</span></label>
                            <div className="input-field">
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="email@school.edu"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange("email", e.target.value)}
                                    disabled={loading}
                                    style={errors.email ? { borderColor: "var(--red-500)" } : {}}
                                />
                            </div>
                            {errors.email && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.email}</p>}
                        </div>

                        <div className="input-group">
                            <label htmlFor="phone">Phone <span style={{ color: "var(--red-500)" }}>*</span></label>
                            <div className="input-field">
                                <input
                                    id="phone"
                                    placeholder="+251 ..."
                                    value={formData.phone}
                                    onChange={(e) => handleInputChange("phone", e.target.value)}
                                    disabled={loading}
                                    style={errors.phone ? { borderColor: "var(--red-500)" } : {}}
                                />
                            </div>
                            {errors.phone && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.phone}</p>}
                        </div>

                        {regType === "student" && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="grade">Grade <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <Select
                                        id="grade"
                                        value={formData.grade}
                                        onChange={(e) => handleInputChange("grade", e.target.value)}
                                        disabled={loading}
                                        style={{
                                            padding: "0.75rem",
                                            background: "var(--primary-50)",
                                            color: "var(--primary-800)",
                                            border: `1.5px solid ${errors.grade ? "var(--red-500)" : "var(--primary-200)"}`,
                                            borderRadius: "20px",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        <option>Grade 9</option>
                                        <option>Grade 10</option>
                                        <option>Grade 11</option>
                                        <option>Grade 12</option>
                                    </Select>
                                    {errors.grade && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.grade}</p>}
                                </div>

                                <div className="input-group">
                                    <label htmlFor="section">Section <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <Select
                                        id="section"
                                        value={formData.section}
                                        onChange={(e) => handleInputChange("section", e.target.value)}
                                        disabled={loading}
                                        style={{
                                            padding: "0.75rem",
                                            background: "var(--primary-50)",
                                            color: "var(--primary-800)",
                                            border: `1.5px solid ${errors.section ? "var(--red-500)" : "var(--primary-200)"}`,
                                            borderRadius: "20px",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        <option>A</option>
                                        <option>B</option>
                                        <option>C</option>
                                    </Select>
                                    {errors.section && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.section}</p>}
                                </div>
                            </>
                        )}

                        {regType === "teacher" && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="subject">Subject <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <div className="input-field">
                                        <input
                                            id="subject"
                                            placeholder="Mathematics"
                                            value={formData.subject}
                                            onChange={(e) => handleInputChange("subject", e.target.value)}
                                            disabled={loading}
                                            style={errors.subject ? { borderColor: "var(--red-500)" } : {}}
                                        />
                                    </div>
                                    {errors.subject && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.subject}</p>}
                                </div>

                                <div className="input-group">
                                    <label htmlFor="department">Department <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <div className="input-field">
                                        <input
                                            id="department"
                                            placeholder="Science"
                                            value={formData.department}
                                            onChange={(e) => handleInputChange("department", e.target.value)}
                                            disabled={loading}
                                            style={errors.department ? { borderColor: "var(--red-500)" } : {}}
                                        />
                                    </div>
                                    {errors.department && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.department}</p>}
                                </div>
                            </>
                        )}

                        {regType === "parent" && (
                            <>
                                <div className="input-group">
                                    <label htmlFor="linkedStudentId">Link to student <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <Select
                                        id="linkedStudentId"
                                        value={formData.linkedStudentId}
                                        onChange={(e) => handleInputChange("linkedStudentId", e.target.value)}
                                        disabled={loading || loadingStudents || studentOptions.length === 0}
                                        style={{
                                            padding: "0.75rem",
                                            width: "100%",
                                            background: "var(--primary-50)",
                                            color: "var(--primary-800)",
                                            border: `1.5px solid ${errors.linkedStudentId ? "var(--red-500)" : "var(--primary-200)"}`,
                                            borderRadius: "20px",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        {loadingStudents ? (
                                            <option value="">Loading students…</option>
                                        ) : studentOptions.length === 0 ? (
                                            <option value="">No students — register a student first</option>
                                        ) : (
                                            studentOptions.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.firstName} {s.lastName} · {s.email}
                                                </option>
                                            ))
                                        )}
                                    </Select>
                                    {errors.linkedStudentId && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.linkedStudentId}</p>}
                                    <p style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: "0.35rem" }}>
                                        Backend requires a student UUID (<code>linkedStudentId</code>), not name-only matching.
                                    </p>
                                </div>

                                <div className="input-group">
                                    <label htmlFor="relationship">Relationship <span style={{ color: "var(--red-500)" }}>*</span></label>
                                    <Select
                                        id="relationship"
                                        value={formData.relationship}
                                        onChange={(e) => handleInputChange("relationship", e.target.value)}
                                        disabled={loading}
                                        style={{
                                            padding: "0.75rem",
                                            background: "var(--primary-50)",
                                            color: "var(--primary-800)",
                                            border: `1.5px solid ${errors.relationship ? "var(--red-500)" : "var(--primary-200)"}`,
                                            borderRadius: "20px",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        <option>Father</option>
                                        <option>Mother</option>
                                        <option>Guardian</option>
                                    </Select>
                                    {errors.relationship && <p style={{ color: "var(--red-500)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{errors.relationship}</p>}
                                </div>
                            </>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 180 }}>
                        {loading ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                                </svg>
                                Registering…
                            </span>
                        ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <RoleIcon size={16} />
                                Register {meta.label}
                            </span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{
            padding: "10px 14px",
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
        }}>
            <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</p>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{value}</div>
        </div>
    );
}
