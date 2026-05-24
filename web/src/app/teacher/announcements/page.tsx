"use client";

import { useCallback, useEffect, useState } from "react";
import Select from "@/components/Select";
import TermSelector from "@/components/TermSelector";
import {
  announcementsForMe,
  createAnnouncement,
  getActiveAcademicYear,
  listMyClassOfferings as listOfferings,
  listTerms,
  type Announcement,
  type ClassOffering,
  type TermRow,
} from "@/lib/admin-api";
import { useTermStore } from "@/store/termStore";
import { PageHeader } from "@/components/ui";
import { Megaphone, Plus } from "lucide-react";

function offeringLabel(o: ClassOffering) {
  let gradeStr = "";
  if (o.gradeName) gradeStr = "Grade " + o.gradeName;
  else if ((o as any).grade?.name) gradeStr = "Grade " + (o as any).grade.name;
  else if ((o as any).class?.name) gradeStr = (o as any).class.name;

  const subj = o.subjectName || (o as any).subject?.name || "";
  const sec = o.sectionName || (o as any).section?.name || "";
  if (subj && sec) return gradeStr ? `${gradeStr} | ${subj} - ${sec}` : `${subj} - ${sec}`;
  return o.displayName || o.name?.trim() || "Untitled Class";
}

function TeacherAnnouncementsSkeleton() {
  return (
    <div className="page-wrapper">
      <div className="page-header admin-dash-skeleton-block">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div className="admin-skeleton shimmer" style={{ width: 160, height: 12, marginBottom: 12 }} />
          <div className="admin-skeleton shimmer" style={{ width: "70%", height: 28, marginBottom: 8 }} />
          <div className="admin-skeleton shimmer" style={{ width: "55%", height: 12 }} />
        </div>
        <div className="admin-skeleton shimmer" style={{ width: 160, height: 40, borderRadius: 10 }} />
      </div>
      <div className="card admin-dash-skeleton-block">
        <div className="admin-skeleton shimmer" style={{ width: 200, height: 14, marginBottom: 16 }} />
        <div className="admin-skeleton shimmer" style={{ width: "100%", height: 200, borderRadius: 12 }} />
      </div>
    </div>
  );
}

