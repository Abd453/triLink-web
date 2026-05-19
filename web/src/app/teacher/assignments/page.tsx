"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getActiveAcademicYear, listMyClassOfferings,
  createAssignment, updateAssignment, publishAssignment, unpublishAssignment,
  deleteAssignment, listMyAssignments, listSubmissions,
  gradeSubmission, releaseSubmissionGrade, releaseAllGrades,
  type ClassOffering, type Assignment, type AssignmentSubmission, type SubmissionType,
} from "@/lib/admin-api";
import { getFileUrl, openFile } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { cachedFetch } from "@/lib/cache";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";
import { PageHeader, PageHeaderSkeleton, ListSkeleton, EmptyState } from "@/components/ui";
import { FileText, Plus } from "lucide-react";

function offeringLabel(o: ClassOffering) {
  const g = (o as any).gradeName || "";
  const s = o.subjectName || (o as any).subject?.name || "";
  const sec = o.sectionName || (o as any).section?.name || "";
  if (g && s && sec) return `${g} ${s} - ${sec}`;
  return o.displayName || o.name?.trim() || "Untitled";
}

function statusBadge(a: Assignment) {
  if (!a.published) return <span className="badge" style={{ background: "var(--gray-100)", color: "var(--gray-500)" }}>Draft</span>;
  if (a.isOverdue) return <span className="badge badge-danger">Overdue</span>;
  return <span className="badge badge-success">Active</span>;
}

function submissionBadge(s: AssignmentSubmission) {
  const colors: Record<string, string> = { pending: "badge-warning", submitted: "badge-primary", graded: "badge-success", returned: "badge-success" };
  return <span className={`badge ${colors[s.status] ?? ""}`}>{s.status}</span>;
}

function AssignmentsSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}

