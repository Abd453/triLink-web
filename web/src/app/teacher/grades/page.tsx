"use client";
import { useState, useEffect, useCallback } from "react";
import {
    getActiveAcademicYear,
    listMyClassOfferings,
    listGradesForClass,
    bulkGradeEntries,
    updateGradeEntry,
    releaseGrades,
    type ClassOffering,
    type GradeGroup,
    type GradeEntryType,
} from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { cachedFetch, invalidateCachePrefix } from "@/lib/cache";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";

function offeringLabel(o: ClassOffering) {
    const grade = (o as any).gradeName || "";
    const subj = o.subjectName || (o as any).subject?.name || "";
    const sec = o.sectionName || (o as any).section?.name || "";
    if (grade && subj && sec) return `${grade} ${subj} - ${sec}`;
    if (grade && subj) return `${grade} ${subj}`;
    if (subj && sec) return `${subj} - ${sec}`;
    return o.displayName || o.name?.trim() || "Untitled Class";
}

const GRADE_TYPES: { value: GradeEntryType; label: string }[] = [
    { value: "assignment", label: "Assignment" },
    { value: "quiz", label: "Quiz" },
    { value: "exam", label: "Exam" },
    { value: "project", label: "Project" },
    { value: "other", label: "Other" },
];

function scoreColor(score: number | null, max: number) {
    if (score == null) return "var(--gray-400)";
    const pct = (score / max) * 100;
    if (pct >= 90) return "var(--success)";
    if (pct >= 70) return "var(--primary-600)";
    return "var(--warning)";
}

function Spinner({ size = 28 }: { size?: number }) {
    return (
        <>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite", color: "var(--primary-500)" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
        </>
    );
}

