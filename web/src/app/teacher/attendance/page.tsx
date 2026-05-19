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
import { ClipboardCheck, BookOpen, AlertCircle, ArrowLeft } from "lucide-react";
import TablePagination from "@/components/TablePagination";
import { useSearchParams, useRouter } from "next/navigation";

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
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromHomeroom = searchParams?.get("from") === "homeroom";

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
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Reset page when offering changes
    useEffect(() => {
        setPage(0);
    }, [selectedOfferingId]);
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

    const visibleStudents = useMemo(() => {
        return students.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    }, [students, page, rowsPerPage]);
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
                {fromHomeroom && (
                    <div style={{ marginBottom: "1rem" }}>
                        <button
                            type="button"
                            onClick={() => router.push("/teacher/homeroom")}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                background: "#fff",
                                border: "1.5px solid var(--gray-150)",
                                borderRadius: "12px",
                                padding: "0.55rem 1.15rem",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                                color: "var(--gray-800)",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease-in-out",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "var(--primary-300)";
                                e.currentTarget.style.boxShadow = "0 4px 16px rgba(37, 99, 235, 0.08)";
                                e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "var(--gray-150)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
                                e.currentTarget.style.transform = "none";
                            }}
                        >
                            <ArrowLeft size={14} strokeWidth={3} style={{ color: "var(--primary-600)" }} />
                            <span>Back to Homeroom</span>
                        </button>
                    </div>
                )}
                <PageHeader kicker="Today" title="Attendance" subtitle="Error" icon={<ClipboardCheck size={22} />} variant="dark" />
                <EmptyState icon={<AlertCircle size={26} />} title="Couldn't load attendance" description={err} action={<button className="btn btn-primary" onClick={() => void loadData(true)} style={{ borderRadius: 12 }}>Try again</button>} />
            </div>
        );
    }

    if (offerings.length === 0) {
        return (
            <div className="page-wrapper">
                {fromHomeroom && (
                    <div style={{ marginBottom: "1rem" }}>
                        <button
                            type="button"
                            onClick={() => router.push("/teacher/homeroom")}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                background: "#fff",
                                border: "1.5px solid var(--gray-150)",
                                borderRadius: "12px",
                                padding: "0.55rem 1.15rem",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                                color: "var(--gray-800)",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease-in-out",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "var(--primary-300)";
                                e.currentTarget.style.boxShadow = "0 4px 16px rgba(37, 99, 235, 0.08)";
                                e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "var(--gray-150)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
                                e.currentTarget.style.transform = "none";
                            }}
                        >
                            <ArrowLeft size={14} strokeWidth={3} style={{ color: "var(--primary-600)" }} />
                            <span>Back to Homeroom</span>
                        </button>
                    </div>
                )}
                <PageHeader kicker="Today" title="Attendance" subtitle={todayStr} icon={<ClipboardCheck size={22} />} variant="dark" />
                <EmptyState icon={<BookOpen size={26} />} title="No classes assigned" description="Ask an admin to assign you to class offerings for this academic year." />
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            {fromHomeroom && (
                <div style={{ marginBottom: "1rem" }}>
                    <button
                        type="button"
                        onClick={() => router.push("/teacher/homeroom")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            background: "#fff",
                            border: "1.5px solid var(--gray-150)",
                            borderRadius: "12px",
                            padding: "0.55rem 1.15rem",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                            color: "var(--gray-800)",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s ease-in-out",
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "var(--primary-300)";
                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(37, 99, 235, 0.08)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "var(--gray-150)";
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
                            e.currentTarget.style.transform = "none";
                        }}
                    >
                        <ArrowLeft size={14} strokeWidth={3} style={{ color: "var(--primary-600)" }} />
                        <span>Back to Homeroom</span>
                    </button>
                </div>
            )}
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
                variant="dark"
                actions={(
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <TermSelector academicYearId={activeYearId} readOnly={false} />
                        <button className="btn btn-secondary" onClick={() => void loadData(true)} style={{ borderRadius: 12 }}>Refresh</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedOfferingId || isLocked} style={{ borderRadius: 12 }}>Submit attendance</button>
                    </div>
                )}
            />

            {/* Class Tabs (Buttons with "More" dropdown matching Students tab) */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {visibleClasses.map(off => (
                    <button 
                        key={off.id} 
                        className={`btn ${selectedOfferingId === off.id ? "btn-primary" : "btn-secondary"}`} 
                        onClick={() => setSelectedOfferingId(off.id)}
                        style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.25rem", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600 }}
                    >
                        {offeringLabel(off)}
                        {hasSessionToday(off.id) ? " • Locked" : ""}
                    </button>
                ))}

                {hiddenClasses.length > 0 && (
                    <div ref={moreRef} style={{ position: "relative" }}>
                        <button
                            type="button"
                            className={`btn ${hiddenClasses.some(c => c.id === selectedOfferingId) ? "btn-primary" : "btn-secondary"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMoreDropdown(!showMoreDropdown);
                            }}
                            style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.45rem", 
                                padding: "0.6rem 1.25rem", 
                                borderRadius: "12px", 
                                fontSize: "0.85rem", 
                                fontWeight: 600 
                            }}
                        >
                            {hiddenClasses.some(c => c.id === selectedOfferingId) 
                                ? offeringLabel(hiddenClasses.find(c => c.id === selectedOfferingId)!) 
                                : "More"}
                            <svg 
                                width="12" 
                                height="12" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{ 
                                    transform: showMoreDropdown ? "rotate(180deg)" : "rotate(0deg)", 
                                    transition: "transform 0.2s ease",
                                    marginLeft: "0.15rem"
                                }}
                            >
                                <path d="m6 9 6 6 6-6"/>
                            </svg>
                        </button>
                        
                        {showMoreDropdown && (
                            <div 
                                style={{
                                    position: "absolute",
                                    top: "calc(100% + 8px)",
                                    right: 0,
                                    zIndex: 100,
                                    background: "#fff",
                                    border: "1.5px solid var(--gray-100)",
                                    borderRadius: "20px",
                                    padding: "0.6rem",
                                    minWidth: "220px",
                                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                    animation: "fadeIn 0.15s ease-out"
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {hiddenClasses.map(off => {
                                    const isSelected = selectedOfferingId === off.id;
                                    return (
                                        <button
                                            key={off.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedOfferingId(off.id);
                                                setShowMoreDropdown(false);
                                            }}
                                            style={{
                                                padding: "0.65rem 1rem",
                                                borderRadius: "12px",
                                                background: isSelected ? "var(--primary-50)" : "transparent",
                                                color: isSelected ? "var(--primary-700)" : "var(--gray-700)",
                                                border: "none",
                                                textAlign: "left",
                                                fontSize: "0.85rem",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                transition: "all 0.15s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between"
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = "var(--gray-50)";
                                                    e.currentTarget.style.color = "var(--gray-900)";
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color = "var(--gray-700)";
                                                }
                                            }}
                                        >
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                                {offeringLabel(off)}
                                                {hasSessionToday(off.id) && (
                                                    <span style={{ fontSize: "0.7rem", color: "var(--gray-400)", fontStyle: "italic" }}>• Locked</span>
                                                )}
                                            </span>
                                            {isSelected && (
                                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-600)" }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
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

            <div className="card" style={{ padding: 0, border: "1.5px solid var(--gray-100)" }}>
                <div className="table-wrapper" style={{ overflowX: "auto", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
                    <table style={{ margin: 0, borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                            <tr>
                                <th style={{ width: "30%", padding: "1rem 1.5rem" }}>Student</th>
                                <th style={{ width: "30%", padding: "1rem 1.5rem", textAlign: "center" }}>Status</th>
                                <th style={{ width: "30%", padding: "1rem 1.5rem" }}>Excuse Note</th>
                                <th style={{ width: "10%", padding: "1rem 1.5rem", textAlign: "center" }}>History</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleStudents.map(student => {
                                const status = attendance[student.id] ?? "present";
                                const note = excuseEntries[student.id]?.note ?? "";
                                return (
                                    <tr key={student.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                                        <td style={{ padding: "0.75rem 1.5rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: "50%",
                                                    background: "var(--primary-50)", color: "var(--primary-600)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontWeight: 700, fontSize: "0.85rem", flexShrink: 0
                                                }}>
                                                    {student.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, color: "var(--gray-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</span>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--gray-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "0.75rem 1.5rem", textAlign: "center" }}>
                                            <div style={{ display: "inline-flex", background: "var(--gray-50)", padding: 4, borderRadius: 12, border: "1px solid var(--gray-100)" }}>
                                                <button
                                                    type="button"
                                                    disabled={isLocked}
                                                    onClick={() => togglePresent(student.id)}
                                                    style={{
                                                        padding: "0.4rem 0.9rem",
                                                        borderRadius: 8,
                                                        border: "none",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        cursor: isLocked ? "not-allowed" : "pointer",
                                                        background: status === "present" ? "var(--success)" : "transparent",
                                                        color: status === "present" ? "white" : "var(--gray-600)",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    Present
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isLocked}
                                                    onClick={() => setAbsent(student.id)}
                                                    style={{
                                                        padding: "0.4rem 0.9rem",
                                                        borderRadius: 8,
                                                        border: "none",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        cursor: isLocked ? "not-allowed" : "pointer",
                                                        background: status === "absent" ? "var(--danger)" : "transparent",
                                                        color: status === "absent" ? "white" : "var(--gray-600)",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    Absent
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isLocked}
                                                    onClick={() => setExcused(student.id)}
                                                    style={{
                                                        padding: "0.4rem 0.9rem",
                                                        borderRadius: 8,
                                                        border: "none",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        cursor: isLocked ? "not-allowed" : "pointer",
                                                        background: status === "excused" ? "#d97706" : "transparent",
                                                        color: status === "excused" ? "white" : "var(--gray-600)",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    Excused
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: "0.75rem 1.5rem" }}>
                                            {status === "excused" ? (
                                                <div style={{ display: "flex", gap: 8, maxWidth: "320px" }}>
                                                    <input
                                                        value={note}
                                                        onChange={(e) => updateNote(student.id, e.target.value)}
                                                        placeholder="Excuse note"
                                                        disabled={isLocked}
                                                        style={{
                                                            flex: 1,
                                                            padding: "0.35rem 0.75rem",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--gray-200)",
                                                            fontSize: "0.8rem",
                                                            outline: "none",
                                                        }}
                                                    />
                                                    {!isLocked && (
                                                        <button
                                                            className="btn btn-secondary"
                                                            onClick={() => saveNote(student.id)}
                                                            disabled={!note.trim()}
                                                            style={{
                                                                borderRadius: 10,
                                                                padding: "0.35rem 0.75rem",
                                                                fontSize: "0.8rem",
                                                                fontWeight: 600,
                                                                whiteSpace: "nowrap"
                                                            }}
                                                        >
                                                            Save
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: "var(--gray-400)", fontSize: "0.85rem" }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "0.75rem 1.5rem", textAlign: "center" }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setSelectedStudent(student)}
                                                style={{
                                                    borderRadius: 10,
                                                    padding: "0.4rem 0.8rem",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 600,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 8v4l3 3" />
                                                    <circle cx="12" cy="12" r="10" />
                                                </svg>
                                                History
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {students.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: "3rem", textAlign: "center", color: "var(--gray-400)" }}>
                                        No students enrolled in this class.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {students.length > 0 && (
                    <TablePagination
                        total={students.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={(n) => {
                            setRowsPerPage(n);
                            setPage(0);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
