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
import { Megaphone, Plus, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const { selectedTermId } = useTermStore();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [fromDashboard, setFromDashboard] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("from") === "dashboard") {
        setFromDashboard(true);
      }
    }
  }, []);

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

      {fromDashboard && (
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard")}
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
            <span>Back to Dashboard</span>
          </button>
        </div>
      )}

      <PageHeader
        kicker="COMMUNICATION HUB"
        title="Announcements"
        subtitle="Create and manage broadcast messages for the school community."
        icon={<Megaphone size={22} />}
        variant="dark"
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
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-out"
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

      <div style={{
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid var(--gray-100)",
        padding: "2rem",
        boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
      }}>
        <h3 className="card-title" style={{ marginBottom: "1.5rem", fontWeight: 800 }}>
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
                padding: "1.25rem 1.5rem",
                background: "var(--gray-50)",
                borderRadius: 16,
                marginBottom: "0.75rem",
                gap: "0.75rem",
                border: "1.5px solid var(--gray-100)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease-in-out",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--primary-300)";
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.05)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--gray-100)";
                e.currentTarget.style.background = "var(--gray-50)";
                e.currentTarget.style.boxShadow = "none";
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
        <div 
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-out"
          }}
          onClick={() => setSelected(null)}
        >
          <div 
            style={{
              background: "#fff",
              borderRadius: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)", margin: 0, lineHeight: 1.25 }}>
                {selected.title}
              </h3>
              <button 
                type="button" 
                onClick={() => setSelected(null)} 
                style={{
                  background: "var(--gray-50)",
                  border: "1.5px solid var(--gray-150)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--gray-500)",
                  fontSize: "0.85rem",
                  transition: "all 0.15s ease",
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--gray-100)";
                  e.currentTarget.style.color = "var(--gray-700)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--gray-50)";
                  e.currentTarget.style.color = "var(--gray-500)";
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ fontSize: "0.9rem", color: "var(--gray-700)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {selected.audience === "class" && selected.classOffering ? (
                  <span style={{ background: "var(--indigo-50)", color: "var(--indigo-700)", padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>
                    {selected.classOffering.subject?.name} - {selected.classOffering.class?.name}
                  </span>
                ) : (
                  <span style={{ background: "var(--gray-100)", color: "var(--gray-700)", padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                    {selected.audience} Broadcast
                  </span>
                )}
                <span style={{ fontSize: "0.78rem", color: "var(--gray-400)", fontWeight: 500 }}>
                  · {new Date(selected.createdAt).toLocaleString()}
                </span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.95rem", color: "var(--gray-800)" }}>
                {selected.body}
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelected(null)}
                style={{ borderRadius: 12, padding: "0.55rem 1.25rem", fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
