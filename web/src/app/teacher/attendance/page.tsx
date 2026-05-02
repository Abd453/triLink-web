"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
    getActiveAcademicYear,
    listMyClassOfferings,
    listEnrollments,
    listUsers,
    listAttendanceSessions,
    createAttendanceSession,
    putSessionMarks,
    getSessionMarks,
    type ClassOffering,
    type PublicUser,
    type AttendanceSession,
    type AttendanceMark,
} from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { cachedFetch, invalidateCachePrefix } from "@/lib/cache";

type AttendanceStatus = "present" | "absent" | "excused";
type ExcuseEntry = { note: string; saved: boolean };
type DraftState = { attendance: Record<string, AttendanceStatus>; excuses: Record<string, ExcuseEntry> };
type StudentRow = { id: string; name: string; email: string };

const MAX_VISIBLE_TABS = 4;

function offeringLabel(o: ClassOffering) {
    const g = o.gradeName || (o as any).grade?.name || "";
    const s = o.sectionName || (o as any).section?.name || "";
    if (g && s) return `${g} - ${s}`;
    return o.displayName || o.name?.trim() || "Untitled Class";
    }

function TeacherAttendanceSkeleton() {
    return (
        <div className="page-wrapper">
            <div className="page-header admin-dash-skeleton-block">
                <div style={{ width: "100%", maxWidth: 360 }}>
                    <div className="admin-skeleton shimmer" style={{ width: 140, height: 12, marginBottom: 12 }} />
                    <div className="admin-skeleton shimmer" style={{ width: "65%", height: 28, marginBottom: 8 }} />
                    <div className="admin-skeleton shimmer" style={{ width: "45%", height: 12 }} />
                </div>
            </div>
            <div className="admin-skeleton shimmer" style={{ width: "100%", maxWidth: 520, height: 44, borderRadius: 10, marginBottom: "1rem" }} />
            <div className="card admin-dash-skeleton-block">
                <div className="admin-skeleton shimmer" style={{ width: "100%", height: 280, borderRadius: 12 }} />
            </div>
        </div>
    );
}
export default function TeacherAttendance() {
    // ── API state ──
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
    const user = useCurrentUser("teacher");
    
    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [studentsByOffering, setStudentsByOffering] = useState<Record<string, StudentRow[]>>({});
    const [sessionsByOffering, setSessionsByOffering] = useState<Record<string, AttendanceSession[]>>({});
    const [marksBySession, setMarksBySession] = useState<Record<string, AttendanceMark[]>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // ── UI state ──
    const [viewMode, setViewMode] = useState<"mark" | "tabular">("mark");
    const [selectedOfferingId, setSelectedOfferingId] = useState("");
    const [showMoreDropdown, setShowMoreDropdown] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
    const [toast, setToast] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
    const moreRef = useRef<HTMLDivElement>(null);

    const today = useMemo(() => new Date().toISOString().split("T")[0], []);
    const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── Load data ──
    const loadData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setErr(null);
        try {
            if (forceRefresh) {
                invalidateCachePrefix("active-year");
                invalidateCachePrefix("offerings:");
                invalidateCachePrefix("students:");
                invalidateCachePrefix("sessions:");
                invalidateCachePrefix("marks:");
            }

            const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
            if (!year?.id) {
                setErr("No active academic year. Ask an admin to activate one.");
                setLoading(false);
                return;
            }

            const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000);
            const { filterOfferingsBySubject } = await import("@/lib/teacher-utils");
            const scoped = filterOfferingsBySubject(mine, user?.subject);
            setOfferings(scoped);
            if (scoped.length > 0 && !scoped.find(o => o.id === selectedOfferingId)) {
                setSelectedOfferingId(scoped[0].id);
            }
            if (scoped.length === 0) {
                setStudentsByOffering({});
                setSessionsByOffering({});
                setMarksBySession({});
                setLoading(false);
                return;
            }

            // Fetch all students once, then all offerings' enrollments + sessions in parallel
            const [allUsers, ...offeringData] = await Promise.all([
                cachedFetch("students:all", () => listUsers("student"), 120_000),
                ...scoped.map(o => Promise.all([
                    cachedFetch(`enroll:${o.id}:${year.id}`, () => listEnrollments({ classOfferingId: o.id, academicYearId: year.id }), 60_000),
                    cachedFetch(`sessions:${o.id}`, () => listAttendanceSessions(o.id), 20_000),
                ]).then(([enrollments, sessions]) => ({ o, enrollments, sessions }))),
            ]);

            const userMap = new Map(allUsers.map(u => [u.id, u]));
            const studentsMap: Record<string, any[]> = {};
            const sessionsMap: Record<string, any[]> = {};
            const marksMap: Record<string, any[]> = {};

            // Collect all session IDs across all offerings for parallel marks fetch
            const allSessionIds: { offeringId: string; sessionId: string }[] = [];
            for (const item of offeringData) {
                const { o, enrollments, sessions } = item as any;
                studentsMap[o.id] = enrollments.map((e: any) => {
                    const u = userMap.get(e.studentId);
                    return { id: e.studentId, name: u ? `${u.firstName} ${u.lastName}` : e.studentId.slice(0, 8), email: u?.email ?? "" };
                });
                sessionsMap[o.id] = sessions;
                for (const s of sessions) allSessionIds.push({ offeringId: o.id, sessionId: s.id });
            }

            // Fetch all marks in parallel
            const marksResults = await Promise.all(
                allSessionIds.map(({ sessionId }) =>
                    cachedFetch(`marks:${sessionId}`, () => getSessionMarks(sessionId), 20_000)
                        .then(marks => ({ sessionId, marks }))
                        .catch(() => ({ sessionId, marks: [] }))
                )
            );
            for (const { sessionId, marks } of marksResults) {
                marksMap[sessionId] = marks;
            }

            setStudentsByOffering(studentsMap);
            setSessionsByOffering(sessionsMap);
            setMarksBySession(marksMap);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [today, selectedOfferingId, user?.subject]);

    useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived state ──
    const students = studentsByOffering[selectedOfferingId] ?? [];
    const sessions = sessionsByOffering[selectedOfferingId] ?? [];
    const currentSession = useMemo(() => sessions.find(s => s.date === today), [sessions, today]);
    const isLocked = !!currentSession; // already submitted today
    const currentMarks = currentSession ? (marksBySession[currentSession.id] ?? []) : [];

    // Derive attendance from draft, else from API marks for today, else default present
    const attendance = useMemo<Record<string, AttendanceStatus>>(() => {
        if (drafts[selectedOfferingId]) return drafts[selectedOfferingId].attendance;
        const base: Record<string, AttendanceStatus> = Object.fromEntries(
            students.map(s => [s.id, "present" as AttendanceStatus])
        );
        for (const m of currentMarks) {
            if (m.studentId in base) {
                base[m.studentId] = m.status as AttendanceStatus;
            }
        }
        return base;
    }, [drafts, selectedOfferingId, students, currentMarks]);

    const excuseEntries = useMemo<Record<string, ExcuseEntry>>(() => {
        if (drafts[selectedOfferingId]) return drafts[selectedOfferingId].excuses;
        const base: Record<string, ExcuseEntry> = {};
        for (const m of currentMarks) {
            if (m.status === "excused" && m.note) {
                base[m.studentId] = { note: m.note, saved: true };
            }
        }
        return base;
    }, [drafts, selectedOfferingId, currentMarks]);

    const setDraft = (att: Record<string, AttendanceStatus>, exc: Record<string, ExcuseEntry>) =>
        setDrafts(prev => ({ ...prev, [selectedOfferingId]: { attendance: att, excuses: exc } }));

    const togglePresent = (id: string) => {
        if (isLocked) return;
        const next = attendance[id] === "present" ? "absent" : "present" as AttendanceStatus;
        const newExc = { ...excuseEntries };
        if (next !== "excused") delete newExc[id];
        setDraft({ ...attendance, [id]: next }, newExc);
    };

    const setExcused = (id: string) => {
        if (isLocked) return;
        setDraft(
            { ...attendance, [id]: "excused" },
            { ...excuseEntries, [id]: excuseEntries[id] ?? { note: "", saved: false } }
        );
    };

    const setAbsent = (id: string) => {
        if (isLocked) return;
        const newExc = { ...excuseEntries };
        delete newExc[id];
        setDraft({ ...attendance, [id]: "absent" }, newExc);
    };

    const updateNote = (id: string, note: string) =>
        setDraft(attendance, { ...excuseEntries, [id]: { note, saved: false } });

    const saveNote = (id: string) => {
        if (!excuseEntries[id]?.note.trim()) return;
        setDraft(attendance, { ...excuseEntries, [id]: { ...excuseEntries[id], saved: true } });
    };

    const allPresent = useMemo(() => students.every(s => attendance[s.id] === "present"), [attendance, students]);

    const markAll = () => {
        if (isLocked) return;
        if (allPresent) {
            setDraft(Object.fromEntries(students.map(s => [s.id, "absent" as AttendanceStatus])), excuseEntries);
        } else {
            setDraft(Object.fromEntries(students.map(s => [s.id, "present" as AttendanceStatus])), {});
        }
    };

    const stats = useMemo(() => {
        const values = students.map(s => attendance[s.id] ?? "present");
        return {
            total: students.length,
            present: values.filter(v => v === "present").length,
            absent: values.filter(v => v === "absent").length,
            excused: values.filter(v => v === "excused").length,
        };
    }, [attendance, students]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

    const confirmSubmit = async () => {
        setSubmitting(true);
        try {
            // Create session for today
            const session = await createAttendanceSession({ classOfferingId: selectedOfferingId, date: today });
            // Submit marks
            const marks = students.map(s => {
                const status = attendance[s.id] ?? "present";
                let note: string | undefined = undefined;
                if (status === "excused") {
                    note = excuseEntries[s.id]?.note || undefined;
                }
                return { studentId: s.id, status, note };
            });
            await putSessionMarks(session.id, marks);
            // Clear draft
            setDrafts(prev => { const n = { ...prev }; delete n[selectedOfferingId]; return n; });
            showToast("Attendance submitted successfully!");
            setShowSubmitConfirm(false);
            // Reload
            await loadData();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Submit failed");
        } finally {
            setSubmitting(false);
            setShowSubmitConfirm(false);
        }
    };

    const handleSubmit = () => {
        setShowSubmitConfirm(true);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMoreDropdown(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const visibleClasses = offerings.slice(0, MAX_VISIBLE_TABS);
    const hiddenClasses = offerings.slice(MAX_VISIBLE_TABS);

    const hasSessionToday = (offeringId: string) =>
        (sessionsByOffering[offeringId] ?? []).some(s => s.date === today);

    if (loading) {
        return <TeacherAttendanceSkeleton />;
    }

    if (err) {
        return (
            <div className="page-wrapper">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Attendance</h1>
                        <p className="page-subtitle">Error</p>
                    </div>
                </div>
                <div className="card" style={{ color: "var(--danger)", padding: "2rem" }}>{err}</div>
            </div>
        );
    }

    if (offerings.length === 0) {
        return (
            <div className="page-wrapper">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Attendance</h1>
                        <p className="page-subtitle">{todayStr}</p>
                    </div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--gray-400)" }}>
                    <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--gray-500)", marginBottom: "0.25rem" }}>No classes assigned</div>
                    <div style={{ fontSize: "0.85rem" }}>Ask an admin to assign you to class offerings for this academic year.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 14, padding: "1rem 1.5rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: "1.5px solid var(--success)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{toast}</span>
                </div>
            )}

            {showSubmitConfirm && (
                <div className="modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
                    <div className="modal" style={{ maxWidth: 520, width: "92%" }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Attendance Submission</h3>
                            <button className="modal-close" onClick={() => setShowSubmitConfirm(false)} aria-label="Close confirmation">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ fontSize: "0.9rem", color: "var(--gray-700)", lineHeight: 1.7 }}>
                            Submit attendance for {offeringLabel(offerings.find(o => o.id === selectedOfferingId)!)} on {today}. After submission, this session will be locked.
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => void confirmSubmit()} disabled={submitting}>{submitting ? "Submitting…" : "Confirm Submit"}</button>
                        </div>
                    </div>
                </div>
            )}



            {selectedStudent && (
                <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
                    <div className="modal" style={{ maxWidth: 640, width: "92%" }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                    Attendance History
                                </h3>
                                <div style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginTop: "0.2rem" }}>Records for: <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>{selectedStudent.name}</span></div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedStudent(null)} aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body table-wrapper" style={{ maxHeight: "60vh", overflowY: "auto", padding: 0 }}>
                            <table style={{ margin: 0, borderBottom: "none" }}>
                                <thead>
                                    <tr>
                                        <th style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10, width: "30%" }}>Date</th>
                                        <th style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10, width: "20%" }}>Status</th>
                                        <th style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10, width: "50%" }}>Notes (Excused)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.sort((a,b) => -a.date.localeCompare(b.date)).map(s => {
                                        const reqMarks = marksBySession[s.id] || [];
                                        const m = reqMarks.find(mark => mark.studentId === selectedStudent.id);
                                        const status = m?.status || "present";
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 500, color: "var(--gray-900)" }}>{new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
                                                <td>
                                                    {status === "present" && <span style={{ color: "var(--success)", fontWeight: 700, background: "var(--success-light)", padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", display: "inline-block" }}>Present</span>}
                                                    {status === "absent" && <span style={{ color: "var(--danger)", fontWeight: 700, background: "var(--danger-light)", padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", display: "inline-block" }}>Absent</span>}
                                                    {status === "excused" && <span style={{ color: "#d97706", fontWeight: 700, background: "var(--warning-light)", padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", display: "inline-block" }}>Excused</span>}
                                                </td>
                                                <td style={{ color: "var(--gray-600)", fontSize: "0.85rem", fontStyle: status === "excused" && m?.note ? "italic" : "normal", whiteSpace: "pre-wrap" }}>
                                                    {m?.note ? `"${m.note}"` : "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {sessions.length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--gray-500)", padding: "2rem" }}>No attendance sessions found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        Attendance
                    </h1>
                    <p className="page-subtitle">{todayStr}</p>
                </div>
                {!isLocked && students.length > 0 && (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <button className="btn btn-secondary" onClick={markAll} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {allPresent ? (
                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Mark All Absent</>
                            ) : (
                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>Mark All Present</>
                            )}
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                            Submit Attendance
                        </button>
                    </div>
                )}
            </div>

            {/* Locked banner */}
            {isLocked && (
                <div style={{ marginBottom: "1.25rem", padding: "0.875rem 1.25rem", borderRadius: 12, background: "var(--warning-light)", border: "1.5px solid var(--warning)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#92400e" }}>Attendance Submitted &amp; Locked</div>
                        <div style={{ fontSize: "0.8rem", color: "#78350f", marginTop: 2 }}>This attendance session has been submitted and is read-only. Contact the admin to request an edit unlock.</div>
                    </div>
                </div>
            )}

            {/* Class Tabs with overflow */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {visibleClasses.map(c => (
                    <button
                        key={c.id}
                        className={`btn ${selectedOfferingId === c.id ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setSelectedOfferingId(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
                    >
                        {offeringLabel(c)}
                        {hasSessionToday(c.id) && (
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: selectedOfferingId === c.id ? "rgba(255,255,255,0.85)" : "var(--success)", display: "inline-block", flexShrink: 0 }} />
                        )}
                    </button>
                ))}
                {hiddenClasses.length > 0 && (
                    <div ref={moreRef} style={{ position: "relative" }}>
                        <button
                            className={`btn ${hiddenClasses.some(c => c.id === selectedOfferingId) ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setShowMoreDropdown(v => !v)}
                            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                        >
                            +{hiddenClasses.length} more
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        {showMoreDropdown && (
                            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1.5px solid var(--gray-200)", borderRadius: 12, padding: "0.5rem", zIndex: 300, minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                {hiddenClasses.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setSelectedOfferingId(c.id); setShowMoreDropdown(false); }}
                                        style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "none", background: selectedOfferingId === c.id ? "var(--primary-50)" : "transparent", color: selectedOfferingId === c.id ? "var(--primary-600)" : "var(--gray-700)", fontWeight: selectedOfferingId === c.id ? 700 : 500, fontSize: "0.875rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem" }}
                                    >
                                        {offeringLabel(c)}
                                        {hasSessionToday(c.id) && (
                                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", marginLeft: "auto" }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* No students in class */}
            {students.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--gray-400)" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem", display: "block" }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--gray-500)", marginBottom: "0.25rem" }}>No students enrolled</div>
                    <div style={{ fontSize: "0.85rem" }}>Students will appear here once enrolled in this class by the admin.</div>
                </div>
            )}

            {students.length > 0 && (
                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--gray-200)" }}>
                    <button
                        onClick={() => setViewMode("mark")}
                        style={{
                            padding: "0.75rem 0.5rem",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.95rem",
                            fontWeight: viewMode === "mark" ? 600 : 500,
                            color: viewMode === "mark" ? "var(--primary-600)" : "var(--gray-500)",
                            borderBottom: viewMode === "mark" ? "2px solid var(--primary-500)" : "2px solid transparent",
                        }}
                    >
                        Mark Attendance (Today)
                    </button>
                    <button
                        onClick={() => setViewMode("tabular")}
                        style={{
                            padding: "0.75rem 0.5rem",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.95rem",
                            fontWeight: viewMode === "tabular" ? 600 : 500,
                            color: viewMode === "tabular" ? "var(--primary-600)" : "var(--gray-500)",
                            borderBottom: viewMode === "tabular" ? "2px solid var(--primary-500)" : "2px solid transparent",
                        }}
                    >
                        Tabular / Historical View
                    </button>
                </div>
            )}

            {students.length > 0 && viewMode === "mark" && (
                <>
                    {/* Stats Bar */}
                    <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "var(--gray-100)", color: "var(--gray-700)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            </div>
                            <div className="stat-info"><div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            </div>
                            <div className="stat-info"><div className="stat-label">Present</div><div className="stat-value" style={{ color: "var(--success)" }}>{stats.present}</div></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </div>
                            <div className="stat-info"><div className="stat-label">Absent</div><div className="stat-value" style={{ color: "var(--danger)" }}>{stats.absent}</div></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><line x1="9" x2="15" y1="13" y2="13" /></svg>
                            </div>
                            <div className="stat-info"><div className="stat-label">Excused</div><div className="stat-value" style={{ color: "var(--warning)" }}>{stats.excused}</div></div>
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                {offeringLabel(offerings.find(o => o.id === selectedOfferingId)!)} - {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                            </h3>
                            <div style={{ fontSize: "0.8rem", color: isLocked ? "var(--warning)" : "var(--gray-500)" }}>
                                {isLocked ? "Read-only - submitted" : "Click the checkbox to toggle present/absent"}
                            </div>
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 48 }}>#</th>
                                        <th>Student</th>
                                        <th style={{ width: 140 }}>Email</th>
                                        {!isLocked && <th style={{ width: 70, textAlign: "center" }}>Present</th>}
                                        <th style={{ width: 130 }}>Status</th>
                                        <th>Excuse Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s, i) => {
                                        const status = attendance[s.id] ?? "present";
                                        const isPresent = status === "present";
                                        const isExcused = status === "excused";
                                        const isAbsent = status === "absent";
                                        const excuse = excuseEntries[s.id];
                                        return (
                                            <tr key={s.id} style={{ background: isPresent ? "transparent" : isExcused ? "rgba(139,92,246,0.03)" : "rgba(239,68,68,0.03)", opacity: isLocked ? 0.9 : 1 }}>
                                                <td style={{ fontWeight: 500, color: "var(--gray-400)" }}>{i + 1}</td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: isPresent ? "var(--success-light)" : isExcused ? "var(--purple-light)" : "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: isPresent ? "#065f46" : isExcused ? "#5b21b6" : "#991b1b", flexShrink: 0 }}>
                                                            {s.name.split(" ").map(n => n[0]).join("")}
                                                        </div>
                                                        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{s.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: "var(--gray-500)", fontSize: "0.8rem" }}>
                                                    {s.email}
                                                    {isLocked && isExcused && currentMarks.find(m => m.studentId === s.id)?.note && (
                                                        <div style={{ marginTop: "0.25rem", color: "#b45309", fontSize: "0.75rem", fontWeight: 500 }}>
                                                            Note: {currentMarks.find(m => m.studentId === s.id)?.note}
                                                        </div>
                                                    )}
                                                </td>
                                                {!isLocked && (
                                                    <td style={{ textAlign: "center" }}>
                                                        <button
                                                            onClick={() => togglePresent(s.id)}
                                                            style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${isPresent ? "var(--success)" : "var(--gray-300)"}`, background: isPresent ? "var(--success)" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "all 150ms ease", margin: "0 auto" }}
                                                            title={isPresent ? "Mark as absent" : "Mark as present"}
                                                        >
                                                            {isPresent && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                                        </button>
                                                    </td>
                                                )}
                                                <td>
                                                    {isLocked ? (
                                                        <span className={`badge ${isPresent ? "badge-success" : isExcused ? "badge-warning" : "badge-danger"}`} style={{ fontSize: "0.7rem" }}>
                                                            {isPresent ? "Present" : isExcused ? "Excused" : "Absent"}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {!isPresent && (
                                                                <div style={{ display: "flex", gap: "0.25rem" }}>
                                                                    <button onClick={() => setAbsent(s.id)} style={{ padding: "0.25rem 0.5rem", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600, border: `1.5px solid ${isAbsent ? "var(--danger)" : "var(--gray-200)"}`, background: isAbsent ? "var(--danger-light)" : "#fff", color: isAbsent ? "#991b1b" : "var(--gray-500)", cursor: "pointer" }}>Absent</button>
                                                                    <button onClick={() => setExcused(s.id)} style={{ padding: "0.25rem 0.5rem", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600, border: `1.5px solid ${isExcused ? "var(--purple)" : "var(--gray-200)"}`, background: isExcused ? "var(--purple-light)" : "#fff", color: isExcused ? "#5b21b6" : "var(--gray-500)", cursor: "pointer" }}>Excused</button>
                                                                </div>
                                                            )}
                                                            {isPresent && <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Present</span>}
                                                        </>
                                                    )}
                                                </td>
                                                <td>
                                                    {isExcused && (
                                                        <div>
                                                            {(isLocked || excuse?.saved) ? (
                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                    <span style={{ fontSize: "0.8rem", color: "#5b21b6", fontStyle: "italic" }}>{excuse?.note || ""}</span>
                                                                    {!isLocked && (
                                                                        <button onClick={() => setDrafts(prev => ({ ...prev, [selectedOfferingId]: { attendance: prev[selectedOfferingId]?.attendance ?? attendance, excuses: { ...prev[selectedOfferingId]?.excuses ?? excuseEntries, [s.id]: { ...excuse!, saved: false } } } }))}
                                                                            style={{ padding: "0.15rem 0.4rem", borderRadius: 5, border: "1px solid var(--gray-200)", background: "#fff", fontSize: "0.68rem", color: "var(--gray-500)", cursor: "pointer" }}>Edit</button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                                                    <input type="text" placeholder="Enter excuse reason…" value={excuse?.note ?? ""} onChange={e => updateNote(s.id, e.target.value)}
                                                                        style={{ flex: 1, padding: "0.4rem 0.65rem", borderRadius: 8, border: "1.5px solid var(--purple)", background: "var(--purple-light)", fontSize: "0.8rem", outline: "none", color: "#5b21b6" }}
                                                                        onKeyDown={e => e.key === "Enter" && saveNote(s.id)} />
                                                                    <button onClick={() => saveNote(s.id)}
                                                                        style={{ padding: "0.4rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--purple)", background: excuse?.note?.trim() ? "var(--purple)" : "var(--gray-200)", color: excuse?.note?.trim() ? "#fff" : "var(--gray-400)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

                        {/* Tabular View */}
                        {students.length > 0 && viewMode === "tabular" && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                        {offeringLabel(offerings.find(o => o.id === selectedOfferingId)!)} - Tabular History
                                    </h3>
                                </div>
                                <div className="table-wrapper" style={{ overflowX: "auto" }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 48, minWidth: 48, position: "sticky", left: 0, zIndex: 20, background: "var(--gray-50)" }}>#</th>
                                                <th style={{ minWidth: 200, position: "sticky", left: 48, zIndex: 20, background: "var(--gray-50)", borderRight: "1px solid var(--gray-200)", boxShadow: "2px 0 5px -2px rgba(0,0,0,0.05)" }}>Student</th>
                                                {sessions.sort((a,b) => -a.date.localeCompare(b.date)).map(s => (
                                                    <th key={s.id} style={{ textAlign: "center", minWidth: 70, borderLeft: "1px solid var(--gray-100)" }}>
                                                        <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 500 }}>
                                                            {new Date(s.date).toLocaleDateString("en-US", { weekday: "short" })}
                                                        </div>
                                                        <div style={{ fontSize: "0.85rem", color: "var(--gray-800)" }}>
                                                            {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, i) => (
                                                <tr key={student.id} onClick={() => setSelectedStudent(student)} style={{ cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--gray-50)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                                    <td style={{ color: "var(--gray-500)", position: "sticky", left: 0, zIndex: 10, background: "#fff", transition: "background 0.2s" }}>{i + 1}</td>
                                                    <td style={{ position: "sticky", left: 48, zIndex: 10, background: "#fff", borderRight: "1px solid var(--gray-200)", boxShadow: "2px 0 5px -2px rgba(0,0,0,0.05)", transition: "background 0.2s" }}>
                                                        <div style={{ fontWeight: 600, color: "var(--primary-600)", textDecoration: "underline", textUnderlineOffset: "3px" }}>{student.name}</div>
                                                        <div style={{ fontSize: "0.7rem", color: "var(--gray-500)", marginTop: 2 }}>{student.email ? student.email : "Click details"}</div>
                                                    </td>
                                                    {sessions.map(s => {
                                                        const reqMarks = marksBySession[s.id] || [];
                                                        const m = reqMarks.find(mark => mark.studentId === student.id);
                                                        const isP = !m || m.status === "present";
                                                        const isA = m && m.status === "absent";
                                                        const isE = m && m.status === "excused";
                                                        return (
                                                            <td key={s.id} style={{ textAlign: "center", borderLeft: "1px solid var(--gray-100)" }}>
                                                                {isP && <span style={{ color: "var(--success)", fontWeight: 800, background: "var(--success-light)", padding: "2px 6px", borderRadius: 4 }}>P</span>}
                                                                {isA && <span style={{ color: "var(--danger)", fontWeight: 800, background: "var(--danger-light)", padding: "2px 6px", borderRadius: 4 }}>A</span>}
                                                                {isE && <span style={{ color: "#d97706", fontWeight: 800, background: "var(--warning-light)", padding: "2px 6px", borderRadius: 4 }} title={m.note || undefined}>E</span>}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {sessions.length === 0 && (
                                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--gray-500)" }}>
                                        No attendance sessions have been recorded yet for this class.
                                    </div>
                                )}
                            </div>
                        )}
                        
        </div>
    );
}
