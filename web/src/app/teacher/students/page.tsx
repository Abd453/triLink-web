"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Select from "@/components/Select";
import {
    getActiveAcademicYear,
    listMyClassOfferings,
    listEnrollments,
    listUsers,
    listExams,
    listExamAttempts,
    classAttendanceReport,
    listGradesForStudent,
    type ClassOffering,
    type PublicUser,
    type Exam,
    type GradeEntry,
} from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { filterOfferingsBySubject } from "@/lib/teacher-utils";
import { cachedFetch } from "@/lib/cache";

type StudentRow = {
    id: string;
    name: string;
    email: string;
    offeringLabel: string;
    subjects: { name: string; score: number | null; attendance: number }[];
    avg: number;
    attendance: number;
};

function offeringLabel(o: ClassOffering) {
    const g = o.gradeName || (o as any).grade?.name || "";
    const s = o.sectionName || (o as any).section?.name || "";
    if (g && s) return `${g} - ${s}`;
    return o.displayName || o.name?.trim() || `Class ${o.id.slice(0, 8)}`;
}

function TeacherStudentsSkeleton() {
    return (
        <div className="page-wrapper">
            <div className="page-header admin-dash-skeleton-block">
                <div style={{ width: "100%", maxWidth: 380 }}>
                    <div className="admin-skeleton shimmer" style={{ width: 120, height: 12, marginBottom: 12 }} />
                    <div className="admin-skeleton shimmer" style={{ width: "55%", height: 28, marginBottom: 8 }} />
                    <div className="admin-skeleton shimmer" style={{ width: "70%", height: 12 }} />
                </div>
            </div>
            <div className="card admin-dash-skeleton-block">
                <div className="admin-skeleton shimmer" style={{ width: "100%", height: 320, borderRadius: 12 }} />
            </div>
        </div>
    );
}

