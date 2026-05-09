"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Plus, Trash2, Users, Search, AlertCircle, X } from "lucide-react";
import {
  getActiveAcademicYear,
  listAcademicYears,
  listGrades,
  listSections,
  listUsers,
  listHomeroomAssignments,
  assignHomeroom,
  removeHomeroomAssignment,
  type HomeroomAssignmentRow,
  type AcademicYear,
  type Grade,
  type Section,
  type PublicUser,
} from "@/lib/admin-api";
import { PageHeader } from "@/components/ui";

export default function AdminHomeroomPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<PublicUser[]>([]);
  const [assignments, setAssignments] = useState<HomeroomAssignmentRow[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ teacherId: "", gradeId: "", sectionId: "" });
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<HomeroomAssignmentRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [yearsRes, activeYear, gradesRes, sectionsRes, teachersRes] = await Promise.all([
          listAcademicYears(),
          getActiveAcademicYear(),
          listGrades(),
          listSections(),
          listUsers("teacher"),
        ]);
        if (cancelled) return;
        setYears(yearsRes);
        setGrades(gradesRes);
        setSections(sectionsRes);
        setTeachers(teachersRes);
        const initial = activeYear?.id ?? yearsRes[0]?.id ?? "";
        setSelectedYearId(initial);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to bootstrap");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!selectedYearId) return;
    try {
      const rows = await listHomeroomAssignments(selectedYearId);
      setAssignments(rows);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load assignments", false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const gradeMap = useMemo(() => new Map(grades.map((g) => [g.id, g])), [grades]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const t = teacherMap.get(a.teacherId);
      const g = gradeMap.get(a.gradeId);
      const s = sectionMap.get(a.sectionId);
      const name = `${t?.firstName ?? ""} ${t?.lastName ?? ""}`.toLowerCase();
      const gn = (a.gradeName || g?.name || "").toLowerCase();
      const sn = (a.sectionName || s?.name || "").toLowerCase();
      return name.includes(q) || gn.includes(q) || sn.includes(q);
    });
  }, [assignments, teacherMap, gradeMap, sectionMap, query]);

  async function handleCreate() {
    if (!form.teacherId || !form.gradeId || !form.sectionId || !selectedYearId) {
      showToast("Select teacher, grade, and section", false);
      return;
    }
    setSubmitting(true);
    try {
      await assignHomeroom({
        teacherId: form.teacherId,
        academicYearId: selectedYearId,
        gradeId: form.gradeId,
        sectionId: form.sectionId,
      });
      showToast("Homeroom assigned");
      setShowCreate(false);
      setForm({ teacherId: "", gradeId: "", sectionId: "" });
      void loadAssignments();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to assign", false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await removeHomeroomAssignment(confirmDelete.id);
      showToast("Assignment removed");
      setConfirmDelete(null);
      void loadAssignments();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to remove", false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="admin-skeleton shimmer" style={{ height: 120, borderRadius: 18, marginBottom: 16 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="admin-skeleton shimmer" style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (err) {
    return (
      <div className="page-wrapper">
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 14, padding: "1.25rem 1.5rem", color: "#991b1b" }}>
          <strong>Error:</strong> {err}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="Homeroom Assignments"
        title="Manage Homeroom Teachers"
        subtitle="Assign one homeroom teacher per grade · section · academic year."
        icon={<Home size={22} />}
        actions={(
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> New Assignment
          </button>
        )}
      />

      {/* Filter bar */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid var(--gray-100)",
          padding: "0.85rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Year:
          </span>
          <NativeSelect
            value={selectedYearId}
            onChange={(v) => setSelectedYearId(v)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}{y.isActive ? " (Active)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
          <Search size={14} color="var(--gray-400)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by teacher, grade, or section…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.88rem",
              background: "transparent",
              color: "var(--gray-800)",
            }}
          />
        </div>
        <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>
          {filteredAssignments.length} of {assignments.length}
        </span>
      </div>

      {/* List */}
      {filteredAssignments.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1.5px dashed var(--gray-200)",
            padding: "2.5rem",
            textAlign: "center",
            color: "var(--gray-500)",
          }}
        >
          <Users size={36} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
          <div style={{ fontSize: "0.95rem" }}>
            {query ? "No assignments match your search." : "No homeroom assignments yet. Click 'New Assignment' to start."}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1.5px solid var(--gray-100)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 1fr auto",
              padding: "0.75rem 1.25rem",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "var(--gray-50)",
              borderBottom: "1px solid var(--gray-100)",
            }}
          >
            <span>Teacher</span>
            <span>Grade</span>
            <span>Section</span>
            <span style={{ width: 80, textAlign: "right" }}>Actions</span>
          </div>
          {filteredAssignments.map((row, i) => {
            const t = teacherMap.get(row.teacherId);
            const g = gradeMap.get(row.gradeId);
            const s = sectionMap.get(row.sectionId);
            const teacherName = t
              ? `${t.firstName} ${t.lastName}`
              : row.teacherName || row.teacherId.slice(0, 8);
            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr auto",
                  alignItems: "center",
                  padding: "0.9rem 1.25rem",
                  borderBottom: i < filteredAssignments.length - 1 ? "1px solid var(--gray-100)" : "none",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "var(--gray-900)", fontSize: "0.93rem" }}>
                    {teacherName}
                  </div>
                  {t?.email && (
                    <div style={{ fontSize: "0.76rem", color: "var(--gray-500)" }}>{t.email}</div>
                  )}
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--gray-700)" }}>{row.gradeName || g?.name || "—"}</div>
                <div style={{ fontSize: "0.88rem", color: "var(--gray-700)" }}>{row.sectionName || s?.name || "—"}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", width: 80 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    title="Remove assignment"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "0.4rem 0.6rem",
                      borderRadius: 8,
                      background: "transparent",
                      color: "var(--danger)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: "1px solid var(--gray-200)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Assign Homeroom Teacher" onClose={() => setShowCreate(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Academic Year">
              <NativeSelect value={selectedYearId} onChange={(v) => setSelectedYearId(v)}>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Teacher">
              <NativeSelect value={form.teacherId} onChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}>
                <option value="">Select teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}{t.subject ? " · " + t.subject : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Grade">
              <NativeSelect value={form.gradeId} onChange={(v) => setForm((f) => ({ ...f, gradeId: v }))}>
                <option value="">Select grade…</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Section">
              <NativeSelect value={form.sectionId} onChange={(v) => setForm((f) => ({ ...f, sectionId: v }))}>
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="btn btn-primary"
                disabled={submitting || !form.teacherId || !form.gradeId || !form.sectionId}
              >
                {submitting ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Modal title="Remove Assignment?" onClose={() => setConfirmDelete(null)}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: "0.9rem", color: "var(--gray-700)", margin: 0, lineHeight: 1.5 }}>
              The teacher will no longer be the homeroom for this class. Students will remain enrolled, but no
              homeroom remarks can be added until a new teacher is assigned.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn" style={{ background: "var(--danger)", color: "#fff" }}>
              Remove
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: toast.ok ? "var(--success)" : "var(--danger)",
            color: "#fff",
            padding: "0.75rem 1.25rem",
            borderRadius: 10,
            fontSize: "0.88rem",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 9999,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "0.5rem 0.75rem",
        borderRadius: 8,
        border: "1.5px solid var(--gray-200)",
        background: "#fff",
        color: "var(--gray-800)",
        fontSize: "0.88rem",
        outline: "none",
        cursor: "pointer",
        minWidth: 140,
      }}
    >
      {children}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--gray-500)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
