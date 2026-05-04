"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, CalendarDays, Layers3, LayoutGrid, RefreshCcw, Sparkles } from "lucide-react";
import Select from "@/components/Select";
import {
  activateAcademicYear,
  addTerm,
  assignSectionsToGrade,
  assignSubjectsToGrade,
  closeAcademicYear,
  createAcademicYear,
  createGrade,
  createSection,
  createSubject,
  deleteAcademicYear,
  deleteGrade,
  deleteSection,
  deleteSubject,
  deleteTerm,
  getSectionsForGrade,
  getSubjectsForGrade,
  listAcademicYears,
  listGrades,
  listSections,
  listSubjects,
  listTerms,
  patchAcademicYear,
  patchGrade,
  patchSection,
  patchSubject,
  removeSectionFromGrade,
  removeSubjectFromGrade,
  rolloverAcademicYear,
  type AcademicYear,
  type Grade,
  type Section,
  type Subject,
  type TermRow,
} from "@/lib/admin-api";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, CardSkeleton } from "@/components/ui";
import { School } from "lucide-react";

function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function SchoolSetupSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div style={{ display: "grid", gap: "1rem" }}>
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={4} />)}
      </div>
    </div>
  );
}

export default function AdminSchoolSetup() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [termsYearId, setTermsYearId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newYear, setNewYear] = useState({ label: "", startDate: "", endDate: "", isActive: false });
  const [editYear, setEditYear] = useState<AcademicYear | null>(null);
  const [rolloverId, setRolloverId] = useState<string | null>(null);
  const [rolloverLabel, setRolloverLabel] = useState("");
  const [rolloverDry, setRolloverDry] = useState(true);

  const [termForm, setTermForm] = useState({ name: "", startDate: "", endDate: "" });

  const [gNew, setGNew] = useState({ name: "", orderIndex: "" });
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeForm, setGradeForm] = useState({
    name: "",
    orderIndex: "",
    selectedSections: [] as string[],
    newSections: [] as string[],
    selectedSubjects: [] as string[],
  });
  const [loadingGradeCreate, setLoadingGradeCreate] = useState(false);
  
  const [sNew, setSNew] = useState({ name: "" });
  const [subNew, setSubNew] = useState({ name: "", code: "" });

  const showT = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const loadStructure = useCallback(async () => {
    const [g, sec, subj] = await Promise.all([listGrades(), listSections(), listSubjects()]);
    setGrades(g);
    setSections(sec);
    setSubjects(subj);
  }, []);

  const loadYears = useCallback(async () => {
    const y = await listAcademicYears();
    setYears(y);
    setTermsYearId((prev) => {
      if (prev && y.some((a) => a.id === prev)) return prev;
      const active = y.find((a) => a.isActive && !a.isArchived);
      return active?.id ?? y[0]?.id ?? "";
    });
  }, []);

  const loadAll = useCallback(async () => {
    setErr(null);
    try {
      await Promise.all([loadYears(), loadStructure()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [loadYears, loadStructure]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!c) setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [loadAll]);

  useEffect(() => {
    if (!termsYearId) return;
    let c = false;
    (async () => {
      try {
        const t = await listTerms(termsYearId);
        if (!c) setTerms(t);
      } catch {
        if (!c) setTerms([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [termsYearId]);

  const refreshTerms = async () => {
    if (!termsYearId) return;
    setTerms(await listTerms(termsYearId));
  };

  const activeYears = years.filter((y) => y.isActive && !y.isArchived).length;
  const archivedYears = years.filter((y) => y.isArchived).length;

  const handleCreateYear = async () => {
    if (!newYear.label.trim() || !newYear.startDate || !newYear.endDate) {
      showT("Label and both dates are required.");
      return;
    }
    try {
      await createAcademicYear({
        label: newYear.label.trim(),
        startDate: newYear.startDate,
        endDate: newYear.endDate,
        isActive: newYear.isActive,
      });
      setNewYear({ label: "", startDate: "", endDate: "", isActive: false });
      await loadYears();
      showT("Academic year created.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Create failed");
    }
  };

  const handleSaveEditYear = async () => {
    if (!editYear) return;
    try {
      await patchAcademicYear(editYear.id, {
        label: editYear.label,
        startDate: editYear.startDate?.slice(0, 10),
        endDate: editYear.endDate?.slice(0, 10),
        isArchived: editYear.isArchived,
      });
      setEditYear(null);
      await loadYears();
      showT("Year updated.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleRollover = async () => {
    if (!rolloverId || !rolloverLabel.trim()) return;
    try {
      const r = await rolloverAcademicYear(rolloverId, rolloverLabel.trim(), rolloverDry);
      if (rolloverDry) {
        showT(`Dry run: would copy ${r.offeringsCopied} offering(s).`);
      } else {
        showT(`Rolled over: new year ${r.createdYearId?.slice(0, 8)}…, ${r.offeringsCopied} offering(s).`);
        setRolloverId(null);
        setRolloverLabel("");
        await loadYears();
      }
    } catch (e) {
      showT(e instanceof Error ? e.message : "Rollover failed");
    }
  };

  const handleAddTerm = async () => {
    if (!termsYearId || !termForm.name.trim() || !termForm.startDate || !termForm.endDate) {
      showT("Select a year and fill term name and dates.");
      return;
    }
    try {
      await addTerm(termsYearId, {
        name: termForm.name.trim(),
        startDate: termForm.startDate,
        endDate: termForm.endDate,
      });
      setTermForm({ name: "", startDate: "", endDate: "" });
      await refreshTerms();
      showT("Term added.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Add term failed");
    }
  };

  const toggleSection = (sectionId: string) => {
    setGradeForm((prev) => ({
      ...prev,
      selectedSections: prev.selectedSections.includes(sectionId)
        ? prev.selectedSections.filter((id) => id !== sectionId)
        : [...prev.selectedSections, sectionId],
    }));
  };

  const toggleGradeSubject = (subjectId: string) => {
    setGradeForm((prev) => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subjectId)
        ? prev.selectedSubjects.filter((id) => id !== subjectId)
        : [...prev.selectedSubjects, subjectId],
    }));
  };

  const addNewSection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (gradeForm.newSections.includes(trimmed)) {
      showT("Section name already in the list");
      return;
    }
    setGradeForm((prev) => ({
      ...prev,
      newSections: [...prev.newSections, trimmed],
    }));
  };

  const removeNewSection = (index: number) => {
    setGradeForm((prev) => ({
      ...prev,
      newSections: prev.newSections.filter((_, i) => i !== index),
    }));
  };

  const handleCreateGrade = async () => {
    if (!gradeForm.name.trim()) {
      showT("Grade name is required");
      return;
    }

    try {
      setLoadingGradeCreate(true);

      // 1. Create new sections first
      const newSectionIds: string[] = [];
      for (const sectionName of gradeForm.newSections) {
        const section = await createSection({ name: sectionName });
        newSectionIds.push(section.id);
      }

      // 2. Create grade with all section IDs
      const allSectionIds = [...gradeForm.selectedSections, ...newSectionIds];

      const oi = gradeForm.orderIndex.trim() ? parseInt(gradeForm.orderIndex, 10) : undefined;
      const newGrade = await createGrade({
        name: gradeForm.name.trim(),
        orderIndex: Number.isFinite(oi as number) ? oi : undefined,
        sectionIds: allSectionIds.length > 0 ? allSectionIds : undefined,
      });

      // 3. Assign subjects if any selected
      if (gradeForm.selectedSubjects.length > 0) {
        try {
          await assignSubjectsToGrade(newGrade.id, gradeForm.selectedSubjects);
        } catch {
          // Subject assignment failed — grade was still created
          showT(`Grade created but subject assignment failed. You can assign subjects from the grade edit panel.`);
          await loadStructure();
          setShowGradeModal(false);
          setGradeForm({ name: "", orderIndex: "", selectedSections: [], newSections: [], selectedSubjects: [] });
          return;
        }
      }

      // 4. Refresh and close
      await loadStructure();
      setShowGradeModal(false);
      setGradeForm({ name: "", orderIndex: "", selectedSections: [], newSections: [], selectedSubjects: [] });
      showT(`Grade created with ${allSectionIds.length} section(s)${gradeForm.selectedSubjects.length > 0 ? ` and ${gradeForm.selectedSubjects.length} subject(s)` : ""}`);
    } catch (e) {
      showT(e instanceof Error ? e.message : "Failed to create grade");
      console.error("Grade creation error:", e);
    } finally {
      setLoadingGradeCreate(false);
    }
  };

  if (loading && !years.length) {
    return <SchoolSetupSkeleton />;
  }

  return (
    <div className="page-wrapper">
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            background: "#fff",
            borderRadius: 14,
            padding: "1rem 1.5rem",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            border: "1.5px solid var(--success)",
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Foundation Workspace"
        title="School setup"
        subtitle="Academic years, terms, grades, sections, and subjects."
        icon={<School size={22} />}
        actions={(
          <button
            type="button"
            className="btn btn-secondary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try { await loadAll(); } finally { setRefreshing(false); }
            }}
            style={{ borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCcw size={14} style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none" }} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      />

      <div className="school-setup-summary-grid">
        <div className="card school-setup-summary-card">
          <div className="school-setup-summary-icon blue">
            <CalendarDays size={18} />
          </div>
          <div className="school-setup-summary-label">Academic years</div>
          <div className="school-setup-summary-value">{years.length}</div>
          <div className="school-setup-summary-note">{activeYears} active, {archivedYears} archived</div>
        </div>
        <div className="card school-setup-summary-card">
          <div className="school-setup-summary-icon teal">
            <LayoutGrid size={18} />
          </div>
          <div className="school-setup-summary-label">Terms</div>
          <div className="school-setup-summary-value">{terms.length}</div>
          <div className="school-setup-summary-note">For selected academic year</div>
        </div>
        <div className="card school-setup-summary-card">
          <div className="school-setup-summary-icon orange">
            <Layers3 size={18} />
          </div>
          <div className="school-setup-summary-label">Structure nodes</div>
          <div className="school-setup-summary-value">{grades.length + sections.length}</div>
          <div className="school-setup-summary-note">{grades.length} grades and {sections.length} sections</div>
        </div>
        <div className="card school-setup-summary-card">
          <div className="school-setup-summary-icon purple">
            <BookOpen size={18} />
          </div>
          <div className="school-setup-summary-label">Subjects</div>
          <div className="school-setup-summary-value">{subjects.length}</div>
          <div className="school-setup-summary-note">Curriculum catalog</div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}

      {/* Academic years */}
      <div className="card school-setup-card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title school-setup-section-title" style={{ marginBottom: "0.75rem" }}>
          <CalendarDays size={16} />
          Academic years
        </h3>
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem", maxWidth: 480 }}>
          <input
            placeholder="Label (e.g. 2025/2026)"
            value={newYear.label}
            onChange={(e) => setNewYear((n) => ({ ...n, label: e.target.value }))}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
          />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Start
              <input
                type="date"
                value={newYear.startDate}
                onChange={(e) => setNewYear((n) => ({ ...n, startDate: e.target.value }))}
                style={{ display: "block", marginTop: 4, padding: "0.35rem" }}
              />
            </label>
            <label style={{ fontSize: "0.85rem" }}>
              End
              <input
                type="date"
                value={newYear.endDate}
                onChange={(e) => setNewYear((n) => ({ ...n, endDate: e.target.value }))}
                style={{ display: "block", marginTop: 4, padding: "0.35rem" }}
              />
            </label>
          </div>
          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={newYear.isActive}
              onChange={(e) => setNewYear((n) => ({ ...n, isActive: e.target.checked }))}
            />
            Set as active year on create
          </label>
          <button type="button" className="btn btn-primary" onClick={handleCreateYear}>
            Create year
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {years.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--gray-500)" }}>
                    No years yet.
                  </td>
                </tr>
              ) : (
                years.map((y) => (
                  <tr key={y.id}>
                    <td>{y.label}</td>
                    <td>{toDateInput(y.startDate)}</td>
                    <td>{toDateInput(y.endDate)}</td>
                    <td>
                      {y.isArchived ? "archived" : y.isActive ? "active" : "—"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: 4 }}
                        disabled={y.isArchived}
                        onClick={async () => {
                          try {
                            await activateAcademicYear(y.id);
                            await loadYears();
                            showT("Activated.");
                          } catch (e) {
                            showT(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: 4 }}
                        disabled={y.isArchived}
                        onClick={async () => {
                          if (!confirm("Archive and deactivate this year?")) return;
                          try {
                            await closeAcademicYear(y.id);
                            await loadYears();
                            showT("Year closed/archived.");
                          } catch (e) {
                            showT(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Close
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ marginRight: 4 }} onClick={() => setEditYear({ ...y })}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: 4 }}
                        onClick={() => {
                          setRolloverId(y.id);
                          setRolloverLabel(`${y.label} (copy)`);
                          setRolloverDry(true);
                        }}
                      >
                        Rollover
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (!confirm("Delete this academic year? This may fail if data still references it.")) return;
                          try {
                            await deleteAcademicYear(y.id);
                            await loadYears();
                            showT("Deleted.");
                          } catch (e) {
                            showT(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms */}
      <div className="card school-setup-card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title school-setup-section-title" style={{ marginBottom: "0.75rem" }}>
          <LayoutGrid size={16} />
          Terms
        </h3>
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Academic year</label>
        <Select
          value={termsYearId}
          onChange={(e) => {
            const next = e.target.value;
            setTermsYearId(next);
            if (!next) setTerms([]);
          }}
          style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)", marginBottom: "1rem", minWidth: 220 }}
        >
          {years.length === 0 && <option value="">Create a year first</option>}
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </Select>
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem", maxWidth: 480 }}>
          <input
            placeholder="Term name"
            value={termForm.name}
            onChange={(e) => setTermForm((t) => ({ ...t, name: e.target.value }))}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
          />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input type="date" value={termForm.startDate} onChange={(e) => setTermForm((t) => ({ ...t, startDate: e.target.value }))} />
            <input type="date" value={termForm.endDate} onChange={(e) => setTermForm((t) => ({ ...t, endDate: e.target.value }))} />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddTerm} disabled={!termsYearId}>
            Add term
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {terms.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--gray-500)" }}>
                    No terms for this year.
                  </td>
                </tr>
              ) : (
                terms.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{toDateInput(t.startDate)}</td>
                    <td>{toDateInput(t.endDate)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (!confirm("Delete this term?")) return;
                          try {
                            await deleteTerm(t.id);
                            await refreshTerms();
                            showT("Term deleted.");
                          } catch (e) {
                            showT(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card school-setup-card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title school-setup-section-title" style={{ marginBottom: "0.75rem" }}>
          <Layers3 size={16} />
          Grades
        </h3>
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowGradeModal(true)}
            disabled={loading}
          >
            + Create Grade
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Order</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ padding: "2rem", textAlign: "center", color: "var(--gray-600)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      <div className="spinner" style={{ width: 16, height: 16, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      Loading grades...
                    </div>
                  </td>
                </tr>
              ) : grades.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-500)" }}>
                    No grades yet. Create one above.
                  </td>
                </tr>
              ) : (
                grades.map((g) => (
                  <GradeRow key={`${g.id}:${g.name}:${g.orderIndex ?? ""}`} g={g} allSections={sections} allSubjects={subjects} onSaved={loadStructure} showT={showT} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sections */}
      <div className="card school-setup-card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title school-setup-section-title" style={{ marginBottom: "0.75rem" }}>
          <LayoutGrid size={16} />
          Sections
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <input
            placeholder="Name (unique)"
            value={sNew.name}
            onChange={(e) => setSNew({ name: e.target.value })}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={async () => {
              if (!sNew.name.trim()) return;
              try {
                await createSection({ name: sNew.name.trim() });
                setSNew({ name: "" });
                await loadStructure();
                showT("Section created.");
              } catch (e) {
                showT(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            {loading ? "Loading..." : "Add"}
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} style={{ padding: "2rem", textAlign: "center", color: "var(--gray-600)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      <div className="spinner" style={{ width: 16, height: 16, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      Loading sections...
                    </div>
                  </td>
                </tr>
              ) : sections.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-500)" }}>
                    No sections yet. Create one above.
                  </td>
                </tr>
              ) : (
                sections.map((s) => (
                  <SectionRow key={`${s.id}:${s.name}`} s={s} onSaved={loadStructure} showT={showT} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subjects */}
      <div className="card school-setup-card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title school-setup-section-title" style={{ marginBottom: "0.75rem" }}>
          <BookOpen size={16} />
          Subjects
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <input
            placeholder="Name"
            value={subNew.name}
            onChange={(e) => setSubNew((u) => ({ ...u, name: e.target.value }))}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
            disabled={loading}
          />
          <input
            placeholder="Code (optional)"
            value={subNew.code}
            onChange={(e) => setSubNew((u) => ({ ...u, code: e.target.value }))}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={async () => {
              if (!subNew.name.trim()) return;
              try {
                await createSubject({ name: subNew.name.trim(), code: subNew.code.trim() || undefined });
                setSubNew({ name: "", code: "" });
                await loadStructure();
                showT("Subject created.");
              } catch (e) {
                showT(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            {loading ? "Loading..." : "Add"}
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ padding: "2rem", textAlign: "center", color: "var(--gray-600)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      <div className="spinner" style={{ width: 16, height: 16, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      Loading subjects...
                    </div>
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-500)" }}>
                    No subjects yet. Create one above.
                  </td>
                </tr>
              ) : (
                subjects.map((s) => (
                  <SubjectRow key={`${s.id}:${s.name}:${s.code ?? ""}`} s={s} onSaved={loadStructure} showT={showT} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editYear && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 420, width: "100%" }}>
            <h3 className="card-title" style={{ marginBottom: "0.75rem" }}>
              Edit academic year
            </h3>
            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>
              Label
              <input
                value={editYear.label}
                onChange={(e) => setEditYear((ey) => (ey ? { ...ey, label: e.target.value } : null))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.5rem" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>
              Start
              <input
                type="date"
                value={toDateInput(editYear.startDate)}
                onChange={(e) => setEditYear((ey) => (ey ? { ...ey, startDate: e.target.value } : null))}
                style={{ display: "block", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>
              End
              <input
                type="date"
                value={toDateInput(editYear.endDate)}
                onChange={(e) => setEditYear((ey) => (ey ? { ...ey, endDate: e.target.value } : null))}
                style={{ display: "block", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={!!editYear.isArchived}
                onChange={(e) => setEditYear((ey) => (ey ? { ...ey, isArchived: e.target.checked } : null))}
              />
              Archived
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditYear(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEditYear}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {rolloverId && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 420, width: "100%" }}>
            <h3 className="card-title" style={{ marginBottom: "0.75rem" }}>
              Rollover class offerings
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-600)", marginBottom: "0.75rem" }}>
              Creates a new active year and copies offering shells (no enrollments). Run a dry run first to see how many offerings would copy.
            </p>
            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>
              New year label
              <input
                value={rolloverLabel}
                onChange={(e) => setRolloverLabel(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.5rem" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={rolloverDry} onChange={(e) => setRolloverDry(e.target.checked)} />
              Dry run only
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRolloverId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleRollover}>
                {rolloverDry ? "Run dry run" : "Rollover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGradeModal && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGradeModal(false);
          }}
        >
          <div className="card" style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3 className="card-title" style={{ marginBottom: "0.75rem" }}>
              Create Grade
            </h3>

            {/* Grade Name */}
            <label style={{ display: "block", marginBottom: "1rem", fontSize: "0.85rem" }}>
              Grade Name *
              <input
                value={gradeForm.name}
                onChange={(e) => setGradeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Grade 9"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
                disabled={loadingGradeCreate}
              />
            </label>

            {/* Order Index */}
            <label style={{ display: "block", marginBottom: "1rem", fontSize: "0.85rem" }}>
              Order Index (optional)
              <input
                value={gradeForm.orderIndex}
                onChange={(e) => setGradeForm((f) => ({ ...f, orderIndex: e.target.value }))}
                placeholder="e.g., 9"
                type="number"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)" }}
                disabled={loadingGradeCreate}
              />
            </label>

            {/* Existing Sections */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                Assign Existing Sections ({gradeForm.selectedSections.length} selected)
              </label>
              {sections.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: 8 }}>
                  No sections available. Create sections below or in the Sections tab.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  {sections.map((section) => (
                    <label
                      key={section.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.5rem",
                        borderRadius: 8,
                        border: gradeForm.selectedSections.includes(section.id)
                          ? "2px solid var(--primary)"
                          : "1px solid var(--gray-200)",
                        background: gradeForm.selectedSections.includes(section.id) ? "var(--primary-light)" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={gradeForm.selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        disabled={loadingGradeCreate}
                      />
                      {section.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* New Sections */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                Create New Sections
              </label>
              <input
                placeholder="Type section name and press Enter"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    addNewSection(e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
                disabled={loadingGradeCreate}
                style={{ display: "block", width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-200)", marginBottom: "0.5rem" }}
              />
              <small style={{ fontSize: "0.75rem", color: "var(--gray-600)" }}>Press Enter to add</small>
              {gradeForm.newSections.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {gradeForm.newSections.map((name, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.35rem 0.5rem",
                        borderRadius: 8,
                        background: "var(--gray-100)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeNewSection(idx)}
                        disabled={loadingGradeCreate}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--danger)",
                          padding: 0,
                          fontSize: "1rem",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subjects */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                Assign Subjects ({gradeForm.selectedSubjects.length} selected)
              </label>
              {subjects.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: 8 }}>
                  No subjects available. Create subjects in the Subjects section.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  {subjects.map((subject) => (
                    <label
                      key={subject.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.5rem",
                        borderRadius: 8,
                        border: gradeForm.selectedSubjects.includes(subject.id)
                          ? "2px solid var(--primary)"
                          : "1px solid var(--gray-200)",
                        background: gradeForm.selectedSubjects.includes(subject.id) ? "var(--primary-light)" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={gradeForm.selectedSubjects.includes(subject.id)}
                        onChange={() => toggleGradeSubject(subject.id)}
                        disabled={loadingGradeCreate}
                      />
                      {subject.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ padding: "0.75rem", background: "var(--gray-50)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>
              <strong>Summary:</strong> Will create grade with{" "}
              {gradeForm.selectedSections.length + gradeForm.newSections.length} section(s)
              {gradeForm.selectedSubjects.length > 0 && ` and ${gradeForm.selectedSubjects.length} subject(s)`}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGradeModal(false)}
                disabled={loadingGradeCreate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateGrade}
                disabled={loadingGradeCreate}
              >
                {loadingGradeCreate ? "Creating..." : "Create Grade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeRow({ g, allSections, allSubjects, onSaved, showT }: { 
  g: Grade; 
  allSections: Section[];
  allSubjects: Subject[];
  onSaved: () => Promise<void>; 
  showT: (m: string) => void 
}) {
  const [name, setName] = useState(g.name);
  const [order, setOrder] = useState(g.orderIndex != null ? String(g.orderIndex) : "");
  const [gradeSections, setGradeSections] = useState<Section[]>([]);
  const [gradeSubjects, setGradeSubjects] = useState<Subject[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected section/subject IDs in edit mode
  const [editSectionIds, setEditSectionIds] = useState<string[]>([]);
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);

  const loadGradeData = useCallback(async () => {
    setLoadingSections(true);
    setLoadingSubjects(true);
    try {
      const [secs, subs] = await Promise.all([
        getSectionsForGrade(g.id),
        getSubjectsForGrade(g.id).catch(() => [] as Subject[]),
      ]);
      setGradeSections(secs);
      setGradeSubjects(subs);
      setEditSectionIds(secs.map(s => s.id));
      setEditSubjectIds(subs.map(s => s.id));
    } finally {
      setLoadingSections(false);
      setLoadingSubjects(false);
    }
  }, [g.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSections(true);
    setLoadingSubjects(true);
    Promise.all([
      getSectionsForGrade(g.id),
      getSubjectsForGrade(g.id).catch(() => [] as Subject[]),
    ]).then(([secs, subs]) => {
      if (cancelled) return;
      setGradeSections(secs);
      setGradeSubjects(subs);
      setEditSectionIds(secs.map(s => s.id));
      setEditSubjectIds(subs.map(s => s.id));
    }).catch(() => {
      if (!cancelled) {
        setGradeSections([]);
        setGradeSubjects([]);
      }
    }).finally(() => {
      if (!cancelled) {
        setLoadingSections(false);
        setLoadingSubjects(false);
      }
    });
    return () => { cancelled = true; };
  }, [g.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save name + order
      const oi = order.trim() ? parseInt(order, 10) : undefined;
      await patchGrade(g.id, {
        name: name.trim() || g.name,
        orderIndex: Number.isFinite(oi as number) ? oi : undefined,
      });

      // Diff sections: add new ones, remove removed ones
      const currentSectionIds = gradeSections.map(s => s.id);
      const toAdd = editSectionIds.filter(id => !currentSectionIds.includes(id));
      const toRemove = currentSectionIds.filter(id => !editSectionIds.includes(id));
      if (toAdd.length > 0) await assignSectionsToGrade(g.id, toAdd);
      for (const sId of toRemove) await removeSectionFromGrade(g.id, sId);

      // Diff subjects: add new ones, remove removed ones
      const currentSubjectIds = gradeSubjects.map(s => s.id);
      const subsToAdd = editSubjectIds.filter(id => !currentSubjectIds.includes(id));
      const subsToRemove = currentSubjectIds.filter(id => !editSubjectIds.includes(id));
      if (subsToAdd.length > 0) {
        try {
          await assignSubjectsToGrade(g.id, subsToAdd);
        } catch {
          showT("Some subjects could not be assigned. Check backend support.");
        }
      }
      for (const sId of subsToRemove) {
        try {
          await removeSubjectFromGrade(g.id, sId);
        } catch {
          // ignore individual failures
        }
      }

      await loadGradeData();
      await onSaved();
      setIsEditing(false);
      showT("Grade saved.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEditSection = (sId: string) => {
    setEditSectionIds(prev =>
      prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]
    );
  };

  const toggleEditSubject = (sId: string) => {
    setEditSubjectIds(prev =>
      prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]
    );
  };

  return (
    <>
      <tr>
        {isEditing ? (
          <>
            <td>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "0.35rem" }} disabled={saving} />
            </td>
            <td>
              <input value={order} onChange={(e) => setOrder(e.target.value)} style={{ width: 80, padding: "0.35rem" }} disabled={saving} />
            </td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginRight: 4 }} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginRight: 4 }} onClick={() => { setIsEditing(false); setName(g.name); setOrder(g.orderIndex != null ? String(g.orderIndex) : ""); setEditSectionIds(gradeSections.map(s => s.id)); setEditSubjectIds(gradeSubjects.map(s => s.id)); }} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  if (!confirm("Delete this grade?")) return;
                  try {
                    await deleteGrade(g.id);
                    await onSaved();
                    showT("Deleted.");
                  } catch (e) {
                    showT(e instanceof Error ? e.message : "Failed");
                  }
                }}
                disabled={saving}
              >
                Delete
              </button>
            </td>
          </>
        ) : (
          <>
            <td style={{ fontWeight: 500 }}>{g.name}</td>
            <td>{g.orderIndex ?? "—"}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginRight: 4 }} onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  if (!confirm("Delete this grade?")) return;
                  try {
                    await deleteGrade(g.id);
                    await onSaved();
                    showT("Deleted.");
                  } catch (e) {
                    showT(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Delete
              </button>
            </td>
          </>
        )}
      </tr>
      <tr>
        <td colSpan={3} style={{ paddingTop: 0, paddingBottom: "0.75rem", borderTop: "none" }}>
          {isEditing ? (
            <div style={{ display: "grid", gap: "0.75rem", paddingTop: "0.5rem" }}>
              {/* Sections checkboxes */}
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--gray-700)" }}>
                  Sections ({editSectionIds.length} assigned)
                </div>
                {allSections.length === 0 ? (
                  <span style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>No sections available</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {allSections.map(s => (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", padding: "0.25rem 0.5rem", borderRadius: 6, border: editSectionIds.includes(s.id) ? "1.5px solid var(--primary)" : "1px solid var(--gray-200)", background: editSectionIds.includes(s.id) ? "var(--primary-50)" : "transparent", cursor: "pointer" }}>
                        <input type="checkbox" checked={editSectionIds.includes(s.id)} onChange={() => toggleEditSection(s.id)} disabled={saving} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {/* Subjects checkboxes */}
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--gray-700)" }}>
                  Subjects ({editSubjectIds.length} assigned)
                </div>
                {allSubjects.length === 0 ? (
                  <span style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>No subjects available</span>
                ) : loadingSubjects ? (
                  <span style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>Loading…</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {allSubjects.map(s => (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", padding: "0.25rem 0.5rem", borderRadius: 6, border: editSubjectIds.includes(s.id) ? "1.5px solid var(--primary)" : "1px solid var(--gray-200)", background: editSubjectIds.includes(s.id) ? "var(--primary-50)" : "transparent", cursor: "pointer" }}>
                        <input type="checkbox" checked={editSubjectIds.includes(s.id)} onChange={() => toggleEditSubject(s.id)} disabled={saving} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {loadingSections ? (
                <span style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>Loading sections…</span>
              ) : gradeSections.length === 0 ? (
                <span style={{ fontSize: "0.78rem", color: "var(--gray-400)", fontStyle: "italic" }}>No sections assigned</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.25rem" }}>
                  {gradeSections.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.6rem",
                        borderRadius: 999,
                        background: "var(--primary-50)",
                        color: "var(--primary-700)",
                        border: "1px solid var(--primary-200)",
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
              {!loadingSubjects && gradeSubjects.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
                  {gradeSubjects.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.6rem",
                        borderRadius: 999,
                        background: "var(--gray-100)",
                        color: "var(--gray-700)",
                        border: "1px solid var(--gray-200)",
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </td>
      </tr>
    </>
  );
}

function SectionRow({ s, onSaved, showT }: { s: Section; onSaved: () => Promise<void>; showT: (m: string) => void }) {
  const [name, setName] = useState(s.name);
  return (
    <tr>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "0.35rem" }} />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginRight: 4 }}
          onClick={async () => {
            try {
              await patchSection(s.id, { name: name.trim() || s.name });
              await onSaved();
              showT("Section saved.");
            } catch (e) {
              showT(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            if (!confirm("Delete this section?")) return;
            try {
              await deleteSection(s.id);
              await onSaved();
              showT("Deleted.");
            } catch (e) {
              showT(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function SubjectRow({ s, onSaved, showT }: { s: Subject; onSaved: () => Promise<void>; showT: (m: string) => void }) {
  const [name, setName] = useState(s.name);
  const [code, setCode] = useState(s.code ?? "");
  return (
    <tr>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "0.35rem" }} />
      </td>
      <td>
        <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120, padding: "0.35rem" }} />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginRight: 4 }}
          onClick={async () => {
            try {
              await patchSubject(s.id, {
                name: name.trim() || s.name,
                code: code.trim() ? code.trim() : null,
              });
              await onSaved();
              showT("Subject saved.");
            } catch (e) {
              showT(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            if (!confirm("Delete this subject?")) return;
            try {
              await deleteSubject(s.id);
              await onSaved();
              showT("Deleted.");
            } catch (e) {
              showT(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