export default function TeacherStudents() {
    const user = useCurrentUser("teacher");
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [selectedOffering, setSelectedOffering] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentGrades, setStudentGrades] = useState<GradeEntry[]>([]);
    const [gradesLoading, setGradesLoading] = useState(false);
    const [detailTab, setDetailTab] = useState<"exams" | "grades">("grades");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const loadOfferings = useCallback(async () => {
        if (!isClient) return;
        setLoading(true);
        setErr(null);
        try {
            const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
            if (!year) { setErr("No active academic year"); return; }
            const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000);
            const scoped = filterOfferingsBySubject(mine, user?.subject);
            setOfferings(scoped);
            setSelectedOffering((prev) => (prev && scoped.some((o) => o.id === prev) ? prev : scoped[0]?.id ?? ""));
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [isClient, user?.subject]);

    useEffect(() => {
        loadOfferings();
    }, [loadOfferings]);

    // Load students for selected offering
    useEffect(() => {
        if (!isClient || !selectedOffering) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
                if (!year || cancelled) return;
                const offering = offerings.find(o => o.id === selectedOffering);
                if (!offering) return;

                // Fetch enrollments, users, exams, and attendance in parallel
                const [enrollments, allUsers, exams, attendanceReport] = await Promise.all([
                    cachedFetch(`enroll:${selectedOffering}:${year.id}`, () => listEnrollments({ classOfferingId: selectedOffering, academicYearId: year.id }), 60_000),
                    cachedFetch("students:all", () => listUsers("student"), 120_000),
                    cachedFetch(`exams:${year.id}`, () => listExams(year.id), 30_000),
                    cachedFetch(`attendance:${selectedOffering}`, () => classAttendanceReport(selectedOffering), 30_000).catch(() => null),
                ]);
                if (cancelled) return;

                const userMap = new Map<string, PublicUser>(allUsers.map(u => [u.id, u]));
                const classExams = exams.filter(ex => ex.classOfferingId === selectedOffering && ex.published);

                // Fetch all exam attempts in parallel
                const attemptsByExam: Record<string, Record<string, { score: number | null }>> = {};
                const attemptResults = await Promise.all(
                    classExams.map(ex =>
                        cachedFetch(`attempts:${ex.id}`, () => listExamAttempts(ex.id), 20_000)
                            .then(res => ({ examId: ex.id, attempts: res?.attempts ?? [] }))
                            .catch(() => ({ examId: ex.id, attempts: [] }))
                    )
                );
                for (const { examId, attempts } of attemptResults) {
                    const map: Record<string, { score: number | null }> = {};
                    for (const a of attempts) map[a.studentId] = { score: a.score };
                    attemptsByExam[examId] = map;
                }

                // Build attendance map
                let attendanceMap: Record<string, { present: number; total: number }> = {};
                try {
                    if (attendanceReport?.sessions) {
                        for (const session of attendanceReport.sessions) {
                            for (const mark of session.marks ?? []) {
                                if (!attendanceMap[mark.studentId]) attendanceMap[mark.studentId] = { present: 0, total: 0 };
                                attendanceMap[mark.studentId].total++;
                                if (mark.status === "present") attendanceMap[mark.studentId].present++;
                            }
                        }
                    }
                } catch { /* ignore */ }

                if (cancelled) return;

                const rows: StudentRow[] = enrollments.map(e => {
                    const u = userMap.get(e.studentId);
                    const att = attendanceMap[e.studentId];
                    const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
                    const subjects = classExams.map(ex => {
                        const attempt = attemptsByExam[ex.id]?.[e.studentId];
                        const subj = (offering as any).subjectName || (offering as any).subject?.name || "Subject";
                        return { name: subj, score: attempt?.score ?? null, attendance: attPct };
                    });
                    const scores = subjects.map(s => s.score).filter((s): s is number => s != null);
                    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                    return {
                        id: e.studentId,
                        name: u ? `${u.firstName} ${u.lastName}` : e.studentId.slice(0, 8),
                        email: u?.email ?? "",
                        offeringLabel: offeringLabel(offering),
                        subjects,
                        avg,
                        attendance: attPct,
                    };
                });
                if (!cancelled) setStudents(rows);
            } catch (e) {
                if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load students");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedOffering, offerings]);

    // Sort by avg descending to compute rank
    const rankedStudents = useMemo(() => {
        const sorted = [...students].sort((a, b) => b.avg - a.avg);
        return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
    }, [students]);

    const selected = useMemo(() => rankedStudents.find(s => s.id === selectedStudentId), [rankedStudents, selectedStudentId]);

    if (!isClient || loading) {
        return <TeacherStudentsSkeleton />;
    }

    if (err) {
        return (
            <div className="page-wrapper">
                <div className="page-header"><div><h1 className="page-title">Students</h1></div></div>
                <div className="card" style={{ color: "var(--danger)", padding: "2rem" }}>{err}</div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ marginBottom: "0.75rem" }}>
                <div>
                    <h1 className="page-title">Students</h1>
                    <p className="page-subtitle">Student analytics per class</p>
                </div>
            </div>

            {/* Class Tabs (Buttons instead of dropdown) */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {offerings.map(c => (
                    <button
                        key={c.id}
                        className={`btn ${selectedOffering === c.id ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setSelectedOffering(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.25rem", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600 }}
                    >
                        {offeringLabel(c)}
                    </button>
                ))}
                {offerings.length === 0 && !loading && (
                    <div style={{ fontSize: "0.85rem", color: "var(--gray-500)", background: "var(--gray-50)", padding: "0.75rem 1.25rem", borderRadius: 12, border: "1.5px dashed var(--gray-200)" }}>
                        No classes found for your subject ({user?.subject || "—"})
                    </div>
                )}
            </div>

            {rankedStudents.length === 0 && !loading ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--gray-400)" }}>
                    <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--gray-500)", marginBottom: "0.25rem" }}>No students enrolled</div>
                    <div style={{ fontSize: "0.85rem" }}>Students will appear once enrolled by the admin.</div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0,1fr) minmax(0,1.5fr)" : "1fr", gap: "1.25rem" }}>
                    <div className="card">
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Student</th><th>Avg</th><th>Attendance</th><th>Rank</th></tr></thead>
                                <tbody>
                                    {rankedStudents.map(s => (
                                        <tr key={s.id} onClick={() => {
                                            setSelectedStudentId(s.id);
                                            setDetailTab("grades");
                                            setGradesLoading(true);
                                            listGradesForStudent(s.id)
                                                .then(g => setStudentGrades(g))
                                                .catch(() => setStudentGrades([]))
                                                .finally(() => setGradesLoading(false));
                                        }} style={{ cursor: "pointer", background: selectedStudentId === s.id ? "var(--primary-50)" : undefined }}>
                                            <td style={{ fontWeight: 600 }}>
                                                {s.name}<br />
                                                <span style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>{s.email}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${s.avg >= 90 ? "badge-success" : s.avg >= 80 ? "badge-primary" : s.avg >= 60 ? "badge-warning" : "badge-danger"}`}>
                                                    {s.avg > 0 ? `${s.avg}%` : "-"}
                                                </span>
                                            </td>
                                            <td>{s.attendance}%</td>
                                            <td>#{s.rank}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                                        {selected && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {/* ── Student header ── */}
                            <div className="card">
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                                    <div className="avatar avatar-initials avatar-lg" style={{ fontSize: "1rem", flexShrink: 0 }}>
                                        {selected.name.split(" ").map((n: string) => n[0]).join("")}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</h3>
                                        <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", margin: "0.1rem 0 0" }}>{selected.offeringLabel} · Rank #{selected.rank}</p>
                                        <p style={{ fontSize: "0.72rem", color: "var(--gray-400)", margin: 0 }}>{selected.email}</p>
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
                                    {[
                                        { label: "Avg Score", value: selected.avg > 0 ? `${selected.avg}%` : "—", color: selected.avg >= 80 ? "var(--success)" : selected.avg >= 60 ? "var(--primary-600)" : "var(--warning)" },
                                        { label: "Attendance", value: `${selected.attendance}%`, color: selected.attendance >= 80 ? "var(--success)" : selected.attendance >= 60 ? "var(--warning)" : "var(--danger)" },
                                        { label: "Rank", value: `#${selected.rank}`, color: "var(--gray-700)" },
                                    ].map(stat => (
                                        <div key={stat.label} style={{ background: "var(--gray-50)", borderRadius: 8, padding: "0.6rem 0.75rem", textAlign: "center" }}>
                                            <div style={{ fontSize: "0.68rem", color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{stat.label}</div>
                                            <div style={{ fontWeight: 800, fontSize: "1rem", color: stat.color }}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tabs */}
                                <div className="tabs" style={{ marginBottom: "1rem" }}>
                                    <button className={`tab ${detailTab === "grades" ? "active" : ""}`} onClick={() => setDetailTab("grades")}>Grades</button>
                                    <button className={`tab ${detailTab === "exams" ? "active" : ""}`} onClick={() => setDetailTab("exams")}>Exams</button>
                                </div>

                                {/* ── Grades tab ── */}
                                {detailTab === "grades" && (
                                    gradesLoading ? (
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", gap: "0.5rem", color: "var(--gray-400)" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                            Loading…
                                        </div>
                                    ) : studentGrades.length === 0 ? (
                                        <div style={{ padding: "1.25rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.85rem", border: "1.5px dashed var(--gray-200)", borderRadius: 4 }}>
                                            No grade entries yet.
                                        </div>
                                    ) : (
                                        <>
                                            {(() => {
                                                const released = studentGrades.filter(g => g.releasedAt);
                                                const withScore = released.filter(g => g.score != null);
                                                const avg = withScore.length > 0 ? Math.round(withScore.reduce((s, g) => s + (g.score! / g.maxScore) * 100, 0) / withScore.length) : null;
                                                return (
                                                    <div style={{ display: "flex", gap: "1rem", marginBottom: "0.6rem", fontSize: "0.8rem", color: "var(--gray-500)", flexWrap: "wrap" }}>
                                                        <span><strong>{studentGrades.length}</strong> entries</span>
                                                        <span><strong>{released.length}</strong> released</span>
                                                        {avg != null && <span style={{ fontWeight: 700, color: avg >= 80 ? "var(--success)" : avg >= 60 ? "var(--warning)" : "var(--danger)" }}>Avg {avg}%</span>}
                                                    </div>
                                                );
                                            })()}
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                                    <thead>
                                                        <tr style={{ background: "var(--gray-50)" }}>
                                                            <th style={{ padding: "0.5rem 0.6rem", textAlign: "left", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Title</th>
                                                            <th style={{ padding: "0.5rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 60 }}>Type</th>
                                                            <th style={{ padding: "0.5rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 70 }}>Score</th>
                                                            <th style={{ padding: "0.5rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 70 }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {studentGrades.map(g => {
                                                            const pct = g.score != null ? Math.round((g.score / g.maxScore) * 100) : null;
                                                            return (
                                                                <tr key={g.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                                                                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{g.title}</td>
                                                                    <td style={{ padding: "0.4rem 0.4rem", textAlign: "center" }}>
                                                                        <span className={`badge ${g.type === "exam" ? "badge-primary" : g.type === "quiz" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "0.65rem" }}>{g.type}</span>
                                                                    </td>
                                                                    <td style={{ padding: "0.4rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.82rem", color: pct != null ? (pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)") : "var(--gray-400)" }}>
                                                                        {g.score != null ? `${g.score}/${g.maxScore}` : "—"}
                                                                    </td>
                                                                    <td style={{ padding: "0.4rem 0.4rem", textAlign: "center" }}>
                                                                        {g.releasedAt ? <span className="badge badge-success" style={{ fontSize: "0.65rem" }}>✓</span> : <span style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>—</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )
                                )}

                                {/* ── Exams tab ── */}
                                {detailTab === "exams" && (
                                    selected.subjects.length === 0 ? (
                                        <div style={{ padding: "1.25rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.85rem", border: "1.5px dashed var(--gray-200)", borderRadius: 4 }}>
                                            No published exams yet.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                                <thead>
                                                    <tr style={{ background: "var(--gray-50)" }}>
                                                        <th style={{ padding: "0.5rem 0.6rem", textAlign: "left", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Exam</th>
                                                        <th style={{ padding: "0.5rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 80 }}>Score</th>
                                                        <th style={{ padding: "0.5rem 0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.72rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 80 }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selected.subjects.map((sub, i) => (
                                                        <tr key={i} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                                                            <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>{sub.name}</td>
                                                            <td style={{ padding: "0.4rem 0.4rem", textAlign: "center", fontWeight: 700, color: sub.score != null ? (sub.score >= 80 ? "var(--success)" : sub.score >= 60 ? "var(--warning)" : "var(--danger)") : "var(--gray-400)" }}>
                                                                {sub.score != null ? `${sub.score}%` : "—"}
                                                            </td>
                                                            <td style={{ padding: "0.4rem 0.4rem", textAlign: "center", fontSize: "0.78rem", color: sub.score == null ? "var(--gray-400)" : sub.score >= 85 ? "var(--success)" : sub.score >= 75 ? "var(--warning)" : "var(--danger)" }}>
                                                                {sub.score == null ? "—" : sub.score >= 85 ? "✅" : sub.score >= 75 ? "⚠" : "❌"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* AI recommendation — separate card */}
                            <div style={{ background: "var(--primary-50)", border: "1.5px solid var(--primary-100)", borderRadius: 8, padding: "0.85rem 1rem" }}>
                                <div style={{ fontWeight: 700, color: "var(--primary-700)", fontSize: "0.82rem", marginBottom: "0.35rem" }}>🤖 AI Recommendation</div>
                                <p style={{ fontSize: "0.82rem", color: "var(--primary-800)", margin: 0, lineHeight: 1.5 }}>
                                    {selected.avg >= 85
                                        ? `${selected.name} is performing well. Keep providing challenging material.`
                                        : selected.avg >= 60
                                        ? `${selected.name} needs support. Consider extra practice sessions.`
                                        : selected.avg > 0
                                        ? `${selected.name} is at risk (avg below 60%). Immediate intervention recommended.`
                                        : `${selected.name} hasn't taken any exams yet.`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
