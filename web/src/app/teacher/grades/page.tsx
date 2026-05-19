"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { cachedFetch, invalidateCachePrefix } from "@/lib/cache";
import { PageHeader } from "@/components/ui";
import { ClipboardList, FileText, Plus } from "lucide-react";
import {
    bulkGradeEntries,
    deleteGradeEntry,
    deleteGradeGroup,
    getActiveAcademicYear,
    getExamSummary,
    listEnrollments,
    listExams,
    listGradesForClass,
    listMyClassOfferings,
    listUsers,
    releaseGrades,
    updateGradeEntry,
    type ClassOffering,
    type Enrollment,
    type Exam,
    type GradeEntryType,
    type GradeGroup,
    type PublicUser,
} from "@/lib/admin-api";

type AssessmentTab = "gradebook" | "create" | "exam-imports";

type StudentRosterRow = {
    studentId: string;
    name: string;
    email: string;
};

type ExamImportRow = {
    exam: Exam;
    summary: Awaited<ReturnType<typeof getExamSummary>>;
};

const GRADE_TYPES: { value: GradeEntryType; label: string }[] = [
    { value: "assignment", label: "Assignment" },
    { value: "quiz", label: "Quiz" },
    { value: "exam", label: "Exam" },
    { value: "project", label: "Project" },
    { value: "other", label: "Other" },
];

