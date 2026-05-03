"use client";
import { useState, useEffect, useCallback } from "react";
import {
    listFeedbackForTeacher,
    listMyFeedback,
    submitFeedback,
    type TeacherFeedbackItem,
} from "@/lib/admin-api";
import { PageHeader, ListSkeleton } from "@/components/ui";
import { MessageSquare } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
    teacher: "About Me",
    school: "To School Admin",
    general: "General",
};

function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString();
}

function statusBadge(status: string) {
    const map: Record<string, string> = { open: "badge-warning", in_progress: "badge-primary", resolved: "badge-success" };
    return <span className={`badge ${map[status] ?? ""}`}>{status.replace("_", " ")}</span>;
}

export default function TeacherFeedbackPage() {
    const [tab, setTab] = useState<"received" | "sent" | "submit">("received");
    const [received, setReceived] = useState<TeacherFeedbackItem[]>([]);
    const [sent, setSent] = useState<TeacherFeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    // Submit form
    const [category, setCategory] = useState("school");
    const [message, setMessage] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, s] = await Promise.all([
                listFeedbackForTeacher().catch(() => [] as TeacherFeedbackItem[]),
                listMyFeedback().catch(() => [] as TeacherFeedbackItem[]),
            ]);
            setReceived(r);
            setSent(s);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const handleSubmit = async () => {
        if (!message.trim()) { showToast("Write your message first", false); return; }
        setSubmitting(true);
        try {
            await submitFeedback({ category, message: message.trim(), isAnonymous });
            showToast("Feedback submitted");
            setMessage("");
            setIsAnonymous(false);
            await load();
            setTab("sent");
        } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="page-wrapper">
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 8, padding: "0.85rem 1.25rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, fontWeight: 600, fontSize: "0.9rem" }}>
                    {toast.msg}
                </div>
            )}

            <PageHeader
                kicker="Feedback"
                title="Feedback"
                subtitle="View feedback from students and submit feedback to school admin."
                icon={<MessageSquare size={22} />}
                variant="light"
            />

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: "1.5rem" }}>
                <button className={`tab ${tab === "received" ? "active" : ""}`} onClick={() => setTab("received")}>
                    Received ({received.length})
                </button>
                <button className={`tab ${tab === "sent" ? "active" : ""}`} onClick={() => setTab("sent")}>
                    Sent ({sent.length})
                </button>
                <button className={`tab ${tab === "submit" ? "active" : ""}`} onClick={() => setTab("submit")}>
                    Submit Feedback
                </button>
            </div>

            {loading ? (
                <ListSkeleton rows={4} />
            ) : (
                <>
                    {/* ── Received tab ── */}
                    {tab === "received" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {received.length === 0 ? (
                                <div style={{ background: "#fff", borderRadius: 20, padding: "4rem 2rem", textAlign: "center", border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gray-700)", marginBottom: "0.25rem" }}>No feedback received yet</div>
                                    <div style={{ fontSize: "0.875rem", color: "var(--gray-400)" }}>Students and parents can send you feedback anonymously.</div>
                                </div>
                            ) : received.map(f => (
                                <div key={f.id} className="card" style={{ padding: "1.25rem" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                                                {f.isAnonymous ? (
                                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-400)", background: "var(--gray-100)", padding: "0.2rem 0.6rem", borderRadius: 20, fontStyle: "italic" }}>
                                                        Anonymous {f.senderRole ?? ""}
                                                    </span>
                                                ) : f.sender ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--gray-900)" }}>
                                                            {f.sender.firstName} {f.sender.lastName}
                                                        </span>
                                                        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--primary-600)", background: "var(--primary-50)", padding: "0.15rem 0.5rem", borderRadius: 20 }}>
                                                            {f.sender.role}
                                                        </span>
                                                        {f.sender.email && (
                                                            <span style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>{f.sender.email}</span>
                                                        )}
                                                        {/* Show child name if sender is a parent */}
                                                        {(f.children?.length ?? 0) > 0 && (
                                                            <span style={{ fontSize: "0.72rem", color: "var(--gray-500)", background: "var(--gray-50)", padding: "0.15rem 0.5rem", borderRadius: 20, border: "1px solid var(--gray-200)" }}>
                                                                👶 {f.children!.map((c: any) => `${c.firstName} ${c.lastName}`).join(", ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", background: "var(--gray-100)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                                                        {f.senderRole ?? "unknown"}
                                                    </span>
                                                )}
                                                {statusBadge(f.status)}
                                            </div>
                                            <p style={{ fontSize: "0.95rem", color: "var(--gray-800)", lineHeight: 1.6, margin: 0 }}>{f.message}</p>
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", flexShrink: 0 }}>{timeAgo(f.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Sent tab ── */}
                    {tab === "sent" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {sent.length === 0 ? (
                                <div style={{ background: "#fff", borderRadius: 20, padding: "4rem 2rem", textAlign: "center", border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gray-700)", marginBottom: "0.25rem" }}>No feedback sent yet</div>
                                    <div style={{ fontSize: "0.875rem", color: "var(--gray-400)" }}>Use the "Submit Feedback" tab to send feedback to school admin.</div>
                                </div>
                            ) : sent.map(f => (
                                <div key={f.id} className="card" style={{ padding: "1.25rem" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary-600)", background: "var(--primary-50)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                                                    {CATEGORY_LABELS[f.category] ?? f.category}
                                                </span>
                                                {f.isAnonymous && <span style={{ fontSize: "0.72rem", color: "var(--gray-400)", fontStyle: "italic" }}>Sent anonymously</span>}
                                                {statusBadge(f.status)}
                                            </div>
                                            <p style={{ fontSize: "0.95rem", color: "var(--gray-800)", lineHeight: 1.6, margin: 0 }}>{f.message}</p>
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", flexShrink: 0 }}>{timeAgo(f.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Submit tab ── */}
                    {tab === "submit" && (
                        <div className="card" style={{ maxWidth: 640 }}>
                            <div className="card-header">
                                <h3 className="card-title">Submit Feedback to School Admin</h3>
                            </div>
                            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div className="input-group">
                                    <label>Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: "0.65rem 0.9rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.9rem", background: "#fff", width: "100%", fontFamily: "inherit" }}>
                                        <option value="school">Feedback to School Admin</option>
                                        <option value="general">General Feedback</option>
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label>Message *</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        rows={5}
                                        placeholder="Write your feedback here…"
                                        style={{ width: "100%", padding: "0.75rem 1rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                    />
                                </div>

                                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem", color: "var(--gray-700)" }}>
                                    <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} style={{ width: 16, height: 16 }} />
                                    Submit anonymously (your name will not be shown to admin)
                                </label>

                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                                    <button className="btn btn-secondary" onClick={() => { setMessage(""); setIsAnonymous(false); }}>Clear</button>
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !message.trim()} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        {submitting && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                                        {submitting ? "Submitting…" : "Submit Feedback"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