export default function TeacherAnnouncements() {
  const { selectedTermId } = useTermStore();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string[]>(["students"]);
  const [isClassMode, setIsClassMode] = useState(false);
  const [targetGrade, setTargetGrade] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [classOfferingId, setClassOfferingId] = useState("");
  const [announcementTermId, setAnnouncementTermId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [ann, year] = await Promise.all([announcementsForMe(selectedTermId ?? undefined), getActiveAcademicYear()]);
      setRows(ann);
      setYearId(year?.id ?? null);
      if (year?.id) {
        const mine = await listOfferings(year.id);
        const yearTerms = await listTerms(year.id);
        setTerms(yearTerms);
        const grades = new Set<string>();
        const sects = new Set<string>();
        mine.forEach((o: any) => {
          const g = o.gradeName || o.grade?.name;
          const s = o.sectionName || o.section?.name;
          if (g) grades.add(g);
          if (s) sects.add(s);
        });
        setAvailableGrades(Array.from(grades).sort());
        setAvailableSections(Array.from(sects).sort());
        setOfferings(mine);
        setClassOfferingId((prev) => (prev && mine.some((o) => o.id === prev) ? prev : mine[0]?.id ?? ""));
        setAnnouncementTermId((prev) => prev || selectedTermId || yearTerms[0]?.id || "");
      } else {
        setOfferings([]);
        setTerms([]);
        setClassOfferingId("");
        setAnnouncementTermId("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTermId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) {
      showToast("Title and message are required.");
      return;
    }
    if (!yearId) {
      showToast("No active academic year. Ask an admin to activate one.");
      return;
    }
    if (isClassMode && !classOfferingId) {
      showToast("Pick a class for a class-scoped announcement.");
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement({
        academicYearId: yearId,
        title: title.trim(),
        body: body.trim(),
        audience: isClassMode ? "class" : (audience.length > 0 ? audience.join(",") : "all"),
        classOfferingId: isClassMode ? classOfferingId : undefined,
        targetGrade: !isClassMode && targetGrade ? targetGrade : undefined,
        targetSection: !isClassMode && targetSection ? targetSection : undefined,
        termId: announcementTermId || undefined,
      });
      setTitle("");
      setBody("");
      setAudience(["students"]);
      setIsClassMode(false);
      setTargetGrade("");
      setTargetSection("");
      setAnnouncementTermId(selectedTermId ?? "");
      setShowCreateModal(false);
      await load();
      showToast("Published.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading && rows.length === 0 && !err) {
    return <TeacherAnnouncementsSkeleton />;
  }

  return (
    <div className="page-wrapper">
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "1.25rem",
            right: "1.25rem",
            zIndex: 9999,
            background: "var(--gray-900)",
            color: "#fff",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            maxWidth: 320,
          }}
        >
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Communication"
        title="Announcements"
        subtitle="School-wide feed from the API · publish to your audiences"
        icon={<Megaphone size={22} />}
        variant="light"
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <TermSelector academicYearId={yearId} readOnly={false} />
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New announcement
            </button>
          </div>
        )}
      />

      {err && <div className="card" style={{ marginBottom: "1rem", color: "var(--danger)" }}>{err}</div>}

      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 640, margin: 0, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>
                Create announcement
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}>
                Close
              </button>
            </div>
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label>Title</label>
              <div className="input-field">
                <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label>Term Scope</label>
              <div className="input-field">
                <Select value={announcementTermId} onChange={(e) => setAnnouncementTermId(e.target.value)}>
                  <option value="">Global announcement</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>{term.name} · {new Date(term.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(term.endDate).toLocaleDateString([], { month: "short", day: "numeric" })}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label>Audience Target</label>
              
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", background: "var(--gray-50)", padding: "0.75rem 1rem", borderRadius: "12px", border: "1.5px solid var(--gray-200)" }}>
                 <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, cursor: "pointer" }}>
                    <input type="checkbox" checked={isClassMode} onChange={(e) => setIsClassMode(e.target.checked)} style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary-600)" }} />
                    Post to a specific class offering only
                 </label>
              </div>

              {!isClassMode && (
                <div style={{ background: "var(--gray-50)", padding: "1.25rem", borderRadius: "12px", border: "1.5px solid var(--gray-200)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 500 }}>
                      <input type="checkbox" checked={audience.includes("students")} onChange={(e) => setAudience(prev => e.target.checked ? [...prev, "students"] : prev.filter(x => x !== "students"))} style={{ width: "1rem", height: "1rem" }} /> Students
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 500 }}>
                      <input type="checkbox" checked={audience.includes("parents")} onChange={(e) => setAudience(prev => e.target.checked ? [...prev, "parents"] : prev.filter(x => x !== "parents"))} style={{ width: "1rem", height: "1rem" }} /> Parents
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 500 }}>
                      <input type="checkbox" checked={audience.includes("teachers")} onChange={(e) => setAudience(prev => e.target.checked ? [...prev, "teachers"] : prev.filter(x => x !== "teachers"))} style={{ width: "1rem", height: "1rem" }} /> Teachers
                    </label>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--gray-500)" }}>*If none are selected, message targets ALL roles.</p>

                  {(audience.includes("students") || audience.includes("parents") || audience.length === 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                       <div style={{ display: "grid", gap: "0.5rem" }}>
                         <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Target Grade (Optional)</label>
                         <Select value={targetGrade} onChange={(e) => setTargetGrade(e.target.value)} style={{ padding: "0.75rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "#fff" }}>
                           <option value="">Any Grade</option>
                           {availableGrades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                         </Select>
                       </div>
                       <div style={{ display: "grid", gap: "0.5rem" }}>
                         <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Target Section (Optional)</label>
                         <Select value={targetSection} onChange={(e) => setTargetSection(e.target.value)} style={{ padding: "0.75rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "#fff" }}>
                           <option value="">Any Section</option>
                           {availableSections.map((s) => <option key={s} value={s}>Section {s}</option>)}
                         </Select>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isClassMode && (
              <div className="input-group" style={{ marginBottom: "1rem" }}>
                <label>Class offering</label>
                <Select
                  value={classOfferingId}
                  onChange={(e) => setClassOfferingId(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    background: "var(--gray-50)",
                    border: "1.5px solid var(--gray-200)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.9rem",
                    width: "100%",
                  }}
                >
                  {offerings.length === 0 && <option value="">No offerings this year</option>}
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {offeringLabel(o)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label>Message</label>
              <textarea
                placeholder="Announcement body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--gray-50)",
                  border: "1.5px solid var(--gray-200)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  width: "100%",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => void handlePublish()} disabled={saving}>
                {saving ? "Publishing…" : "Publish"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>
          All announcements ({sorted.length})
        </h3>
        {loading ? (
          <p style={{ color: "var(--gray-500)" }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--gray-400)" }}>No announcements yet.</p>
        ) : (
          sorted.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.85rem 0.95rem",
                background: "var(--gray-50)",
                borderRadius: "var(--radius-md)",
                marginBottom: "0.5rem",
                gap: "0.75rem",
                border: "1px solid var(--gray-100)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{a.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", margin: "0.2rem 0" }}>
                  {a.audience === "class" && a.classOffering ? (
                    <span style={{ background: "var(--indigo-50)", color: "var(--indigo-700)", padding: "2px 6px", borderRadius: 4, marginRight: 8, fontSize: "0.7rem", fontWeight: 600 }}>
                      {a.classOffering.subject?.name} - {a.classOffering.class?.name}
                    </span>
                  ) : a.audience === "class" && a.classOfferingId ? (
                    <span style={{ background: "var(--indigo-50)", color: "var(--indigo-700)", padding: "2px 6px", borderRadius: 4, marginRight: 8, fontSize: "0.7rem", fontWeight: 600 }}>
                      Class Broadcast
                    </span>
                  ) : (
                    <span style={{ background: "var(--gray-100)", color: "var(--gray-700)", padding: "2px 6px", borderRadius: 4, marginRight: 8, fontSize: "0.7rem", fontWeight: 600, textTransform: "capitalize" }}>
                      {a.audience}
                    </span>
                  )}
                  {a.targetGrade && (
                    <span style={{ background: "var(--emerald-50)", color: "var(--emerald-700)", padding: "2px 6px", borderRadius: 4, marginRight: 8, fontSize: "0.7rem", fontWeight: 600 }}>
                      Grade {a.targetGrade}
                    </span>
                  )}
                  · {new Date(a.createdAt).toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--gray-600)",
                    marginTop: "0.25rem",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {a.body}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 640, width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selected.title}</h3>
              <button type="button" className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: "0.9rem", color: "var(--gray-700)" }}>
              <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "var(--gray-500)" }}>
                Audience: <strong>{selected.audience}</strong>
                {selected.classOfferingId ? ` · ${offeringLabel(offerings.find((o) => o.id === selected.classOfferingId) || ({ id: selected.classOfferingId } as ClassOffering))}` : ""}
                <br />
                {new Date(selected.createdAt).toLocaleString()}
              </p>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.body}</div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