function Spinner({ size = 28 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite", color: "var(--primary-500)" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}

function scoreColor(score: number | null, max: number) {
    if (score == null) return "var(--gray-400)";
    const pct = (score / max) * 100;
    if (pct >= 90) return "var(--success)";
    if (pct >= 70) return "var(--primary-600)";
    return "var(--warning)";
}

function classLabel(offering?: ClassOffering | null) {
    if (!offering) return "Select a class";
    const grade = offering.gradeName || (offering as any).grade?.name || "";
    const section = offering.sectionName || (offering as any).section?.name || "";
    const subject = offering.subjectName || (offering as any).subject?.name || "";
    if (grade && section && subject) return `${grade} - ${section} · ${subject}`;
    if (grade && section) return `${grade} - ${section}`;
    if (grade && subject) return `${grade} · ${subject}`;
    if (subject && section) return `${subject} - ${section}`;
    return offering.displayName || offering.name?.trim() || "Untitled Class";
}

export default function TeacherGrades() {
    useCurrentUser("teacher");
    const { selectedTermId, selectedTermName } = useTermStore();

    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [offeringsLoading, setOfferingsLoading] = useState(true);
    const [activeYearId, setActiveYearId] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState("");
    const [groups, setGroups] = useState<GradeGroup[]>([]);
    const [roster, setRoster] = useState<StudentRosterRow[]>([]);
    const [examImports, setExamImports] = useState<ExamImportRow[]>([]);

    const [loading, setLoading] = useState(false);
    const [examLoading, setExamLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const [activeTab, setActiveTab] = useState<AssessmentTab>("gradebook");
    const [showNewForm, setShowNewForm] = useState(false);
    const [saveAsDraft, setSaveAsDraft] = useState(true);

    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<GradeEntryType>("assignment");
    const [newMaxScore, setNewMaxScore] = useState("100");
    const [newNote, setNewNote] = useState("");
    const [newScores, setNewScores] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const [editingEntry, setEditingEntry] = useState<string | null>(null);
    const [editScore, setEditScore] = useState("");
    const [editMaxScore, setEditMaxScore] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const [groupPage, setGroupPage] = useState<Record<string, number>>({});
    const [groupRowsPerPage, setGroupRowsPerPage] = useState<Record<string, number>>({});

    // New Assessment Table Pagination state
    const [createPage, setCreatePage] = useState(0);
    const [createRowsPerPage, setCreateRowsPerPage] = useState(10);

    // Auto-reset state when form opens/closes or class changes
    useEffect(() => {
        setCreatePage(0);
    }, [showNewForm, selectedClass]);

    const selectedOffering = useMemo(() => offerings.find((o) => o.id === selectedClass) ?? null, [offerings, selectedClass]);
    const assessedStudents = useMemo(() => roster, [roster]);
    const totalAssessments = useMemo(() => groups.length, [groups]);

    const showToast = useCallback((msg: string, ok = true) => {
        setToast({ msg, ok });
        window.setTimeout(() => setToast(null), 3500);
    }, []);

    const loadOfferings = useCallback(async () => {
        setOfferingsLoading(true);
        try {
            const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
            if (!year?.id) return;
            setActiveYearId(year.id);
            const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000);
            setOfferings(mine);
            setSelectedClass((current) => current || mine[0]?.id || "");
        } catch {
            setOfferings([]);
        } finally {
            setOfferingsLoading(false);
        }
    }, []);

    const loadClassData = useCallback(async (classId: string, forceRefresh = false) => {
        if (!classId || !activeYearId) return;
        setLoading(true);
        setErr(null);
        try {
            if (forceRefresh) invalidateCachePrefix(`grades:${classId}`);
            const [grades, enrollments, students] = await Promise.all([
                cachedFetch(`grades:${classId}:${selectedTermId ?? "all"}`, () => listGradesForClass(classId, selectedTermId ?? undefined), 30_000),
                cachedFetch(`grade-enrollments:${classId}:${activeYearId}`, () => listEnrollments({ classOfferingId: classId, academicYearId: activeYearId }), 60_000),
                cachedFetch("students:all", () => listUsers("student"), 120_000),
            ]);

            setGroups(grades.groups);
            const userMap = new Map((students as PublicUser[]).map((student) => [student.id, student]));
            const nextRoster = (enrollments as Enrollment[]).map((enrollment) => {
                const student = userMap.get(enrollment.studentId);
                return {
                    studentId: enrollment.studentId,
                    name: student ? `${student.firstName} ${student.lastName}`.trim() || student.email : enrollment.studentId.slice(0, 8),
                    email: student?.email ?? "",
                };
            });
            setRoster(nextRoster);
        } catch (error) {
            setErr(error instanceof Error ? error.message : "Failed to load grade data");
            setGroups([]);
            setRoster([]);
        } finally {
            setLoading(false);
        }
    }, [activeYearId, selectedTermId]);

    const loadExamImports = useCallback(async (classId: string) => {
        if (!classId || !activeYearId) return;
        setExamLoading(true);
        try {
            const [exams, enrollments] = await Promise.all([
                cachedFetch(`grade-exams:${activeYearId}:${selectedTermId ?? "all"}`, () => listExams(activeYearId, selectedTermId ?? undefined), 30_000),
                cachedFetch(`grade-enrollments:${classId}:${activeYearId}`, () => listEnrollments({ classOfferingId: classId, academicYearId: activeYearId }), 60_000),
            ]);
            const classExams = (exams as Exam[]).filter((exam) => exam.classOfferingId === classId && exam.published);
            const rows = await Promise.all(classExams.map(async (exam) => ({ exam, summary: await cachedFetch(`grade-exam-summary:${exam.id}`, () => getExamSummary(exam.id), 30_000) })));
            setExamImports(rows);
            if ((enrollments as Enrollment[]).length === 0) {
                showToast("No enrolled students found for this class", false);
            }
        } catch (error) {
            setExamImports([]);
            showToast(error instanceof Error ? error.message : "Failed to load exam imports", false);
        } finally {
            setExamLoading(false);
        }
    }, [activeYearId, selectedTermId, showToast]);

    useEffect(() => { void loadOfferings(); }, [loadOfferings]);
    useEffect(() => { if (selectedClass) void loadClassData(selectedClass); }, [selectedClass, loadClassData, selectedTermId]);
    useEffect(() => { if (selectedClass && activeTab === "exam-imports") void loadExamImports(selectedClass); }, [activeTab, loadExamImports, selectedClass]);

    const enrolledStudents = assessedStudents;

    const paginatedEnrolledStudents = useMemo(() => {
        const start = createPage * createRowsPerPage;
        return enrolledStudents.slice(start, start + createRowsPerPage);
    }, [enrolledStudents, createPage, createRowsPerPage]);

    const handleBulkSubmit = async () => {
        if (!selectedClass) { showToast("Select a class", false); return; }
        if (!newTitle.trim()) { showToast("Enter a title", false); return; }
        const max = parseFloat(newMaxScore);
        if (!Number.isFinite(max) || max < 1) { showToast("Max score must be at least 1", false); return; }
        if (enrolledStudents.length === 0) { showToast("No students found in this class", false); return; }

        setSubmitting(true);
        try {
            await bulkGradeEntries({
                classOfferingId: selectedClass,
                title: newTitle.trim(),
                type: newType,
                maxScore: max,
                note: newNote.trim() || undefined,
                termId: selectedTermId ?? undefined,
                entries: enrolledStudents.map((student) => ({
                    studentId: student.studentId,
                    score: newScores[student.studentId] !== undefined && newScores[student.studentId] !== "" ? parseFloat(newScores[student.studentId]) : null,
                })),
            });
            showToast(saveAsDraft ? `"${newTitle}" saved as draft` : `"${newTitle}" saved`);
            setShowNewForm(false);
            setNewTitle("");
            setNewNote("");
            setNewScores({});
            invalidateCachePrefix(`grades:${selectedClass}`);
            await loadClassData(selectedClass, true);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to save assessment", false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRelease = async (title: string) => {
        if (!selectedClass) return;
        try {
            const result = await releaseGrades(selectedClass, title);
            showToast(`Released to ${result.released} student(s)`);
            await loadClassData(selectedClass, true);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Release failed", false);
        }
    };

    const handleDeleteEntry = async (entryId: string, studentName: string) => {
        if (!confirm(`Remove this grade for ${studentName}?`)) return;
        try {
            await deleteGradeEntry(entryId);
            showToast("Grade removed");
            await loadClassData(selectedClass, true);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Delete failed", false);
        }
    };

    const handleDeleteGroup = async (title: string) => {
        if (!selectedClass) return;
        if (!confirm(`Delete the entire "${title}" assessment for every student? This cannot be undone.`)) return;
        try {
            const res = await deleteGradeGroup(selectedClass, title);
            showToast(`Deleted ${res.deleted} entr${res.deleted === 1 ? "y" : "ies"}`);
            await loadClassData(selectedClass, true);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Delete failed", false);
        }
    };

    const handleEditSave = async (entryId: string) => {
        setEditSaving(true);
        try {
            await updateGradeEntry(entryId, {
                score: editScore !== "" ? parseFloat(editScore) : null,
                maxScore: editMaxScore !== "" ? parseFloat(editMaxScore) : undefined,
            });
            setEditingEntry(null);
            showToast("Assessment updated");
            await loadClassData(selectedClass, true);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Update failed", false);
        } finally {
            setEditSaving(false);
        }
    };

    const handleImportExam = async (exam: Exam) => {
        if (!selectedClass || !activeYearId) return;
        try {
            const [summary, enrollments] = await Promise.all([
                getExamSummary(exam.id),
                listEnrollments({ classOfferingId: selectedClass, academicYearId: activeYearId }),
            ]);
            const scoreByStudent = new Map(summary.studentResults.map((result) => [result.studentId, result.score ?? 0]));
            await bulkGradeEntries({
                classOfferingId: selectedClass,
                title: exam.title,
                type: "exam",
                maxScore: summary.maxPoints || exam.maxPoints || 100,
                note: `Imported from exam ${exam.title}`,
                termId: selectedTermId ?? undefined,
                entries: (enrollments as Enrollment[]).map((enrollment) => ({
                    studentId: enrollment.studentId,
                    score: scoreByStudent.get(enrollment.studentId) ?? 0,
                })),
            });
            invalidateCachePrefix(`grades:${selectedClass}`);
            showToast(`Imported ${exam.title} into the gradebook`);
            await loadClassData(selectedClass, true);
            await loadExamImports(selectedClass);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to import exam", false);
        }
    };

    return (
        <div className="page-wrapper">
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 12, padding: "0.875rem 1.25rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: toast.ok ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
                    {toast.msg}
                </div>
            )}

            <PageHeader
                kicker="Grade System"
                title="Assessments & Gradebook"
                subtitle="Manage every section, create assessments, import exam results, keep drafts, and edit scores at any time."
                icon={<ClipboardList size={22} />}
                actions={(
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("exam-imports"); void loadExamImports(selectedClass); }}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "transparent",
                                border: "1.5px solid rgba(255,255,255,0.35)",
                                borderRadius: "12px",
                                padding: "0.6rem 1.25rem",
                                color: "#fff",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease-in-out",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)";
                                e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
                                e.currentTarget.style.transform = "none";
                            }}
                        >
                            <FileText size={14} />
                            <span>Import Exams</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => { setActiveTab("create"); setShowNewForm(true); }}
                            disabled={offeringsLoading || offerings.length === 0}
                            style={{
                                borderRadius: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "0.6rem 1.25rem",
                            }}
                        >
                            <Plus size={14} />
                            <span>Add Assessment</span>
                        </button>
                    </div>
                )}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
                {[
                    { label: "Sections", value: offerings.length },
                    { label: "Assessments", value: totalAssessments },
                    { label: "Students", value: roster.length },
                    { label: "Term", value: selectedTermName ?? "All Terms" },
                ].map((item) => (
                    <div key={item.label} style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.15rem", border: "1px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: 6, color: "var(--gray-900)" }}>{item.value}</div>
                    </div>
                ))}
            </div>

            {err && <div className="card" style={{ marginBottom: 16, padding: "0.85rem 1rem", color: "var(--danger)", border: "1.5px solid var(--danger-light)", background: "var(--danger-light)" }}>{err}</div>}

            <div style={{ background: "#fff", borderRadius: 18, padding: "0.95rem 1.25rem", marginBottom: 16, border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Class</label>
                {offeringsLoading ? (
                    <div style={{ height: 38, width: 240, borderRadius: 8, background: "var(--gray-100)", animation: "pulse 1.5s ease-in-out infinite" }} />
                ) : (
                    <Select
                        value={selectedClass}
                        onChange={(event) => setSelectedClass(event.target.value)}
                        style={{
                            padding: "0.45rem 1.15rem",
                            borderRadius: "9999px",
                            border: "1.5px solid var(--primary-200)",
                            background: "var(--primary-50)",
                            color: "var(--primary-800)",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            minWidth: 240
                        }}
                    >
                        {offerings.length === 0 ? <option value="">No classes assigned</option> : offerings.map((offering) => <option key={offering.id} value={offering.id}>{classLabel(offering)}</option>)}
                    </Select>
                )}
                {selectedOffering && !offeringsLoading && (
                    <span style={{ fontSize: "0.8rem", color: "var(--gray-500)", background: "var(--gray-50)", padding: "0.3rem 0.75rem", borderRadius: 20, border: "1px solid var(--gray-200)" }}>
                        {classLabel(selectedOffering)}
                    </span>
                )}
                <div style={{ marginLeft: "auto" }}>
                    <TermSelector academicYearId={activeYearId || null} onTermChange={() => undefined} />
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {(["gradebook", "create", "exam-imports"] as AssessmentTab[]).map((tab) => (
                    <button key={tab} className={`btn ${activeTab === tab ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab(tab)} style={{ borderRadius: 999, padding: "0.7rem 1rem" }}>
                        {tab === "gradebook" ? "Gradebook" : tab === "create" ? "Create Assessment" : "Exam Imports"}
                    </button>
                ))}
            </div>

            {showNewForm && activeTab === "create" && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header" style={{ flexWrap: "wrap", gap: 8 }}>
                        <h3 className="card-title">New Assessment</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowNewForm(false)}>Close</button>
                    </div>
                    <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                            <div className="input-group"><label>Title</label><div className="input-field"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. Assignment 1" /></div></div>
                            <div className="input-group">
                                <label>Type</label>
                                <Select
                                    value={newType}
                                    onChange={(event) => setNewType(event.target.value as GradeEntryType)}
                                    style={{
                                        padding: "0.45rem 1.15rem",
                                        borderRadius: "9999px",
                                        border: "1.5px solid var(--primary-200)",
                                        background: "var(--primary-50)",
                                        color: "var(--primary-800)",
                                        fontWeight: 600,
                                        fontSize: "0.85rem",
                                        width: "100%"
                                    }}
                                >
                                    {GRADE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </Select>
                            </div>
                            <div className="input-group"><label>Max Score</label><div className="input-field"><input type="number" min={1} value={newMaxScore} onChange={(event) => setNewMaxScore(event.target.value)} /></div></div>
                        </div>

                        <div className="input-group"><label>Note</label><div className="input-field"><input value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Optional note for the class" /></div></div>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>
                            <input type="checkbox" checked={saveAsDraft} onChange={(event) => setSaveAsDraft(event.target.checked)} />
                            Save as draft first
                        </label>

                        <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Student Scores</div>
                            {loading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner /></div>
                            ) : enrolledStudents.length === 0 ? (
                                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.85rem", border: "1.5px dashed var(--gray-200)", borderRadius: 8 }}>No students found in this class.</div>
                            ) : (
                                <>
                                    <div style={{ overflowX: "auto", border: "1.5px solid var(--gray-200)", borderRadius: 8 }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                            <thead>
                                                <tr style={{ background: "var(--gray-50)" }}>
                                                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Student</th>
                                                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "center", fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 140 }}>Score / {newMaxScore || "100"}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedEnrolledStudents.map((student, index) => (
                                                    <tr key={student.studentId} style={{ background: index % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid var(--gray-100)" }}>
                                                        <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>{student.name}<div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>{student.email}</div></td>
                                                        <td style={{ padding: "0.45rem 0.5rem" }}>
                                                            <input type="number" min={0} max={parseFloat(newMaxScore) || 100} value={newScores[student.studentId] ?? ""} onChange={(event) => setNewScores((previous) => ({ ...previous, [student.studentId]: event.target.value }))} placeholder="—" style={{ width: "100%", padding: "0.3rem 0.5rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {enrolledStudents.length > 0 && (
                                        <TablePagination
                                            total={enrolledStudents.length}
                                            page={createPage}
                                            rowsPerPage={createRowsPerPage}
                                            onPageChange={setCreatePage}
                                            onRowsPerPageChange={(n) => {
                                                setCreateRowsPerPage(n);
                                                setCreatePage(0);
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleBulkSubmit} disabled={submitting} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {submitting && <Spinner size={14} />}
                                {submitting ? "Saving…" : saveAsDraft ? "Save Draft" : "Save Assessment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "exam-imports" && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
                        <div>
                            <h3 className="card-title">Exam Imports</h3>
                            <p style={{ margin: "0.2rem 0 0", color: "var(--gray-500)", fontSize: "0.84rem" }}>Import exam results as editable assessment rows. Missing attempts are set to 0 so the gradebook stays complete.</p>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => void loadExamImports(selectedClass)} disabled={examLoading || !selectedClass}>Refresh</button>
                    </div>
                    {examLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner /></div>
                    ) : examImports.length === 0 ? (
                        <div style={{ padding: "1.5rem", color: "var(--gray-500)", fontSize: "0.9rem" }}>No published exams found for the selected class and term.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 16, padding: "0 1.25rem 1.25rem" }}>
                            {examImports.map(({ exam, summary }) => (
                                <div
                                    key={exam.id}
                                    style={{
                                        border: "1.5px solid var(--gray-100)",
                                        borderRadius: 16,
                                        padding: "1.25rem",
                                        background: "#fff",
                                        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 16,
                                        transition: "all 0.2s ease-in-out"
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = "var(--primary-200)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.05)";
                                        e.currentTarget.style.transform = "translateY(-1px)";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = "var(--gray-100)";
                                        e.currentTarget.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.02)";
                                        e.currentTarget.style.transform = "none";
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: "280px" }}>
                                        {/* Icon Container */}
                                        <div style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 12,
                                            background: "var(--primary-50)",
                                            color: "var(--primary-600)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                        </div>
                                        
                                        {/* Title and Metadata */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--gray-900)" }}>{exam.title}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0.25rem 0.65rem", fontSize: "0.75rem", fontWeight: 700 }}>
                                                    <strong>{summary.submitted}</strong> / {summary.totalStudents} Submitted
                                                </span>
                                                <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0.25rem 0.65rem", fontSize: "0.75rem", fontWeight: 700 }}>
                                                    <strong>{summary.released}</strong> Released
                                                </span>
                                                <span className="badge badge-purple" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0.25rem 0.65rem", fontSize: "0.75rem", fontWeight: 700 }}>
                                                    Max <strong>{summary.maxPoints}</strong> pts
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => void handleImportExam(exam)}
                                        style={{
                                            borderRadius: 12,
                                            padding: "0.6rem 1.25rem",
                                            fontSize: "0.85rem",
                                            fontWeight: 700,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        Import as Assessment
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "gradebook" && (
                <>
                    {loading ? (
                        <div className="card" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}><Spinner /></div>
                    ) : groups.length === 0 ? (
                        <div style={{ background: "#fff", borderRadius: 20, padding: "4rem 2rem", textAlign: "center", border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gray-700)", marginBottom: "0.25rem" }}>No grade entries yet</div>
                            <div style={{ fontSize: "0.875rem", color: "var(--gray-400)", marginBottom: "0.5rem" }}>Use Create Assessment to start a draft or import an exam.</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {groups.map((group) => {
                                const page = groupPage[group.title] || 0;
                                const rowsPerPage = groupRowsPerPage[group.title] || 10;
                                const start = page * rowsPerPage;
                                const paged = group.entries.slice(start, start + rowsPerPage);
                                const isReleased = !!group.releasedAt;
                                return (
                                    <div key={group.title} className="card" style={{ overflow: "hidden" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.25rem", background: "var(--gray-50)", borderBottom: "1.5px solid var(--gray-100)", gap: 12, flexWrap: "wrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--gray-900)" }}>{group.title}</span>
                                                <span className={`badge ${group.type === "exam" ? "badge-primary" : group.type === "quiz" ? "badge-warning" : "badge-success"}`}>{group.type}</span>
                                                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>out of {group.maxScore}</span>
                                                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>{group.studentCount} students</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                {isReleased ? <span className="badge badge-success">Released {new Date(group.releasedAt!).toLocaleDateString()}</span> : <button className="btn btn-primary btn-sm" onClick={() => void handleRelease(group.title)}>Release to Students</button>}
                                                <button className="btn btn-sm" style={{ background: "var(--danger-light)", color: "var(--danger)", border: "none", cursor: "pointer", borderRadius: 8, padding: "0.3rem 0.7rem", fontSize: "0.8rem", fontWeight: 600 }} onClick={() => void handleDeleteGroup(group.title)}>Delete</button>
                                            </div>
                                        </div>
                                        <div className="table-wrapper" style={{ margin: 0 }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Student</th>
                                                        <th style={{ textAlign: "center" }}>Score</th>
                                                        <th style={{ textAlign: "center" }}>Out of</th>
                                                        <th style={{ textAlign: "center" }}>%</th>
                                                        <th>Note</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paged.map((entry) => {
                                                        const isEditing = editingEntry === entry.id;
                                                        const percent = entry.score != null ? Math.round((entry.score / entry.maxScore) * 100) : null;
                                                        return (
                                                            <tr key={entry.id}>
                                                                <td style={{ fontWeight: 600 }}>{[entry.firstName, entry.lastName].filter(Boolean).join(" ") || entry.studentEmail || entry.studentId.slice(0, 8)}</td>
                                                                <td style={{ textAlign: "center" }}>{isEditing ? <input type="number" min={0} value={editScore} onChange={(event) => setEditScore(event.target.value)} style={{ width: 70, padding: "0.25rem 0.4rem", border: "1.5px solid var(--primary-400)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} autoFocus /> : <span style={{ fontWeight: 700, color: scoreColor(entry.score, entry.maxScore) }}>{entry.score ?? "—"}</span>}</td>
                                                                <td style={{ textAlign: "center" }}>{isEditing ? <input type="number" min={1} value={editMaxScore} onChange={(event) => setEditMaxScore(event.target.value)} style={{ width: 70, padding: "0.25rem 0.4rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} /> : <span style={{ color: "var(--gray-500)" }}>{entry.maxScore}</span>}</td>
                                                                <td style={{ textAlign: "center" }}>{percent != null ? <span style={{ fontWeight: 600, color: scoreColor(entry.score, entry.maxScore) }}>{percent}%</span> : "—"}</td>
                                                                <td style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>{entry.note || "—"}</td>
                                                                <td>{isEditing ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="btn btn-primary btn-sm" onClick={() => void handleEditSave(entry.id)} disabled={editSaving} style={{ display: "flex", alignItems: "center", gap: 6 }}>{editSaving && <Spinner size={12} />}{editSaving ? "…" : "Save"}</button><button className="btn btn-secondary btn-sm" onClick={() => setEditingEntry(null)} disabled={editSaving}>Cancel</button></div> : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="btn btn-outline btn-sm" onClick={() => { setEditingEntry(entry.id); setEditScore(entry.score != null ? String(entry.score) : ""); setEditMaxScore(String(entry.maxScore)); }}>Edit</button><button className="btn btn-sm" style={{ background: "var(--danger-light)", color: "var(--danger)", border: "none", cursor: "pointer", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.78rem", fontWeight: 600 }} onClick={() => void handleDeleteEntry(entry.id, [entry.firstName, entry.lastName].filter(Boolean).join(" ") || entry.studentEmail || entry.studentId.slice(0, 8))}>Delete</button></div>}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {group.entries.length > 0 && (
                                            <div style={{ padding: "0.5rem 1rem" }}>
                                                <TablePagination 
                                                    total={group.entries.length} 
                                                    page={page} 
                                                    rowsPerPage={rowsPerPage} 
                                                    onPageChange={(nextPage) => setGroupPage((previous) => ({ ...previous, [group.title]: nextPage }))} 
                                                    onRowsPerPageChange={(n) => {
                                                        setGroupRowsPerPage((previous) => ({ ...previous, [group.title]: n }));
                                                        setGroupPage((previous) => ({ ...previous, [group.title]: 0 }));
                                                    }} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}