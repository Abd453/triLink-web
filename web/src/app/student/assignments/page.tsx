"use client";
import { useState, useEffect, useCallback } from "react";
import { listAssignmentsForStudent, submitAssignment, type Assignment } from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";
import { getFileUrl, getApiBase, openFile } from "@/lib/api";
import { authFetch } from "@/lib/auth";

function statusColor(a: Assignment) {
  if (!a.submission || a.submission.status === "pending") {
    if (a.isOverdue) return "var(--danger)";
    return "var(--warning)";
  }
  if (a.submission.status === "returned") return "var(--success)";
  if (a.submission.status === "graded") return "var(--primary-600)";
  return "var(--primary-500)";
}

function statusLabel(a: Assignment) {
  if (!a.submission || a.submission.status === "pending") return a.isOverdue ? "Overdue" : "Pending";
  if (a.submission.status === "submitted") return "Submitted";
  if (a.submission.status === "graded") return "Graded";
  if (a.submission.status === "returned") return "Returned";
  return a.submission.status;
}

export default function StudentAssignments() {
  const me = getStoredUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Submit state
  const [textContent, setTextContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    try {
      const list = await listAssignmentsForStudent(me.id);
      setAssignments(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [me?.id]);

  useEffect(() => { void load(); }, [load]);

  const handleFileSubmit = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch(`${getApiBase()}/api/files/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const uploaded = await res.json();
      await submitAssignment(selected.id, { fileId: uploaded.id });
      showToast("Assignment submitted!");
      setSelected(null);
      await load();
    } catch (e) { showToast(e instanceof Error ? e.message : "Upload failed", false); }
    finally { setUploading(false); }
  };

  const handleTextSubmit = async () => {
    if (!selected || !textContent.trim()) { showToast("Write your response first", false); return; }
    setSubmitting(true);
    try {
      await submitAssignment(selected.id, { textContent: textContent.trim() });
      showToast("Assignment submitted!");
      setTextContent("");
      setSelected(null);
      await load();
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", false); }
    finally { setSubmitting(false); }
  };

  const pending = assignments.filter(a => !a.submission || a.submission.status === "pending");
  const submitted = assignments.filter(a => a.submission && a.submission.status !== "pending");

  return (
    <div className="page-wrapper">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 8, padding: "0.85rem 1.25rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, fontWeight: 600, fontSize: "0.9rem" }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            My Assignments
          </h1>
          <p className="page-subtitle">View and submit your assignments</p>
        </div>
      </div>

      {/* Assignment detail / submit panel */}
      {selected && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">{selected.title}</h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--gray-500)" }}>
                Due {new Date(selected.deadline).toLocaleString()} · Max {selected.maxScore} pts
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(null); setTextContent(""); }}>Close</button>
          </div>
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {selected.description && (
              <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "0.85rem 1rem", fontSize: "0.9rem", color: "var(--gray-700)", lineHeight: 1.6 }}>
                {selected.description}
              </div>
            )}

            {/* Teacher attachment */}
            {selected.attachment && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--primary-50)", borderRadius: 8, border: "1.5px solid var(--primary-100)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{selected.attachment.filename}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>Attached by teacher</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => void openFile(selected.attachment!.id)}>Open File</button>
              </div>
            )}

            {/* Already submitted */}
            {selected.submission && selected.submission.status !== "pending" ? (
              <div style={{ background: "#f0fdf4", border: "1.5px solid var(--success)", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: "0.5rem" }}>✓ Submitted {selected.submission.submittedAt ? new Date(selected.submission.submittedAt).toLocaleString() : ""}</div>
                {selected.submission.file && (
                  <a href="#" onClick={(e) => { e.preventDefault(); void openFile(selected.submission!.file!.id); }} style={{ fontSize: "0.85rem", color: "var(--primary-600)", fontWeight: 600 }}>
                    📎 {selected.submission.file.filename}
                  </a>
                )}
                {selected.submission.textContent && (
                  <div style={{ fontSize: "0.85rem", color: "var(--gray-700)", marginTop: "0.5rem", background: "#fff", padding: "0.65rem", borderRadius: 6 }}>{selected.submission.textContent}</div>
                )}
                {selected.submission.releasedAt && selected.submission.score != null && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#fff", borderRadius: 8, border: "1px solid var(--gray-200)" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--primary-600)" }}>Score: {selected.submission.score} / {selected.maxScore}</div>
                    {selected.submission.feedback && <div style={{ fontSize: "0.85rem", color: "var(--gray-600)", marginTop: "0.35rem" }}>💬 {selected.submission.feedback}</div>}
                  </div>
                )}
              </div>
            ) : selected.isOverdue ? (
              <div style={{ background: "#fff5f5", border: "1.5px solid var(--danger)", borderRadius: 8, padding: "1rem", color: "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>
                ⚠ Deadline has passed. Submissions are no longer accepted.
              </div>
            ) : selected.submissionType === "none" ? (
              <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "1rem", color: "var(--gray-500)", fontSize: "0.9rem" }}>
                This assignment does not require a submission.
              </div>
            ) : selected.submissionType === "file" ? (
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>Upload your work</label>
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem", border: "2px dashed var(--primary-300)", borderRadius: 8, cursor: "pointer", background: "var(--primary-50)", transition: "background 0.15s" }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSubmit(f); }}>
                  {uploading ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  )}
                  <span style={{ fontWeight: 600, color: "var(--primary-600)", fontSize: "0.9rem" }}>{uploading ? "Uploading…" : "Click or drag & drop your file"}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>PDF, DOCX, images up to 10MB</span>
                  <input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSubmit(f); }} disabled={uploading} />
                </label>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>Your Response</label>
                <textarea value={textContent} onChange={e => setTextContent(e.target.value)} rows={6} placeholder="Write your answer here…" style={{ width: "100%", padding: "0.75rem 1rem", border: "1.5px solid var(--gray-200)", borderRadius: 8, fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                <button className="btn btn-primary" onClick={handleTextSubmit} disabled={submitting || !textContent.trim()} style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {submitting && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                  {submitting ? "Submitting…" : "Submit Response"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
      ) : assignments.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--gray-400)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📋</div>
          <div style={{ fontWeight: 600 }}>No assignments yet</div>
          <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Your teacher will post assignments here.</div>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Pending ({pending.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {pending.map(a => {
                  const daysLeft = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={a.id} className="card" style={{ cursor: "pointer", border: selected?.id === a.id ? "2px solid var(--primary-400)" : undefined }} onClick={() => setSelected(a)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.85rem 1.25rem", flexWrap: "wrap" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: a.isOverdue ? "var(--danger-light)" : "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a.isOverdue ? "var(--danger)" : "var(--primary-500)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>{a.title}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                            {a.subject && <span>{a.subject.name}</span>}
                            {a.teacher && <span>{a.teacher.firstName} {a.teacher.lastName}</span>}
                            <span style={{ color: a.isOverdue ? "var(--danger)" : daysLeft <= 2 ? "var(--warning)" : "var(--gray-500)", fontWeight: 600 }}>
                              {a.isOverdue ? "Overdue" : `Due in ${daysLeft}d`} · {new Date(a.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: statusColor(a), background: a.isOverdue ? "var(--danger-light)" : "var(--primary-50)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>{statusLabel(a)}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {submitted.length > 0 && (
            <div>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Submitted ({submitted.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {submitted.map(a => (
                  <div key={a.id} className="card" style={{ cursor: "pointer", opacity: 0.85 }} onClick={() => setSelected(a)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.85rem 1.25rem", flexWrap: "wrap" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>{a.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                          {a.subject && <span>{a.subject.name}</span>}
                          {a.submission?.submittedAt && <span>Submitted {new Date(a.submission.submittedAt).toLocaleDateString()}</span>}
                          {a.submission?.releasedAt && a.submission.score != null && (
                            <span style={{ fontWeight: 700, color: "var(--primary-600)" }}>Score: {a.submission.score}/{a.maxScore}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: statusColor(a), background: "#f0fdf4", padding: "0.2rem 0.6rem", borderRadius: 20, flexShrink: 0 }}>{statusLabel(a)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
