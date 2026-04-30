"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    getActiveAcademicYear, listMyClassOfferings, listEnrollments, listUsers,
    listAttendanceSessions, createAttendanceSession, putSessionMarks, getSessionMarks,
    type ClassOffering, type AttendanceSession, type AttendanceMark,
} from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { cachedFetch, invalidateCachePrefix } from "@/lib/cache";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";
import { PageHeader, EmptyState } from "@/components/ui";
import { ClipboardCheck, BookOpen, AlertCircle } from "lucide-react";

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

function Skeleton() {
    return (
        <div className="page-wrapper">
            <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem 2rem", marginBottom: "1.5rem", border: "1.5px solid var(--gray-100)" }}>
                <div className="admin-skeleton shimmer" style={{ width: 160, height: 28, borderRadius: 8, marginBottom: 8 }} />
                <div className="admin-skeleton shimmer" style={{ width: 240, height: 14, borderRadius: 6 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                {[0,1,2].map(i => (
                    <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "1.25rem", border: "1.5px solid var(--gray-100)" }}>
                        <div className="admin-skeleton shimmer" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 10 }} />
                        <div className="admin-skeleton shimmer" style={{ width: "100%", height: 44, borderRadius: 10 }} />
                    </div>
                ))}
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", border: "1.5px solid var(--gray-100)" }}>
                {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "center", padding: "0.875rem 0", borderBottom: i < 4 ? "1px solid #f1f5f9" : "none" }}>
                        <div className="admin-skeleton shimmer" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div className="admin-skeleton shimmer" style={{ width: "40%", height: 14, borderRadius: 4, marginBottom: 6 }} />
                            <div className="admin-skeleton shimmer" style={{ width: "25%", height: 11, borderRadius: 4 }} />
                        </div>
                        <div className="admin-skeleton shimmer" style={{ width: 100, height: 32, borderRadius: 8 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function TeacherAttendance() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
    const user = useCurrentUser("teacher");
    const { selectedTermId } = useTermStore();

    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [studentsByOffering, setStudentsByOffering] = useState<Record<string, StudentRow[]>>({});
    const [sessionsByOffering, setSessionsByOffering] = useState<Record<string, AttendanceSession[]>>({});
    const [marksBySession, setMarksBySession] = useState<Record<string, AttendanceMark[]>>({});
    const [activeYearId, setActiveYearId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Grade -> Section -> Subject selection
    const [selectedGrade, setSelectedGrade] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedOfferingId, setSelectedOfferingId] = useState("");

    const [viewMode, setViewMode] = useState<"mark" | "tabular">("mark");
    const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
    const [toast, setToast] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
    const [showMoreDropdown, setShowMoreDropdown] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    const today = useMemo(() => new Date().toISOString().split("T")[0], []);
    const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Unique grades from all offerings
    const grades = useMemo(() => {
        const seen = new Set<string>();
        return offerings.map(o => o.gradeName || "").filter(g => g && !seen.has(g) && !!seen.add(g)).sort();
    }, [offerings]);

    // Sections filtered by selected grade
    const sections = useMemo(() => {
        const seen = new Set<string>();
        return offerings
            .filter(o => !selectedGrade || o.gradeName === selectedGrade)
            .map(o => o.sectionName || "")
            .filter(s => s && !seen.has(s) && !!seen.add(s))
            .sort();
    }, [offerings, selectedGrade]);

    // Subjects filtered by grade + section
    const subjects = useMemo(() => {
        const seen = new Set<string>();
        return offerings
            .filter(o => (!selectedGrade || o.gradeName === selectedGrade) && (!selectedSection || o.sectionName === selectedSection))
            .map(o => o.subjectName || "")
            .filter(s => s && !seen.has(s) && !!seen.add(s))
            .sort();
    }, [offerings, selectedGrade, selectedSection]);

    // Reset downstream when upstream changes
    useEffect(() => { setSelectedSection(""); setSelectedSubject(""); }, [selectedGrade]);
    useEffect(() => { setSelectedSubject(""); }, [selectedSection]);
    // Auto-select single options
    useEffect(() => { if (sections.length === 1 && !selectedSection) setSelectedSection(sections[0]); }, [sections]);
    useEffect(() => { if (subjects.length === 1 && !selectedSubject) setSelectedSubject(subjects[0]); }, [subjects]);

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
            if (!year?.id) { setErr("No active academic year. Ask an admin to activate one."); setLoading(false); return; }
            setActiveYearId(year.id);

            const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000);
            setOfferings(mine);

            if (mine.length === 0) { setStudentsByOffering({}); setSessionsByOffering({}); setMarksBySession({}); setLoading(false); return; }

            const [allUsers, ...offeringData] = await Promise.all([
                cachedFetch("students:all", () => listUsers("student"), 120_000),
                ...mine.map(o => Promise.all([
                    cachedFetch(`enroll:${o.id}:${year.id}`, () => listEnrollments({ classOfferingId: o.id, academicYearId: year.id }), 60_000),
                    cachedFetch(`sessions:${o.id}:${selectedTermId ?? "all"}`, () => listAttendanceSessions(o.id, selectedTermId ?? undefined), 20_000),
                ]).then(([enrollments, sessions]) => ({ o, enrollments, sessions }))),
            ]);

            const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
            const studentsMap: Record<string, StudentRow[]> = {};
            const sessionsMap: Record<string, AttendanceSession[]> = {};
            const allSessionIds: string[] = [];

            for (const item of offeringData) {
                const { o, enrollments, sessions } = item as any;
                studentsMap[o.id] = enrollments.map((e: any) => {
                    const u = userMap.get(e.studentId) as any;
                    return { id: e.studentId, name: u ? `${u.firstName} ${u.lastName}` : e.studentId.slice(0, 8), email: u?.email ?? "" };
                });
                sessionsMap[o.id] = sessions;
                for (const s of sessions) allSessionIds.push(s.id);
            }

            const marksMap: Record<string, AttendanceMark[]> = {};
            const marksResults = await Promise.all(
                allSessionIds.map(sessionId =>
                    cachedFetch(`marks:${sessionId}`, () => getSessionMarks(sessionId), 20_000)
                        .then((marks: AttendanceMark[]) => ({ sessionId, marks }))
                        .catch(() => ({ sessionId, marks: [] as AttendanceMark[] }))
                )
            );
            for (const { sessionId, marks } of marksResults) marksMap[sessionId] = marks;

            setStudentsByOffering(studentsMap);
            setSessionsByOffering(sessionsMap);
            setMarksBySession(marksMap);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [selectedTermId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived state ──
    const students = studentsByOffering[selectedOfferingId] ?? [];
    const sessions = sessionsByOffering[selectedOfferingId] ?? [];
    const currentSession = useMemo(() => sessions.find(s => s.date === today), [sessions, today]);
    const isLocked = !!currentSession;
    const currentMarks = currentSession ? (marksBySession[currentSession.id] ?? []) : [];

    const attendance = useMemo<Record<string, AttendanceStatus>>(() => {
        if (drafts[selectedOfferingId]) return drafts[selectedOfferingId].attendance;
        const base: Record<string, AttendanceStatus> = Object.fromEntries(
            students.map(s => [s.id, "present" as AttendanceStatus])
        );
        for (const m of currentMarks) {
            if (m.studentId in base) base[m.studentId] = m.status as AttendanceStatus;
        }
        return base;
    }, [drafts, selectedOfferingId, students, currentMarks]);

    const excuseEntries = useMemo<Record<string, ExcuseEntry>>(() => {
        if (drafts[selectedOfferingId]) return drafts[selectedOfferingId].excuses;
        const base: Record<string, ExcuseEntry> = {};
        for (const m of currentMarks) {
            if (m.status === "excused" && m.note) base[m.studentId] = { note: m.note, saved: true };
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
            const session = await createAttendanceSession({ classOfferingId: selectedOfferingId, date: today, termId: selectedTermId ?? undefined });
            const marks = students.map(s => {
                const status = attendance[s.id] ?? "present";
                let note: string | undefined;
                if (status === "excused") note = excuseEntries[s.id]?.note || undefined;
                return { studentId: s.id, status, note };
            });
            await putSessionMarks(session.id, marks);
            setDrafts(prev => { const next = { ...prev }; delete next[selectedOfferingId]; return next; });
            showToast("Attendance submitted successfully!");
            setShowSubmitConfirm(false);
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

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMoreDropdown(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const visibleClasses = offerings.slice(0, MAX_VISIBLE_TABS);
    const hiddenClasses = offerings.slice(MAX_VISIBLE_TABS);
    const hasSessionToday = (offeringId: string) => (sessionsByOffering[offeringId] ?? []).some(s => s.date === today);

    if (loading) return <Skeleton />;

    if (err) {
        return (
            <div className="page-wrapper">
                <PageHeader kicker="Today" title="Attendance" subtitle="Error" icon={<ClipboardCheck size={22} />} variant="light" />
                <EmptyState icon={<AlertCircle size={26} />} title="Couldn't load attendance" description={err} action={<button className="btn btn-primary" onClick={() => void loadData(true)} style={{ borderRadius: 12 }}>Try again</button>} />
            </div>
        );
    }

    if (offerings.length === 0) {
        return (
            <div className="page-wrapper">
                <PageHeader kicker="Today" title="Attendance" subtitle={todayStr} icon={<ClipboardCheck size={22} />} variant="light" />
                <EmptyState icon={<BookOpen size={26} />} title="No classes assigned" description="Ask an admin to assign you to class offerings for this academic year." />
            </div>
        );
    }

    return (
        <div className="page-wrapper">
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
                                    {sessions.sort((a, b) => -a.date.localeCompare(b.date)).map(s => {
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

            <PageHeader
                kicker="Today"
                title="Attendance"
                subtitle={todayStr}
                icon={<ClipboardCheck size={22} />}
                variant="light"
                actions={(
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <TermSelector academicYearId={activeYearId} readOnly={false} />
                        <button className="btn btn-secondary" onClick={() => void loadData(true)} style={{ borderRadius: 12 }}>Refresh</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedOfferingId || isLocked} style={{ borderRadius: 12 }}>Submit attendance</button>
                    </div>
                )}
            />

            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {visibleClasses.map(off => (
                        <button key={off.id} className={`btn ${selectedOfferingId === off.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setSelectedOfferingId(off.id)}>
                            {offeringLabel(off)}
                            {hasSessionToday(off.id) ? " • Locked" : ""}
                        </button>
                    ))}
                    {hiddenClasses.length > 0 && (
                        <div ref={moreRef} style={{ position: "relative" }}>
                            <button className="btn btn-secondary" onClick={() => setShowMoreDropdown(v => !v)}>More</button>
                            {showMoreDropdown && (
                                <div className="card" style={{ position: "absolute", top: "110%", right: 0, zIndex: 50, minWidth: 240, padding: 8 }}>
                                    {hiddenClasses.map(off => (
                                        <button key={off.id} className="btn btn-secondary" style={{ width: "100%", justifyContent: "flex-start", marginBottom: 6 }} onClick={() => { setSelectedOfferingId(off.id); setShowMoreDropdown(false); }}>
                                            {offeringLabel(off)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    <div><div style={{ fontSize: 12, color: "var(--gray-500)" }}>Total</div><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--gray-500)" }}>Present</div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{stats.present}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--gray-500)" }}>Absent</div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{stats.absent}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--gray-500)" }}>Excused</div><div style={{ fontSize: 24, fontWeight: 700, color: "#d97706" }}>{stats.excused}</div></div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" onClick={markAll} disabled={isLocked}>Toggle all present/absent</button>
                    {isLocked && <span style={{ color: "var(--gray-500)" }}>Today's session is locked.</span>}
                </div>
            </div>

            <div className="card">
                <div style={{ display: "grid", gap: 10 }}>
                    {students.map(student => {
                        const status = attendance[student.id] ?? "present";
                        const note = excuseEntries[student.id]?.note ?? "";
                        return (
                            <div key={student.id} style={{ padding: 12, border: "1px solid var(--gray-100)", borderRadius: 12, display: "grid", gap: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{student.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{student.email}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button className={`btn ${status === "present" ? "btn-primary" : "btn-secondary"}`} onClick={() => togglePresent(student.id)} disabled={isLocked}>Present</button>
                                        <button className={`btn ${status === "absent" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAbsent(student.id)} disabled={isLocked}>Absent</button>
                                        <button className={`btn ${status === "excused" ? "btn-primary" : "btn-secondary"}`} onClick={() => setExcused(student.id)} disabled={isLocked}>Excused</button>
                                        <button className="btn btn-secondary" onClick={() => setSelectedStudent(student)}>History</button>
                                    </div>
                                </div>
                                {status === "excused" && (
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input value={note} onChange={(e) => updateNote(student.id, e.target.value)} placeholder="Excuse note" style={{ flex: 1 }} />
                                        <button className="btn btn-secondary" onClick={() => saveNote(student.id)} disabled={!note.trim()}>Save note</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