export default function TeacherGrades() {
    useCurrentUser("teacher");
    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [offeringsLoading, setOfferingsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [groups, setGroups] = useState<GradeGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const [showNewForm, setShowNewForm] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<GradeEntryType>("assignment");
    const [newMaxScore, setNewMaxScore] = useState("100");
    const [newNote, setNewNote] = useState("");
    const [newScores, setNewScores] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const [editingEntry, setEditingEntry] = useState<string | null>(null);
    const [editScore, setEditScore] = useState<string>("");
    const [editMaxScore, setEditMaxScore] = useState<string>("");
    const [editSaving, setEditSaving] = useState(false);

    const [groupPage, setGroupPage] = useState<Record<string, number>>({});

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const loadOfferings = useCallback(async () => {
        setOfferingsLoading(true);
        try {
            const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
            if (!year?.id) return;
            const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000,
                (fresh) => { setOfferings(fresh); if (fresh.length > 0) setSelectedClass(c => c || fresh[0].id); });
            setOfferings(mine);
            if (mine.length > 0) setSelectedClass(c => c || mine[0].id);
        } catch { /* ignore */ }
        finally { setOfferingsLoading(false); }
    }, []);

    const loadGrades = useCallback(async (classId: string, forceRefresh = false) => {
        if (!classId) return;
        setLoading(true); setErr(null);
        try {
            if (forceRefresh) invalidateCachePrefix(`grades:${classId}`);
            const data = await cachedFetch(`grades:${classId}`, () => listGradesForClass(classId), 30_000,
                (fresh) => setGroups(fresh.groups));
            setGroups(data.groups);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to load grades");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadOfferings(); }, [loadOfferings]);
    useEffect(() => { if (selectedClass) void loadGrades(selectedClass); }, [selectedClass, loadGrades]);

    const selectedOffering = offerings.find(o => o.id === selectedClass);
    const enrolledStudents = groups.flatMap(g => g.entries).reduce((acc, e) => {
        if (!acc.find(x => x.studentId === e.studentId)) acc.push(e);
        return acc;
    }, [] as typeof groups[0]["entries"]);

    const handleBulkSubmit = async () => {
        if (!newTitle.trim()) { showToast("Enter a title", false); return; }
        if (!selectedClass) { showToast("Select a class", false); return; }
        const max = parseFloat(newMaxScore);
        if (isNaN(max) || max < 1) { showToast("Max score must be at least 1", false); return; }
        if (enrolledStudents.length === 0) { showToast("No students found in this class yet", false); return; }
        setSubmitting(true);
        try {
            await bulkGradeEntries({
                classOfferingId: selectedClass,
                title: newTitle.trim(),
                type: newType,
                maxScore: max,
                note: newNote.trim() || undefined,
                entries: enrolledStudents.map(s => ({
                    studentId: s.studentId,
                    score: newScores[s.studentId] !== undefined && newScores[s.studentId] !== "" ? parseFloat(newScores[s.studentId]) : null,
                })),
            });
            showToast(`"${newTitle}" grades saved`);
            setShowNewForm(false); setNewTitle(""); setNewScores({}); setNewNote("");
            invalidateCachePrefix(`grades:${selectedClass}`);
            await loadGrades(selectedClass);
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to save grades", false);
        } finally { setSubmitting(false); }
    };

    const handleRelease = async (title: string) => {
        if (!selectedClass) return;
        try {
            const res = await releaseGrades(selectedClass, title);
            showToast(`Released to ${res.released} student(s)`);
            await loadGrades(selectedClass);
        } catch (e) { showToast(e instanceof Error ? e.message : "Release failed", false); }
    };

    const handleEditSave = async (entryId: string) => {
        setEditSaving(true);
        try {
            await updateGradeEntry(entryId, {
                score: editScore !== "" ? parseFloat(editScore) : null,
                maxScore: editMaxScore !== "" ? parseFloat(editMaxScore) : undefined,
            });
            setEditingEntry(null);
            await loadGrades(selectedClass);
            showToast("Updated");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Update failed", false);
        } finally { setEditSaving(false); }
    };

    return (
        <div className="page-wrapper">
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 4, padding: "0.85rem 1.25rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, fontWeight: 600, fontSize: "0.9rem" }}>
                    {toast.msg}
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        Grades & Results
                    </h1>
                    <p className="page-subtitle">Manage assignments, quizzes, and exam grades for your classes</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewForm(true)} disabled={offeringsLoading || offerings.length === 0} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Grade Entry
                </button>
            </div>

            {err && <div className="card" style={{ marginBottom: "1rem", padding: "0.85rem 1rem", color: "var(--danger)", border: "1.5px solid var(--danger-light)", background: "var(--danger-light)" }}>{err}</div>}

            {/* Class selector */}
            <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class</label>
                    {offeringsLoading ? (
                        <div style={{ height: 38, width: 220, borderRadius: 4, background: "var(--gray-100)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    ) : (
                        <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.9rem", background: "#fff", minWidth: 220 }}>
                            {offerings.length === 0
                                ? <option value="">No classes assigned</option>
                                : offerings.map(o => <option key={o.id} value={o.id}>{offeringLabel(o)}</option>)
                            }
                        </Select>
                    )}
                    {selectedOffering && !offeringsLoading && (
                        <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                            {[(selectedOffering as any).gradeName, selectedOffering.subjectName, (selectedOffering as any).sectionName && `Section ${(selectedOffering as any).sectionName}`].filter(Boolean).join(" · ")}
                        </span>
                    )}
                </div>
            </div>

            {/* New entry form */}
            {showNewForm && (
                <div className="card" style={{ marginBottom: "1.25rem" }}>
                    <div className="card-header">
                        <h3 className="card-title">New Grade Entry</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowNewForm(false)}>Cancel</button>
                    </div>
                    <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                            <div className="input-group">
                                <label>Title</label>
                                <div className="input-field"><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Assignment 1, Quiz 3" /></div>
                            </div>
                            <div className="input-group">
                                <label>Type</label>
                                <Select value={newType} onChange={e => setNewType(e.target.value as GradeEntryType)} style={{ padding: "0.65rem 0.9rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.9rem", background: "#fff", width: "100%" }}>
                                    {GRADE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </Select>
                            </div>
                            <div className="input-group">
                                <label>Max Score</label>
                                <div className="input-field"><input type="number" min={1} value={newMaxScore} onChange={e => setNewMaxScore(e.target.value)} /></div>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Note (optional)</label>
                            <div className="input-field"><input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Optional note for all students" /></div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Student Scores — leave blank = not yet graded</div>
                            {loading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem" }}><Spinner /></div>
                            ) : enrolledStudents.length === 0 ? (
                                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.85rem", border: "1.5px dashed var(--gray-200)", borderRadius: 4 }}>No students found yet. Students appear once they have existing grade entries.</div>
                            ) : (
                                <div style={{ overflowX: "auto", border: "1.5px solid var(--gray-200)", borderRadius: 4 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                        <thead>
                                            <tr style={{ background: "var(--gray-50)" }}>
                                                <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Student</th>
                                                <th style={{ padding: "0.6rem 0.75rem", textAlign: "center", fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 130 }}>Score / {newMaxScore || "100"}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {enrolledStudents.map((s, i) => (
                                                <tr key={s.studentId} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid var(--gray-100)" }}>
                                                    <td style={{ padding: "0.45rem 0.75rem", fontWeight: 600 }}>{[s.firstName, s.lastName].filter(Boolean).join(" ") || s.studentEmail || s.studentId.slice(0, 8)}</td>
                                                    <td style={{ padding: "0.45rem 0.5rem" }}>
                                                        <input type="number" min={0} max={parseFloat(newMaxScore) || 100} value={newScores[s.studentId] ?? ""} onChange={e => setNewScores(p => ({ ...p, [s.studentId]: e.target.value }))} placeholder="—" style={{ width: "100%", padding: "0.3rem 0.5rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleBulkSubmit} disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                {submitting && <Spinner size={14} />}
                                {submitting ? "Saving…" : "Save Grades"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Grade groups */}
            {loading ? (
                <div className="card" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}><Spinner /></div>
            ) : groups.length === 0 && !offeringsLoading ? (
                <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.9rem" }}>
                    No grade entries yet for this class. Click "Add Grade Entry" to get started.
                    <br /><span style={{ fontSize: "0.8rem", marginTop: "0.5rem", display: "block" }}>Platform exam submissions appear here automatically once students submit.</span>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {groups.map(group => {
                        const page = groupPage[group.title] || 1;
                        const rowsPerPage = 10;
                        const paged = group.entries.slice((page - 1) * rowsPerPage, page * rowsPerPage);
                        const isReleased = !!group.releasedAt;
                        return (
                            <div key={group.title} className="card" style={{ overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", background: "var(--gray-50)", borderBottom: "1.5px solid var(--gray-100)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--gray-900)" }}>{group.title}</span>
                                        <span className={`badge ${group.type === "exam" ? "badge-primary" : group.type === "quiz" ? "badge-warning" : "badge-success"}`}>{group.type}</span>
                                        <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>out of {group.maxScore}</span>
                                        <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>{group.studentCount} students</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                        {isReleased ? (
                                            <span className="badge badge-success">Released {new Date(group.releasedAt!).toLocaleDateString()}</span>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" onClick={() => handleRelease(group.title)}>Release to Students</button>
                                        )}
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
                                            {paged.map(entry => {
                                                const isEditing = editingEntry === entry.id;
                                                const pct = entry.score != null ? Math.round((entry.score / entry.maxScore) * 100) : null;
                                                return (
                                                    <tr key={entry.id}>
                                                        <td style={{ fontWeight: 600 }}>{[entry.firstName, entry.lastName].filter(Boolean).join(" ") || entry.studentEmail || entry.studentId.slice(0, 8)}</td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {isEditing ? <input type="number" min={0} value={editScore} onChange={e => setEditScore(e.target.value)} style={{ width: 70, padding: "0.25rem 0.4rem", border: "1.5px solid var(--primary-400)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} autoFocus /> : <span style={{ fontWeight: 700, color: scoreColor(entry.score, entry.maxScore) }}>{entry.score ?? "—"}</span>}
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {isEditing ? <input type="number" min={1} value={editMaxScore} onChange={e => setEditMaxScore(e.target.value)} style={{ width: 70, padding: "0.25rem 0.4rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" }} /> : <span style={{ color: "var(--gray-500)" }}>{entry.maxScore}</span>}
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>{pct != null ? <span style={{ fontWeight: 600, color: scoreColor(entry.score, entry.maxScore) }}>{pct}%</span> : "—"}</td>
                                                        <td style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>{entry.note || "—"}</td>
                                                        <td>
                                                            {isEditing ? (
                                                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                                                    <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(entry.id)} disabled={editSaving} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                        {editSaving && <Spinner size={12} />}{editSaving ? "…" : "Save"}
                                                                    </button>
                                                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingEntry(null)} disabled={editSaving}>Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <button className="btn btn-outline btn-sm" onClick={() => { setEditingEntry(entry.id); setEditScore(entry.score != null ? String(entry.score) : ""); setEditMaxScore(String(entry.maxScore)); }}>Edit</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {group.entries.length > rowsPerPage && (
                                    <div style={{ padding: "0.5rem 1rem" }}>
                                        <TablePagination total={group.entries.length} page={page} rowsPerPage={rowsPerPage} onPageChange={p => setGroupPage(prev => ({ ...prev, [group.title]: p }))} onRowsPerPageChange={() => {}} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