export default function TeacherAssignments() {
  useCurrentUser("teacher");
  const { selectedTermId } = useTermStore();
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);

  // Create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ title: "", description: "", submissionType: "file" as SubmissionType, deadline: "", maxScore: "100" });
  const [saving, setSaving] = useState(false);

  // Submissions view
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [subPage, setSubPage] = useState(1);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const loadOfferings = useCallback(async () => {
    try {
      const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
      if (!year?.id) return;
      setActiveYearId(year.id);
      const mine = await cachedFetch(`offerings:${year.id}`, () => listMyClassOfferings(year.id), 60_000);
      setOfferings(mine);
      if (mine.length > 0) setSelectedClass(c => c || mine[0].id);
    } catch { /* ignore */ }
  }, []);

  const loadAssignments = useCallback(async (classId?: string) => {
    setLoading(true);
    try {
      const list = await listMyAssignments(classId || undefined, selectedTermId ?? undefined);
      setAssignments(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedTermId]);

  useEffect(() => { void loadOfferings(); }, [loadOfferings]);
  useEffect(() => { void loadAssignments(selectedClass); }, [selectedClass, selectedTermId, loadAssignments]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", submissionType: "file", deadline: "", maxScore: "100" });
    setShowForm(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description ?? "",
      submissionType: a.submissionType,
      deadline: a.deadline ? new Date(a.deadline).toISOString().slice(0, 16) : "",
      maxScore: String(a.maxScore),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Title is required", false); return; }
    if (!form.deadline) { showToast("Deadline is required", false); return; }
    if (!selectedClass && !editing) { showToast("Select a class", false); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateAssignment(editing.id, { title: form.title, description: form.description || undefined, submissionType: form.submissionType, deadline: new Date(form.deadline).toISOString(), maxScore: parseFloat(form.maxScore) || 100 });
        showToast("Assignment updated");
      } else {
        await createAssignment({ classOfferingId: selectedClass, title: form.title, description: form.description || undefined, submissionType: form.submissionType, deadline: new Date(form.deadline).toISOString(), maxScore: parseFloat(form.maxScore) || 100, termId: selectedTermId ?? undefined });
        showToast("Assignment created");
      }
      setShowForm(false);
      await loadAssignments(selectedClass);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
    finally { setSaving(false); }
  };

  const handlePublish = async (a: Assignment) => {
    try {
      const res = await publishAssignment(a.id);
      showToast(`Published — ${res.notified} students notified`);
      await loadAssignments(selectedClass);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const handleUnpublish = async (a: Assignment) => {
    try { await unpublishAssignment(a.id); showToast("Unpublished"); await loadAssignments(selectedClass); }
    catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const handleDelete = async (a: Assignment) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    try { await deleteAssignment(a.id); showToast("Deleted"); await loadAssignments(selectedClass); }
    catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const openSubmissions = async (a: Assignment) => {
    setViewingAssignment(a);
    setSubsLoading(true);
    try { const s = await listSubmissions(a.id); setSubmissions(s); }
    catch { setSubmissions([]); }
    finally { setSubsLoading(false); }
  };

  const handleGrade = async (sub: AssignmentSubmission) => {
    const score = parseFloat(gradeScore);
    if (isNaN(score)) { showToast("Enter a valid score", false); return; }
    try {
      await gradeSubmission(sub.id, { score, feedback: gradeFeedback || undefined });
      showToast("Graded");
      setGradingId(null);
      if (viewingAssignment) await openSubmissions(viewingAssignment);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const handleRelease = async (sub: AssignmentSubmission) => {
    try {
      await releaseSubmissionGrade(sub.id);
      showToast("Grade released to student");
      if (viewingAssignment) await openSubmissions(viewingAssignment);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const handleReleaseAll = async () => {
    if (!viewingAssignment) return;
    try {
      const res = await releaseAllGrades(viewingAssignment.id);
      showToast(`Released ${res.released} grade(s)`);
      await openSubmissions(viewingAssignment);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
  };

  const pagedSubs = submissions.slice((subPage - 1) * 10, subPage * 10);

  if (loading && assignments.length === 0) return <AssignmentsSkeleton />;

  return (
    <div className="page-wrapper">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 12, padding: "0.875rem 1.25rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: toast.ok ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}

      <PageHeader
        kicker="Coursework"
        title="Assignments"
        subtitle="Create, publish, and grade student assignments."
        icon={<FileText size={22} />}
        variant="dark"
        actions={(
          <button className="btn btn-primary" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 12 }}>
            <Plus size={14} strokeWidth={2.5} /> New Assignment
          </button>
        )}
      />

      {/* Class filter */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "0.875rem 1.5rem", marginBottom: "1.25rem", border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Filter by class</label>
        <Select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          style={{
            padding: "0.45rem 1.15rem",
            borderRadius: "9999px",
            border: "1.5px solid var(--primary-200)",
            background: "var(--primary-50)",
            color: "var(--primary-800)",
            fontWeight: 600,
            fontSize: "0.85rem",
            minWidth: 220
          }}
        >
          <option value="">All my classes</option>
          {offerings.map(o => <option key={o.id} value={o.id}>{offeringLabel(o)}</option>)}
        </Select>
        <TermSelector
          academicYearId={activeYearId || null}
          onTermChange={() => { /* re-fetch handled by useEffect dep */ }}
          style={{ marginLeft: 8 }}
        />
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <h3 className="card-title">{editing ? "Edit Assignment" : "New Assignment"}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Title *</label>
                <div className="input-field"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Chapter 3 Worksheet" /></div>
              </div>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Instructions for students…" style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div className="input-group">
                <label>Submission Type</label>
                <Select
                  value={form.submissionType}
                  onChange={e => setForm(f => ({ ...f, submissionType: e.target.value as SubmissionType }))}
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
                  <option value="file">File Upload</option>
                  <option value="text">Text Response</option>
                  <option value="none">No Submission (Info only)</option>
                </Select>
              </div>
              <div className="input-group">
                <label>Max Score</label>
                <div className="input-field"><input type="number" min={1} value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} /></div>
              </div>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Deadline *</label>
                <div className="input-field"><input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {saving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submissions panel */}
      {viewingAssignment && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h3 className="card-title">Submissions — {viewingAssignment.title}</h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--gray-500)" }}>
                {submissions.filter(s => s.status !== "pending").length} submitted · {submissions.filter(s => s.releasedAt).length} released
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary btn-sm" onClick={handleReleaseAll}>Release All Graded</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingAssignment(null)}>Close</button>
            </div>
          </div>
          {subsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray-400)", fontSize: "0.9rem" }}>No submissions yet.</div>
          ) : (
            <>
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th style={{ textAlign: "center" }}>Submitted</th>
                      <th style={{ textAlign: "center" }}>Score</th>
                      <th>Submission</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubs.map(sub => {
                      const isGrading = gradingId === sub.id;
                      return (
                        <tr key={sub.id}>
                          <td style={{ fontWeight: 600 }}>
                            {sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : sub.studentId.slice(0, 8)}
                            <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>{sub.student?.email}</div>
                          </td>
                          <td style={{ textAlign: "center" }}>{submissionBadge(sub)}</td>
                          <td style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--gray-500)" }}>
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {isGrading ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 160 }}>
                                <input type="number" min={0} max={viewingAssignment.maxScore} value={gradeScore} onChange={e => setGradeScore(e.target.value)} placeholder={`0–${viewingAssignment.maxScore}`} style={{ padding: "0.25rem 0.4rem", border: "1.5px solid var(--primary-400)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center", width: "100%" }} autoFocus />
                                <input value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} placeholder="Feedback (optional)" style={{ padding: "0.25rem 0.4rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.82rem", width: "100%" }} />
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                  <button className="btn btn-primary btn-sm" onClick={() => handleGrade(sub)} style={{ flex: 1 }}>Save</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setGradingId(null)}>✕</button>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontWeight: 700, color: sub.score != null ? (sub.score / viewingAssignment.maxScore >= 0.8 ? "var(--success)" : sub.score / viewingAssignment.maxScore >= 0.6 ? "var(--warning)" : "var(--danger)") : "var(--gray-400)" }}>
                                {sub.score != null ? `${sub.score}/${viewingAssignment.maxScore}` : "—"}
                              </span>
                            )}
                          </td>
                          <td>
                            {sub.file ? (
                              <a href="#" onClick={(e) => { e.preventDefault(); void openFile(sub.file!.id); }} style={{ fontSize: "0.82rem", color: "var(--primary-600)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                {sub.file.filename}
                              </a>
                            ) : sub.textContent ? (
                              <div style={{ fontSize: "0.82rem", color: "var(--gray-600)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub.textContent}>{sub.textContent}</div>
                            ) : "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                              {sub.status !== "pending" && !isGrading && (
                                <button className="btn btn-outline btn-sm" onClick={() => { setGradingId(sub.id); setGradeScore(sub.score != null ? String(sub.score) : ""); setGradeFeedback(sub.feedback ?? ""); }}>
                                  {sub.score != null ? "Re-grade" : "Grade"}
                                </button>
                              )}
                              {sub.score != null && !sub.releasedAt && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleRelease(sub)}>Release</button>
                              )}
                              {sub.releasedAt && <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Released</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {submissions.length > 10 && (
                <div style={{ padding: "0.5rem 1rem" }}>
                  <TablePagination total={submissions.length} page={subPage} rowsPerPage={10} onPageChange={setSubPage} onRowsPerPageChange={() => {}} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Assignment list */}
      {loading ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "3rem", textAlign: "center", border: "1.5px solid var(--gray-100)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<FileText size={26} />}
          title="No assignments yet"
          description="Click 'New Assignment' to create your first one."
          action={<button className="btn btn-primary" onClick={openCreate} style={{ borderRadius: 12 }}>+ New Assignment</button>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {assignments.map(a => {
            const deadlineDate = new Date(a.deadline);
            const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000);
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: 16, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", padding: "1.25rem 1.5rem", flexWrap: "wrap" }}>
                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: a.published ? "var(--primary-50)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a.published ? "var(--primary-500)" : "var(--gray-400)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>{a.title}</span>
                      {statusBadge(a)}
                      <span className={`badge ${a.submissionType === "file" ? "badge-primary" : a.submissionType === "text" ? "badge-warning" : ""}`} style={{ fontSize: "0.7rem" }}>{a.submissionType}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      {a.subject && <span>{a.subject.name}</span>}
                      {a.grade && a.section && <span>{a.grade.name} - {a.section.name}</span>}
                      <span style={{ color: a.isOverdue ? "var(--danger)" : daysLeft <= 3 ? "var(--warning)" : "var(--gray-500)" }}>
                        Due {deadlineDate.toLocaleDateString()} {!a.isOverdue && daysLeft >= 0 && `(${daysLeft}d left)`}
                      </span>
                      <span>Max: {a.maxScore} pts</span>
                    </div>
                    {a.description && <div style={{ fontSize: "0.8rem", color: "var(--gray-400)", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>{a.description}</div>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openSubmissions(a)} style={{ borderRadius: 8 }}>
                      Submissions
                    </button>
                    {!a.published ? (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)} style={{ borderRadius: 8 }}>Edit</button>
                        <button className="btn btn-primary btn-sm" onClick={() => handlePublish(a)} style={{ borderRadius: 8 }}>Publish</button>
                        <button className="btn btn-sm" style={{ background: "var(--danger-light)", color: "var(--danger)", border: "none", cursor: "pointer", borderRadius: 8, padding: "0.3rem 0.6rem", fontSize: "0.8rem" }} onClick={() => handleDelete(a)}>Delete</button>
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleUnpublish(a)} style={{ borderRadius: 8 }}>Unpublish</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
