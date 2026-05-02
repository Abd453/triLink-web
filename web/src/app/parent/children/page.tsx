"use client";
import { useState, useEffect, useCallback } from "react";
import {
    myChildren,
    getChildUpcoming,
    type ChildUpcomingResponse,
    type ChildUpcomingExam,
    type ChildUpcomingAssignment,
} from "@/lib/admin-api";

function examStatusBadge(status: ChildUpcomingExam["status"]) {
    const map: Record<string, { label: string; cls: string }> = {
        upcoming:  { label: "Upcoming",  cls: "badge-warning" },
        available: { label: "Available", cls: "badge-success" },
        submitted: { label: "Submitted", cls: "badge-primary" },
        graded:    { label: "Graded",    cls: "badge-success" },
        missed:    { label: "Missed",    cls: "badge-danger"  },
    };
    const s = map[status] ?? { label: status, cls: "" };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function assignmentStatusBadge(status: ChildUpcomingAssignment["status"]) {
    const map: Record<string, { label: string; cls: string }> = {
        pending:   { label: "Pending",   cls: "badge-warning" },
        submitted: { label: "Submitted", cls: "badge-primary" },
        graded:    { label: "Graded",    cls: "badge-success" },
        overdue:   { label: "Overdue",   cls: "badge-danger"  },
    };
    const s = map[status] ?? { label: status, cls: "" };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function daysUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now();
    const d = Math.ceil(diff / 86400000);
    if (d < 0) return null;
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    return `${d}d left`;
}

export default function ParentChildrenPage() {
    const [children, setChildren] = useState<any[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [data, setData] = useState<ChildUpcomingResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [tab, setTab] = useState<"exams" | "assignments">("exams");

    const loadChildren = useCallback(async () => {
        setLoading(true);
        try {
            const list = await myChildren();
            setChildren(list);
            if (list.length > 0) setSelected(list[0].studentId);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    const loadData = useCallback(async (studentId: string) => {
        if (!studentId) return;
        setDataLoading(true);
        setData(null);
        try {
            const res = await getChildUpcoming(studentId);
            setData(res);
        } catch { /* ignore */ }
        finally { setDataLoading(false); }
    }, []);

    useEffect(() => { void loadChildren(); }, [loadChildren]);
    useEffect(() => { if (selected) void loadData(selected); }, [selected, loadData]);

    const selectedChild = children.find(c => c.studentId === selected);

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

            <div style={{ marginBottom: "1.5rem" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    My Children
                </h1>
                <p style={{ color: "var(--gray-500)", fontSize: "0.9rem" }}>Upcoming exams and assignments for your children</p>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
            ) : children.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--gray-400)", background: "#fff", borderRadius: 16, border: "1.5px dashed var(--gray-200)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👨‍👩‍👧</div>
                    <div style={{ fontWeight: 600 }}>No children linked</div>
                    <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Ask your school admin to link your account to your child.</div>
                </div>
            ) : (
                <>
                    {/* Child selector */}
                    {children.length > 1 && (
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                            {children.map(c => (
                                <button
                                    key={c.studentId}
                                    onClick={() => setSelected(c.studentId)}
                                    className={`btn ${selected === c.studentId ? "btn-primary" : "btn-secondary"}`}
                                    style={{ borderRadius: 20, padding: "0.5rem 1.25rem", fontSize: "0.88rem" }}
                                >
                                    {c.student?.firstName ?? "Child"} {c.student?.lastName ?? ""}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Summary cards */}
                    {data && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                            {[
                                { label: "Exams Total",       value: data.summary.examsTotal,           color: "var(--primary-600)" },
                                { label: "Upcoming Exams",    value: data.summary.examsUpcoming,         color: "#f59e0b" },
                                { label: "Missed Exams",      value: data.summary.examsMissed,           color: "var(--danger)" },
                                { label: "Assignments",       value: data.summary.assignmentsTotal,      color: "var(--primary-600)" },
                                { label: "Pending",           value: data.summary.assignmentsPending,    color: "#f59e0b" },
                                { label: "Overdue",           value: data.summary.assignmentsOverdue,    color: "var(--danger)" },
                            ].map(s => (
                                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "0.85rem 1rem", border: "1px solid var(--gray-200)", textAlign: "center" }}>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--gray-500)", fontWeight: 600, marginTop: "0.15rem" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="tabs" style={{ marginBottom: "1rem" }}>
                        <button className={`tab ${tab === "exams" ? "active" : ""}`} onClick={() => setTab("exams")}>
                            Exams {data ? `(${data.exams.length})` : ""}
                        </button>
                        <button className={`tab ${tab === "assignments" ? "active" : ""}`} onClick={() => setTab("assignments")}>
                            Assignments {data ? `(${data.assignments.length})` : ""}
                        </button>
                    </div>

                    {dataLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        </div>
                    ) : !data ? null : (
                        <>
                            {/* ── Exams ── */}
                            {tab === "exams" && (
                                data.exams.length === 0 ? (
                                    <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--gray-400)", background: "#fff", borderRadius: 12, border: "1.5px dashed var(--gray-200)" }}>
                                        No exams found for {data.student.firstName}.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {data.exams.map(exam => {
                                            const opens = new Date(exam.opensAt);
                                            const dl = daysUntil(exam.opensAt);
                                            return (
                                                <div key={exam.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--gray-200)", padding: "1rem 1.25rem", display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: exam.status === "missed" ? "var(--danger-light)" : exam.status === "graded" ? "#f0fdf4" : "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={exam.status === "missed" ? "var(--danger)" : exam.status === "graded" ? "var(--success)" : "var(--primary-500)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                                                            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>{exam.title}</span>
                                                            {examStatusBadge(exam.status)}
                                                        </div>
                                                        <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                                            {exam.subjectName && <span>{exam.subjectName}</span>}
                                                            {exam.gradeName && exam.sectionName && <span>{exam.gradeName} - {exam.sectionName}</span>}
                                                            <span>{opens.toLocaleDateString()} {opens.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                            <span>{exam.durationMinutes} min</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                        {exam.score != null ? (
                                                            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: (exam.score / exam.maxPoints) >= 0.8 ? "var(--success)" : (exam.score / exam.maxPoints) >= 0.6 ? "var(--warning)" : "var(--danger)" }}>
                                                                {exam.score}/{exam.maxPoints}
                                                            </div>
                                                        ) : dl ? (
                                                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: dl === "Today" || dl === "Tomorrow" ? "var(--warning)" : "var(--gray-500)" }}>{dl}</div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* ── Assignments ── */}
                            {tab === "assignments" && (
                                data.assignments.length === 0 ? (
                                    <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--gray-400)", background: "#fff", borderRadius: 12, border: "1.5px dashed var(--gray-200)" }}>
                                        No assignments found for {data.student.firstName}.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {data.assignments.map(asgn => {
                                            const deadline = new Date(asgn.deadline);
                                            const dl = daysUntil(asgn.deadline);
                                            return (
                                                <div key={asgn.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${asgn.status === "overdue" ? "var(--danger)" : "var(--gray-200)"}`, padding: "1rem 1.25rem", display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: asgn.status === "overdue" ? "var(--danger-light)" : asgn.status === "graded" ? "#f0fdf4" : "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={asgn.status === "overdue" ? "var(--danger)" : asgn.status === "graded" ? "var(--success)" : "var(--primary-500)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                                                            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>{asgn.title}</span>
                                                            {assignmentStatusBadge(asgn.status)}
                                                            <span className="badge" style={{ fontSize: "0.7rem", background: "var(--gray-100)", color: "var(--gray-500)" }}>{asgn.submissionType}</span>
                                                        </div>
                                                        {asgn.description && (
                                                            <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>{asgn.description}</div>
                                                        )}
                                                        <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                                            {asgn.subjectName && <span>{asgn.subjectName}</span>}
                                                            {asgn.gradeName && asgn.sectionName && <span>{asgn.gradeName} - {asgn.sectionName}</span>}
                                                            <span style={{ color: asgn.status === "overdue" ? "var(--danger)" : dl === "Today" || dl === "Tomorrow" ? "var(--warning)" : "var(--gray-500)", fontWeight: asgn.status === "overdue" ? 700 : 400 }}>
                                                                Due {deadline.toLocaleDateString()} {dl ? `(${dl})` : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                        {asgn.score != null ? (
                                                            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: (asgn.score / asgn.maxScore) >= 0.8 ? "var(--success)" : (asgn.score / asgn.maxScore) >= 0.6 ? "var(--warning)" : "var(--danger)" }}>
                                                                {asgn.score}/{asgn.maxScore}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
