"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap, RefreshCcw, Sparkles, UserRoundCheck } from "lucide-react";
import { Search } from "lucide-react";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import {
  type AcademicYear,
  type ClassOffering,
  type Grade,
  type PublicUser,
  type Section,
  type Subject,
  activateAcademicYear,
  createClassOffering,
  deleteClassOffering,
  getSectionsForGrade,
  getSubjectsForGrade,
  listAcademicYears,
  listClassOfferings,
  listGrades,
  listSections,
  listSubjects,
  listUsers,
  patchClassOffering,
} from "@/lib/admin-api";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/ui";

function labelOffering(
  o: ClassOffering,
  g: Map<string, Grade>,
  sec: Map<string, Section>,
  sub: Map<string, Subject>,
): string {
  if (o.name?.trim()) return o.name.trim();
  const gn = g.get(o.gradeId)?.name ?? o.gradeId.slice(0, 8);
  const sn = sec.get(o.sectionId)?.name ?? o.sectionId.slice(0, 8);
  const sb = sub.get(o.subjectId)?.name ?? o.subjectId.slice(0, 8);
  return `${gn} · ${sn} · ${sb}`;
}

function ClassesSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

export default function AdminClasses() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterText, setFilterText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Single offering modal state — now uses same matrix approach as bulk
  const [showModal, setShowModal] = useState(false);
  const [singleForm, setSingleForm] = useState({
    gradeId: "",
    teacherId: "",
    sectionIds: [] as string[],
  });
  const [singleMatrix, setSingleMatrix] = useState<Set<string>>(new Set());
  const [singleGradeSections, setSingleGradeSections] = useState<Section[]>([]);
  const [loadingSingleGradeSections, setLoadingSingleGradeSections] = useState(false);
  const [loadingSingleCreate, setLoadingSingleCreate] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editTeacherId, setEditTeacherId] = useState("");

  // Bulk creation state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    gradeId: "",
    teacherId: "",
    sectionIds: [] as string[],
  });
  const [bulkMatrix, setBulkMatrix] = useState<Set<string>>(new Set());
  const [loadingBulkCreate, setLoadingBulkCreate] = useState(false);
  
  // Grade-filtered sections state
  const [gradeSections, setGradeSections] = useState<Section[]>([]);
  const [loadingGradeSections, setLoadingGradeSections] = useState(false);

  // Grade-filtered subjects for bulk modal
  const [bulkGradeSubjects, setBulkGradeSubjects] = useState<Subject[]>([]);
  const [loadingBulkGradeSubjects, setLoadingBulkGradeSubjects] = useState(false);

  // Grade-filtered subjects for single modal
  const [singleGradeSubjects, setSingleGradeSubjects] = useState<Subject[]>([]);
  const [loadingSingleGradeSubjects, setLoadingSingleGradeSubjects] = useState(false);

  const showT = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const gMap = useMemo(() => new Map(grades.map((x) => [x.id, x])), [grades]);
  const sMap = useMemo(() => new Map(sections.map((x) => [x.id, x])), [sections]);
  const subMap = useMemo(() => new Map(subjects.map((x) => [x.id, x])), [subjects]);
  const tMap = useMemo(() => new Map(teachers.map((x) => [x.id, x])), [teachers]);

  const filteredOfferings = useMemo(() => offerings.filter(o => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    const label = labelOffering(o, gMap, sMap, subMap).toLowerCase();
    const teacher = tMap.get(o.teacherId);
    const tn = teacher ? `${teacher.firstName} ${teacher.lastName}`.toLowerCase() : "";
    return label.includes(q) || tn.includes(q);
  }), [offerings, filterText, gMap, sMap, subMap, tMap]);
  const total = filteredOfferings.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const visibleRows = filteredOfferings.slice(startIdx, endIdx);

  const loadCore = useCallback(async () => {
    const [y, g, sec, subj, t] = await Promise.all([
      listAcademicYears(),
      listGrades(),
      listSections(),
      listSubjects(),
      listUsers("teacher"),
    ]);
    setYears(y);
    setGrades(g);
    setSections(sec);
    setSubjects(subj);
    setTeachers(t);
    const active = y.find((a) => a.isActive && !a.isArchived);
    setYearId((prev) => prev || active?.id || y[0]?.id || "");
  }, []);

  const loadOfferings = useCallback(async (y: string) => {
    if (!y) {
      setOfferings([]);
      return;
    }
    const list = await listClassOfferings(y);
    setOfferings(list);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadCore();
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [loadCore]);

  useEffect(() => {
    if (!yearId) return;
    let c = false;
    (async () => {
      try {
        await loadOfferings(yearId);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Failed to load classes");
      }
    })();
    return () => {
      c = true;
    };
  }, [yearId, loadOfferings]);

  // Fetch sections for selected grade in bulk modal
  useEffect(() => {
    if (bulkForm.gradeId && showBulkModal) {
      let cancelled = false;
      setLoadingGradeSections(true);
      getSectionsForGrade(bulkForm.gradeId)
        .then((gradeSecs) => {
          if (cancelled) return;
          setGradeSections(gradeSecs);
          setBulkForm((prev) => ({ ...prev, sectionIds: [] }));
        })
        .catch(() => {
          if (!cancelled) {
            showT("Failed to load sections for grade");
            setGradeSections([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingGradeSections(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setGradeSections([]);
    }
  }, [bulkForm.gradeId, showBulkModal]);

  // Fetch grade-filtered subjects for bulk modal
  useEffect(() => {
    if (bulkForm.gradeId && showBulkModal) {
      let cancelled = false;
      setLoadingBulkGradeSubjects(true);
      getSubjectsForGrade(bulkForm.gradeId)
        .then((subs) => {
          if (cancelled) return;
          setBulkGradeSubjects(subs);
        })
        .catch(() => {
          if (!cancelled) setBulkGradeSubjects([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingBulkGradeSubjects(false);
        });
      return () => { cancelled = true; };
    } else {
      setBulkGradeSubjects([]);
    }
  }, [bulkForm.gradeId, showBulkModal, subjects]);

  // Rebuild bulk matrix whenever sections, grade, subjects, or offerings change
  useEffect(() => {
    const newMatrix = new Set<string>();
    for (const sId of bulkForm.sectionIds) {
      for (const sub of bulkGradeSubjects) {
        const exists = offerings.some(o =>
          o.gradeId === bulkForm.gradeId &&
          o.sectionId === sId &&
          o.subjectId === sub.id
        );
        if (!exists) newMatrix.add(`${sId}::${sub.id}`);
      }
    }
    setBulkMatrix(newMatrix);
  }, [bulkForm.sectionIds, bulkForm.gradeId, bulkGradeSubjects, offerings]);

  // Fetch sections for selected grade in single offering modal
  useEffect(() => {
    if (singleForm.gradeId && showModal) {
      let cancelled = false;
      setLoadingSingleGradeSections(true);
      getSectionsForGrade(singleForm.gradeId)
        .then((secs) => {
          if (cancelled) return;
          setSingleGradeSections(secs.length > 0 ? secs : sections);
          setSingleForm((prev) => ({ ...prev, sectionIds: [] }));
        })
        .catch(() => {
          if (!cancelled) {
            setSingleGradeSections(sections);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingSingleGradeSections(false);
        });
      return () => { cancelled = true; };
    } else {
      setSingleGradeSections([]);
    }
  }, [singleForm.gradeId, showModal, sections]);

  // Fetch grade-filtered subjects for single modal
  useEffect(() => {
    if (singleForm.gradeId && showModal) {
      let cancelled = false;
      setLoadingSingleGradeSubjects(true);
      getSubjectsForGrade(singleForm.gradeId)
        .then((subs) => {
          if (cancelled) return;
          setSingleGradeSubjects(subs.length > 0 ? subs : subjects);
        })
        .catch(() => {
          if (!cancelled) setSingleGradeSubjects(subjects);
        })
        .finally(() => {
          if (!cancelled) setLoadingSingleGradeSubjects(false);
        });
      return () => { cancelled = true; };
    } else {
      setSingleGradeSubjects([]);
    }
  }, [singleForm.gradeId, showModal, subjects]);

  // Rebuild single matrix whenever sections/grade/subjects/offerings change
  useEffect(() => {
    const newMatrix = new Set<string>();
    for (const sId of singleForm.sectionIds) {
      for (const sub of singleGradeSubjects) {
        const exists = offerings.some(o =>
          o.gradeId === singleForm.gradeId &&
          o.sectionId === sId &&
          o.subjectId === sub.id
        );
        if (!exists) newMatrix.add(`${sId}::${sub.id}`);
      }
    }
    setSingleMatrix(newMatrix);
  }, [singleForm.sectionIds, singleForm.gradeId, singleGradeSubjects, offerings]);

  const toggleMatrixCell = (sectionId: string, subjectId: string) => {
    const key = `${sectionId}::${subjectId}`;
    setBulkMatrix(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSingleMatrixCell = (sectionId: string, subjectId: string) => {
    const key = `${sectionId}::${subjectId}`;
    setSingleMatrix(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreate = () => {
    setSingleForm({
      gradeId: grades[0]?.id ?? "",
      teacherId: teachers[0]?.id ?? "",
      sectionIds: [],
    });
    setSingleMatrix(new Set());
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!yearId) { showT("Select an academic year first."); return; }
    if (!singleForm.gradeId || !singleForm.teacherId) { showT("Select grade and teacher."); return; }
    if (singleForm.sectionIds.length === 0) { showT("Select at least one section."); return; }
    const pairs = Array.from(singleMatrix).map(key => {
      const [sectionId, subjectId] = key.split("::");
      return { sectionId, subjectId };
    });
    if (pairs.length === 0) { showT("No new offerings to create — all selected combinations already exist."); return; }

    setLoadingSingleCreate(true);
    try {
      let created = 0;
      for (const { sectionId, subjectId } of pairs) {
        await createClassOffering({
          academicYearId: yearId,
          gradeId: singleForm.gradeId,
          sectionId,
          subjectId,
          teacherId: singleForm.teacherId,
        });
        created++;
      }
      setShowModal(false);
      await loadOfferings(yearId);
      showT(`Created ${created} offering${created !== 1 ? "s" : ""}`);
    } catch (e) {
      showT(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoadingSingleCreate(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this class offering? Enrollments may block deletion on the server.")) return;
    try {
      await deleteClassOffering(id);
      await loadOfferings(yearId);
      showT("Deleted.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openEditTeacher = (o: ClassOffering) => {
    setEditId(o.id);
    setEditTeacherId(o.teacherId);
  };

  const saveEditTeacher = async () => {
    if (!editId || !editTeacherId) return;
    try {
      await patchClassOffering(editId, { teacherId: editTeacherId });
      setEditId(null);
      await loadOfferings(yearId);
      showT("Teacher updated.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Update failed");
    }
  };

  const setYearActive = async (id: string) => {
    try {
      await activateAcademicYear(id);
      await loadCore();
      setYearId(id);
      showT("Academic year activated.");
    } catch (e) {
      showT(e instanceof Error ? e.message : "Activate failed");
    }
  };

  // Bulk creation handlers
  const openBulkCreate = () => {
    setBulkForm({
      gradeId: grades[0]?.id ?? "",
      teacherId: teachers[0]?.id ?? "",
      sectionIds: [],
    });
    setBulkMatrix(new Set());
    setShowBulkModal(true);
  };

  const toggleSection = (sectionId: string) => {
    setBulkForm((prev) => ({
      ...prev,
      sectionIds: prev.sectionIds.includes(sectionId)
        ? prev.sectionIds.filter((id) => id !== sectionId)
        : [...prev.sectionIds, sectionId],
    }));
  };

  const selectAllSections = () => {
    setBulkForm((prev) => ({ ...prev, sectionIds: gradeSections.map((s) => s.id) }));
  };

  const deselectAllSections = () => {
    setBulkForm((prev) => ({ ...prev, sectionIds: [] }));
  };

  const handleBulkCreate = async () => {
    if (!yearId) {
      showT("Select an academic year first.");
      return;
    }
    if (!bulkForm.gradeId || !bulkForm.teacherId) {
      showT("Select grade and teacher.");
      return;
    }
    if (bulkForm.sectionIds.length === 0) {
      showT("Select at least one section.");
      return;
    }
    const pairs = Array.from(bulkMatrix).map(key => {
      const [sectionId, subjectId] = key.split("::");
      return { sectionId, subjectId };
    });
    if (pairs.length === 0) {
      showT("No new offerings to create.");
      return;
    }

    setLoadingBulkCreate(true);
    try {
      let created = 0;
      for (const { sectionId, subjectId } of pairs) {
        await createClassOffering({
          academicYearId: yearId,
          gradeId: bulkForm.gradeId,
          sectionId,
          subjectId,
          teacherId: bulkForm.teacherId,
        });
        created++;
      }
      setShowBulkModal(false);
      await loadOfferings(yearId);
      showT(`Created ${created} offering${created !== 1 ? "s" : ""}`);
    } catch (e) {
      showT(e instanceof Error ? e.message : "Bulk create failed");
    } finally {
      setLoadingBulkCreate(false);
    }
  };

  if (loading && !years.length) {
    return <ClassesSkeleton />;
  }

  const activeYear = years.find((y) => y.isActive && !y.isArchived);
  const assignedTeacherCount = new Set(offerings.map((o) => o.teacherId).filter(Boolean)).size;

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
        kicker="Scheduling Hub"
        title="Class offerings"
        subtitle="Classes offered this year, with section, subject, and teacher assignment."
        icon={<BookOpen size={22} />}
        actions={(
          <button type="button" className="btn btn-primary" onClick={openBulkCreate} disabled={!yearId} style={{ borderRadius: 12 }}>
            + Bulk create
          </button>
        )}
      />

      <div className="stats-grid admin-dash-stats-grid">
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon blue">
            <BookOpen size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Offerings</div>
            <div className="stat-value">{offerings.length}</div>
            <div className="admin-dash-stat-note">Current year classes</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon teal">
            <UserRoundCheck size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Assigned teachers</div>
            <div className="stat-value">{assignedTeacherCount}</div>
            <div className="admin-dash-stat-note">Unique faculty assigned</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon orange">
            <GraduationCap size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Grades configured</div>
            <div className="stat-value">{grades.length}</div>
            <div className="admin-dash-stat-note">School structure</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon purple">
            <CalendarDays size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Academic years</div>
            <div className="stat-value">{years.length}</div>
            <div className="admin-dash-stat-note">{activeYear ? `Active: ${activeYear.label}` : "No active year"}</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: "1rem", color: "var(--danger)", padding: "1rem" }}>
          {err}
        </div>
      )}

      <div className="card classes-panel" style={{ marginBottom: "1rem" }}>
        <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Academic year</label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <Select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            style={{ padding: "0.6rem 1rem", borderRadius: "20px", border: "1px solid var(--primary-200)", background: "var(--primary-50)", color: "var(--primary-800)", fontWeight: 600, minWidth: 220, outline: "none", cursor: "pointer" }}
          >
            {years.length === 0 && <option value="">No academic years</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.isActive ? " (active)" : ""}
              </option>
            ))}
          </Select>
          {yearId && (
            <button type="button" className="btn btn-secondary" onClick={() => setYearActive(yearId)}>
              <RefreshCcw size={14} />
              Set as active year
            </button>
          )}
        </div>
      </div>

      <div className="card classes-panel">
        <div className="classes-table-head">
          <h3 className="card-title classes-section-title">Class list</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }} />
              <input
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setPage(0); }}
                placeholder="Search classes or teachers…"
                style={{ paddingLeft: "2.1rem", paddingRight: "0.75rem", paddingTop: "0.45rem", paddingBottom: "0.45rem", borderRadius: "20px", border: "1px solid var(--gray-200)", fontSize: "0.85rem", outline: "none", minWidth: 220 }}
              />
            </div>
            <span className="admin-dash-chip">{total} total</span>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Teacher</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {offerings.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: "var(--gray-500)", padding: "1.5rem" }}>
                    No offerings for this year.
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: "var(--gray-500)", padding: "1.5rem" }}>
                    No results for "{filterText}".
                  </td>
                </tr>
              ) : (
                visibleRows.map((o) => {
                  const tn = tMap.get(o.teacherId);
                  const tname = tn ? `${tn.firstName} ${tn.lastName}` : "—";
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{labelOffering(o, gMap, sMap, subMap)}</td>
                      <td>{tname}</td>
                      <td style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Link href={`/admin/classes/${o.id}`} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}>
                          Enrollments
                        </Link>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => openEditTeacher(o)}>
                          Change teacher
                        </button>
                        <button type="button" className="btn btn-danger" style={{ fontSize: "0.8rem" }} onClick={() => handleDelete(o.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > rowsPerPage && (
          <TablePagination
            total={total}
            page={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
          />
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 9998, padding: "1rem" }}>
          <div className="modal" style={{ maxWidth: 680, width: "100%", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>New class offering</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--gray-600)", marginBottom: "1.5rem" }}>
              Select a grade, teacher, and sections — then pick which subjects to assign per section.
            </p>
            <div style={{ display: "grid", gap: "1.25rem" }}>
              {/* Grade */}
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Grade *</label>
                <Select
                  value={singleForm.gradeId}
                  onChange={(e) => setSingleForm((f) => ({ ...f, gradeId: e.target.value, sectionIds: [] }))}
                  style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "12px", border: "1px solid var(--gray-300)", outline: "none" }}
                >
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </div>
              {/* Teacher */}
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Teacher *</label>
                <Select
                  value={singleForm.teacherId}
                  onChange={(e) => setSingleForm((f) => ({ ...f, teacherId: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "12px", border: "1px solid var(--gray-300)", outline: "none" }}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>
                  ))}
                </Select>
              </div>
              {/* Sections */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600 }}>Sections * ({singleForm.sectionIds.length} selected)</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => setSingleForm((f) => ({ ...f, sectionIds: singleGradeSections.map(s => s.id) }))} disabled={loadingSingleGradeSections || singleGradeSections.length === 0} style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--primary-50)", color: "var(--primary-700)", border: "1px solid var(--primary-200)", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Select all</button>
                    <button type="button" onClick={() => setSingleForm((f) => ({ ...f, sectionIds: [] }))} style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--gray-50)", color: "var(--gray-700)", border: "1px solid var(--gray-300)", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Clear</button>
                  </div>
                </div>
                {loadingSingleGradeSections ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>Loading sections…</div>
                ) : singleGradeSections.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>No sections for this grade. Assign sections in School Setup.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
                    {singleGradeSections.map((sec) => {
                      const isSel = singleForm.sectionIds.includes(sec.id);
                      return (
                        <label key={sec.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", border: `2px solid ${isSel ? "var(--primary-500)" : "var(--gray-300)"}`, borderRadius: "10px", cursor: "pointer", background: isSel ? "var(--primary-50)" : "#fff", transition: "all 0.2s", fontWeight: isSel ? 600 : 400 }}>
                          <input type="checkbox" checked={isSel} onChange={() => setSingleForm((f) => ({ ...f, sectionIds: isSel ? f.sectionIds.filter(id => id !== sec.id) : [...f.sectionIds, sec.id] }))} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                          <span style={{ fontSize: "0.9rem" }}>{sec.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Matrix */}
              {singleForm.sectionIds.length > 0 && (
                <div>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                    Offerings matrix ({singleMatrix.size} new to create)
                  </label>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginBottom: "0.75rem" }}>
                    Checked = will be created. Grey = already exists. Uncheck to skip.
                  </p>
                  {loadingSingleGradeSubjects ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>Loading subjects for this grade…</div>
                  ) : singleGradeSubjects.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>No subjects assigned to this grade. Assign subjects in School Setup.</div>
                  ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid var(--gray-200)", minWidth: 120 }}>Subject</th>
                          {singleForm.sectionIds.map(sId => {
                            const sec = singleGradeSections.find(s => s.id === sId);
                            return (
                              <th key={sId} style={{ textAlign: "center", padding: "0.5rem", borderBottom: "2px solid var(--gray-200)", minWidth: 100 }}>
                                {sec?.name ?? sId.slice(0, 6)}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {singleGradeSubjects.map(sub => (
                          <tr key={sub.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                            <td style={{ padding: "0.5rem", fontWeight: 500 }}>{sub.name}</td>
                            {singleForm.sectionIds.map(sId => {
                              const exists = offerings.some(o =>
                                o.gradeId === singleForm.gradeId &&
                                o.sectionId === sId &&
                                o.subjectId === sub.id
                              );
                              const key = `${sId}::${sub.id}`;
                              const checked = singleMatrix.has(key);
                              return (
                                <td key={sId} style={{ textAlign: "center", padding: "0.5rem" }}>
                                  {exists ? (
                                    <span style={{ fontSize: "0.75rem", color: "var(--gray-400)", background: "var(--gray-100)", padding: "0.2rem 0.5rem", borderRadius: 6 }}>Exists</span>
                                  ) : (
                                    <input type="checkbox" checked={checked} onChange={() => toggleSingleMatrixCell(sId, sub.id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}
              {/* Summary */}
              {singleMatrix.size > 0 && (
                <div style={{ padding: "1rem", background: "var(--primary-50)", border: "2px solid var(--primary-200)", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--primary-700)", fontWeight: 600, marginBottom: "0.25rem" }}>Will create</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary-800)" }}>{singleMatrix.size}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--primary-700)", fontWeight: 600 }}>new offering{singleMatrix.size !== 1 ? "s" : ""}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={loadingSingleCreate}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={loadingSingleCreate || singleMatrix.size === 0}>
                {loadingSingleCreate ? "Creating..." : `Create ${singleMatrix.size} offering${singleMatrix.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="modal-overlay" style={{ zIndex: 9998, padding: "1rem" }}>
          <div className="modal" style={{ maxWidth: 420, width: "100%", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem" }}>Assign teacher</h2>
            <Select value={editTeacherId} onChange={(e) => setEditTeacherId(e.target.value)} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "20px", border: "1px solid var(--primary-200)", background: "var(--primary-50)", color: "var(--primary-800)", outline: "none" }}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </Select>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEditTeacher}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay" style={{ zIndex: 9998, padding: "1rem" }}>
          <div className="modal" style={{ maxWidth: 680, width: "100%", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Bulk create class offerings</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--gray-600)", marginBottom: "1.5rem" }}>
              Select multiple sections and subjects to create all combinations at once
            </p>

            <div style={{ display: "grid", gap: "1.25rem" }}>
              {/* Teacher Selection */}
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Teacher *</label>
                <Select
                  value={bulkForm.teacherId}
                  onChange={(e) => setBulkForm((f) => ({ ...f, teacherId: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "12px", border: "1px solid var(--gray-300)", outline: "none" }}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.email})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Grade Selection */}
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Grade *</label>
                <Select
                  value={bulkForm.gradeId}
                  onChange={(e) => setBulkForm((f) => ({ ...f, gradeId: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "12px", border: "1px solid var(--gray-300)", outline: "none" }}
                >
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Sections Selection */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600 }}>Sections * ({bulkForm.sectionIds.length} selected)</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={selectAllSections}
                      disabled={loadingGradeSections || gradeSections.length === 0}
                      style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--primary-50)", color: "var(--primary-700)", border: "1px solid var(--primary-200)", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllSections}
                      disabled={loadingGradeSections}
                      style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--gray-50)", color: "var(--gray-700)", border: "1px solid var(--gray-300)", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {loadingGradeSections ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>
                    Loading sections for selected grade...
                  </div>
                ) : gradeSections.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>
                    No sections assigned to this grade. Assign sections in School Setup.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
                    {gradeSections.map((section) => {
                      const isSelected = bulkForm.sectionIds.includes(section.id);
                      return (
                        <label
                          key={section.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.6rem 0.8rem",
                            border: `2px solid ${isSelected ? "var(--primary-500)" : "var(--gray-300)"}`,
                            borderRadius: "10px",
                            cursor: "pointer",
                            background: isSelected ? "var(--primary-50)" : "#fff",
                            transition: "all 0.2s",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSection(section.id)}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                          <span style={{ fontSize: "0.9rem" }}>{section.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subject × Section Matrix */}
              {bulkForm.sectionIds.length > 0 && (
                <div>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                    Offerings matrix ({bulkMatrix.size} new to create)
                  </label>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginBottom: "0.75rem" }}>
                    Checked = will be created. Grey = already exists. Uncheck to skip.
                  </p>
                  {loadingBulkGradeSubjects ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>Loading subjects for this grade…</div>
                  ) : bulkGradeSubjects.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-600)", background: "var(--gray-50)", borderRadius: "10px", border: "1px solid var(--gray-300)" }}>No subjects assigned to this grade. Assign subjects in School Setup.</div>
                  ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid var(--gray-200)", minWidth: 120 }}>Subject</th>
                          {bulkForm.sectionIds.map(sId => {
                            const sec = gradeSections.find(s => s.id === sId);
                            return (
                              <th key={sId} style={{ textAlign: "center", padding: "0.5rem", borderBottom: "2px solid var(--gray-200)", minWidth: 100 }}>
                                {sec?.name ?? sId.slice(0, 6)}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkGradeSubjects.map(sub => (
                          <tr key={sub.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                            <td style={{ padding: "0.5rem", fontWeight: 500 }}>{sub.name}</td>
                            {bulkForm.sectionIds.map(sId => {
                              const exists = offerings.some(o =>
                                o.gradeId === bulkForm.gradeId &&
                                o.sectionId === sId &&
                                o.subjectId === sub.id
                              );
                              const key = `${sId}::${sub.id}`;
                              const checked = bulkMatrix.has(key);
                              return (
                                <td key={sId} style={{ textAlign: "center", padding: "0.5rem" }}>
                                  {exists ? (
                                    <span style={{ fontSize: "0.75rem", color: "var(--gray-400)", background: "var(--gray-100)", padding: "0.2rem 0.5rem", borderRadius: 6 }}>
                                      Exists
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleMatrixCell(sId, sub.id)}
                                      style={{ width: 16, height: 16, cursor: "pointer" }}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Summary */}
              {bulkMatrix.size > 0 && (
                <div
                  style={{
                    padding: "1rem",
                    background: "var(--primary-50)",
                    border: "2px solid var(--primary-200)",
                    borderRadius: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", color: "var(--primary-700)", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Will create
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary-800)" }}>
                    {bulkMatrix.size}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--primary-700)", fontWeight: 600 }}>
                    new offerings
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBulkModal(false)}
                disabled={loadingBulkCreate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkCreate}
                disabled={loadingBulkCreate || bulkMatrix.size === 0}
              >
                {loadingBulkCreate ? "Creating..." : `Create ${bulkMatrix.size} offering${bulkMatrix.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
