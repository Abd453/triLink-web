"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Layers3, Sparkles, Users, Search } from "lucide-react";
import { type PublicUser, listUsers, patchUser, listGrades, getSectionsForGrade, assignStudentsToSection, clearStudentsSection, getActiveAcademicYear } from "@/lib/admin-api";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/ui";

function StudentsSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={3} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

type EditState = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  gradeName?: string | null;
  sectionName?: string | null;
};

export default function AdminStudents() {
  const [rows, setRows] = useState<PublicUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  // Edit modal
  const [editState, setEditState] = useState<EditState | null>(null);
  const [gradeList, setGradeList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | "">("");
  const [sectionList, setSectionList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | "">("");
  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setLoading(true);
    setErr(null);
    listUsers("student")
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [grades, active] = await Promise.all([listGrades(), getActiveAcademicYear().catch(() => null)]);
        setGradeList(grades || []);
        setActiveYearId(active?.id ?? null);
      } catch (e) {
        // ignore errors, grade/section selects will be empty
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedGradeId) {
      setSectionList([]);
      setSelectedSectionId("");
      return;
    }
    let mounted = true;
    void (async () => {
      try {
        const secs = await getSectionsForGrade(selectedGradeId);
        if (mounted) setSectionList(secs || []);
      } catch (e) {
        if (mounted) setSectionList([]);
      }
    })();
    return () => { mounted = false; };
  }, [selectedGradeId]);

  // Derived filter options
  const gradeOptions = useMemo(() => {
    const vals = Array.from(new Set(rows.map((r) => r.grade).filter(Boolean) as string[])).sort();
    return vals;
  }, [rows]);

  const sectionOptions = useMemo(() => {
    const base = gradeFilter ? rows.filter((r) => r.grade === gradeFilter) : rows;
    const vals = Array.from(new Set(base.map((r) => r.section).filter(Boolean) as string[])).sort();
    return vals;
  }, [rows, gradeFilter]);

  // Filtered rows
  const filtered = useMemo(() => {
    const qLow = q.toLowerCase();
    return rows.filter((s) => {
      if (q && !`${s.firstName} ${s.lastName}`.toLowerCase().includes(qLow) && !s.email.toLowerCase().includes(qLow)) return false;
      if (gradeFilter && s.grade !== gradeFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      return true;
    });
  }, [rows, q, gradeFilter, sectionFilter]);

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const visibleRows = filtered.slice(startIdx, endIdx);

  const withGrade = rows.filter((s) => !!s.grade).length;
  const withSection = rows.filter((s) => !!s.section).length;

  const openEdit = (s: PublicUser) => {
    setSaveErr(null);
    setEditState({ id: s.id, firstName: s.firstName, lastName: s.lastName, phone: s.phone ?? "", gradeName: s.grade ?? null, sectionName: s.section ?? null });
    // pre-select grade/section ids when possible
    const g = gradeList.find((g) => g.name === s.grade);
    if (g) {
      setSelectedGradeId(g.id);
      // sections will be loaded by effect and we can set selectedSectionId after load
      const sec = sectionList.find((x) => x.name === s.section);
      if (sec) setSelectedSectionId(sec.id);
    } else {
      setSelectedGradeId("");
      setSelectedSectionId("");
    }
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await patchUser(editState.id, {
        firstName: editState.firstName,
        lastName: editState.lastName,
        phone: editState.phone || null,
      });
      let newRow = updated;

      // If admin selected a new grade/section, require both and call assignStudentsToSection
      if (selectedGradeId && !selectedSectionId) {
        setSaveErr("Please select a section for the chosen grade.");
        setSaving(false);
        return;
      }
      if (selectedSectionId === "__CLEAR__") {
        try {
          const res = await clearStudentsSection({ studentIds: [editState.id] });
          newRow = { ...newRow, grade: null, section: null } as PublicUser;
          showToast(`Cleared section for ${res.studentsCleared} student(s)`);
        } catch (e) {
          setSaveErr(e instanceof Error ? e.message : "Failed to clear student section");
          setSaving(false);
          return;
        }
      } else if (selectedGradeId && selectedSectionId) {
        try {
          const res = await assignStudentsToSection({ academicYearId: activeYearId ?? undefined, gradeId: selectedGradeId, sectionId: selectedSectionId, studentIds: [editState.id] });
          // find updated student info
          const updatedInfo = res.updatedStudents?.find((u) => u.id === editState.id);
          if (updatedInfo) {
            newRow = { ...newRow, grade: updatedInfo.grade ?? newRow.grade, section: updatedInfo.section ?? newRow.section } as PublicUser;
          }
          showToast("Student updated and assigned to section");
        } catch (e) {
          setSaveErr(e instanceof Error ? e.message : "Failed to assign student to section");
          setSaving(false);
          return;
        }
      } else {
        showToast("Student updated successfully");
      }

      setRows((prev) => prev.map((r) => (r.id === newRow.id ? newRow : r)));
      setEditState(null);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && rows.length === 0) {
    return <StudentsSkeleton />;
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--gray-200)",
    fontSize: "0.9rem",
    outline: "none",
    background: "var(--gray-50)",
    width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--gray-200)",
    fontSize: "0.9rem",
    outline: "none",
    background: "var(--gray-50)",
    cursor: "pointer",
  };

  return (
    <div className="page-wrapper">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "var(--success, #22c55e)", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Learner Directory"
        title="Students"
        subtitle="Directory of enrolled students."
        icon={<GraduationCap size={22} />}
        actions={(
          <Link href="/admin/registration?from=students" className="btn btn-primary" style={{ borderRadius: 12 }}>+ Register</Link>
        )}
      />

      <div className="stats-grid admin-dash-stats-grid">
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon blue">
            <Users size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Total students</div>
            <div className="stat-value">{rows.length}</div>
            <div className="admin-dash-stat-note">Enrolled learners</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon teal">
            <GraduationCap size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">With grade</div>
            <div className="stat-value">{withGrade}</div>
            <div className="admin-dash-stat-note">Graded students</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon orange">
            <Layers3 size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">With section</div>
            <div className="stat-value">{withSection}</div>
            <div className="admin-dash-stat-note">Section assignments</div>
          </div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1rem", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search name or email…"
            style={{
              padding: "0.75rem 1rem 0.75rem 2.75rem",
              borderRadius: "20px",
              border: "1.5px solid var(--gray-300)",
              backgroundColor: "var(--gray-50)",
              fontSize: "0.95rem",
              width: "100%",
              outline: "none",
              transition: "all 0.2s ease",
              color: "var(--gray-800)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--primary-400)";
              e.target.style.backgroundColor = "#fff";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--gray-300)";
              e.target.style.backgroundColor = "var(--gray-50)";
            }}
          />
        </div>
        <Select
          value={gradeFilter}
          onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(""); setPage(0); }}
          style={{
            padding: "0.65rem 1.75rem 0.65rem 1rem",
            borderRadius: "20px",
            border: "1.5px solid var(--primary-200)",
            backgroundColor: "var(--primary-50)",
            color: "var(--primary-800)",
            fontWeight: 600,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All grades</option>
          {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        <Select
          value={sectionFilter}
          onChange={(e) => { setSectionFilter(e.target.value); setPage(0); }}
          style={{
            padding: "0.65rem 1.75rem 0.65rem 1rem",
            borderRadius: "20px",
            border: "1.5px solid var(--primary-200)",
            backgroundColor: "var(--primary-50)",
            color: "var(--primary-800)",
            fontWeight: 600,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All sections</option>
          {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Grade</th>
                <th>Section</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--gray-500)" }}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--gray-500)" }}>No students found.</td>
                </tr>
              ) : (
                visibleRows.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</td>
                    <td>{s.email}</td>
                    <td>{s.grade ?? "—"}</td>
                    <td>{s.section ?? "—"}</td>
                    <td>{s.phone ?? "—"}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={total}
          page={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        />
      </div>

      {/* Edit Modal */}
      {editState && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9998, padding: "1rem" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div className="modal" style={{ maxWidth: 420, width: "100%", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem" }}>Edit student</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                First name
                <input
                  value={editState.firstName}
                  onChange={(e) => setEditState((s) => s ? { ...s, firstName: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Last name
                <input
                  value={editState.lastName}
                  onChange={(e) => setEditState((s) => s ? { ...s, lastName: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Phone
                <input
                  value={editState.phone}
                  onChange={(e) => setEditState((s) => s ? { ...s, phone: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                  placeholder="Optional"
                />
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Grade
                <select
                  value={selectedGradeId}
                  onChange={(e) => { setSelectedGradeId(e.target.value); setSelectedSectionId(""); }}
                  style={{ ...selectStyle, marginTop: 4 }}
                >
                  <option value="">(Unchanged)</option>
                  {gradeList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Section
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  style={{ ...selectStyle, marginTop: 4 }}
                  disabled={!selectedGradeId}
                >
                  <option value="">(Unchanged)</option>
                  <option value="__CLEAR__">(Clear section)</option>
                  {sectionList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            {saveErr && <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginTop: "0.75rem" }}>{saveErr}</div>}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditState(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
