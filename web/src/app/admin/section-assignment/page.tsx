"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, GraduationCap, Layers3, RefreshCcw, Search, Sparkles, Users, BookOpen } from "lucide-react";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import {
  assignStudentsToSection,
  getActiveAcademicYear,
  getSectionsForGrade,
  listAcademicYears,
  listClassOfferings,
  listGrades,
  listStudents,
  type AcademicYear,
  type ClassOffering,
  type Grade,
  type PublicUser,
  type Section,
} from "@/lib/admin-api";
import { useToastStore } from "@/store/toastStore";
import { PageHeader } from "@/components/ui";

export default function AdminSectionAssignmentPage() {
  const { showToast } = useToastStore();

  const [yearOptions, setYearOptions] = useState<AcademicYear[]>([]);
  const [gradeOptions, setGradeOptions] = useState<Grade[]>([]);
  const [sectionOptions, setSectionOptions] = useState<Section[]>([]);
  const [students, setStudents] = useState<PublicUser[]>([]);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);

  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const selectedYear = useMemo(
    () => yearOptions.find((y) => y.id === selectedYearId) ?? null,
    [yearOptions, selectedYearId],
  );
  const selectedGrade = useMemo(
    () => gradeOptions.find((g) => g.id === selectedGradeId) ?? null,
    [gradeOptions, selectedGradeId],
  );
  const selectedSection = useMemo(
    () => sectionOptions.find((s) => s.id === selectedSectionId) ?? null,
    [sectionOptions, selectedSectionId],
  );

  const loadYearsAndGrades = useCallback(async () => {
    const [years, grades, active] = await Promise.all([
      listAcademicYears(),
      listGrades(),
      getActiveAcademicYear().catch(() => null),
    ]);

    setYearOptions(years);
    setGradeOptions(grades);

    const initialYear = active ?? years.find((y) => y.isActive && !y.isArchived) ?? years[0] ?? null;
    if (initialYear) setSelectedYearId(initialYear.id);

    const initialGrade = grades[0] ?? null;
    if (initialGrade) setSelectedGradeId(initialGrade.id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadYearsAndGrades();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load page data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadYearsAndGrades]);

  useEffect(() => {
    if (!selectedGradeId) {
      setSectionOptions([]);
      setSelectedSectionId("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const secs = await getSectionsForGrade(selectedGradeId);
        if (cancelled) return;
        setSectionOptions(secs);
        setSelectedSectionId((prev) => (prev && secs.some((s) => s.id === prev) ? prev : secs[0]?.id ?? ""));
      } catch {
        if (!cancelled) {
          setSectionOptions([]);
          setSelectedSectionId("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGradeId]);

  const refreshStudentsAndOfferings = useCallback(async () => {
    if (!selectedGrade || !selectedYearId) {
      setStudents([]);
      setOfferings([]);
      return;
    }

    setLoadingStudents(true);
    try {
      const [studentRows, allOfferings] = await Promise.all([
        listStudents({ grade: selectedGrade.name, q: search.trim() || undefined }),
        listClassOfferings(selectedYearId),
      ]);

      setStudents(studentRows);
      setSelectedStudentIds([]);
      setOfferings(
        allOfferings.filter(
          (co) => co.gradeId === selectedGradeId && (!selectedSectionId || co.sectionId === selectedSectionId),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
      setStudents([]);
      setOfferings([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [search, selectedGrade, selectedGradeId, selectedSectionId, selectedYearId]);

  useEffect(() => {
    if (!selectedYearId || !selectedGradeId) return;
    void refreshStudentsAndOfferings();
  }, [refreshStudentsAndOfferings, selectedGradeId, selectedSectionId, selectedYearId]);

  const selectedOfferingCount = offerings.length;
  const selectedSubjectNames = offerings.map((o) => o.subjectName ?? o.displayName ?? o.name ?? o.subjectId);
  const allSelected = students.length > 0 && selectedStudentIds.length === students.length;

  const visibleStudents = useMemo(() => {
    return students.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [students, page, rowsPerPage]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  };

  const toggleAll = () => {
    setSelectedStudentIds(allSelected ? [] : students.map((s) => s.id));
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);

    if (!selectedYearId || !selectedGradeId || !selectedSectionId) {
      setError("Select an academic year, grade, and section first.");
      return;
    }
    if (!selectedStudentIds.length) {
      setError("Select at least one student.");
      return;
    }
    setPage(0);
    if (!offerings.length) {
      setError("No class offerings exist for this grade/section in the selected academic year.");
      return;
    }

    setSaving(true);
    try {
      const result = await assignStudentsToSection({
        academicYearId: selectedYearId,
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        studentIds: selectedStudentIds,
      });

      setMessage(
        `Assigned ${result.studentCount} student(s) to ${result.gradeName} ${result.sectionName} and created ${result.enrollmentsCreated} enrollment(s).`,
      );
      showToast("Students assigned to section successfully.", "success", true);
      await refreshStudentsAndOfferings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="card" style={{ padding: 24, minHeight: 320 }}>
          <div className="admin-skeleton shimmer" style={{ width: 200, height: 18, marginBottom: 12 }} />
          <div className="admin-skeleton shimmer" style={{ width: "70%", height: 42, marginBottom: 18 }} />
          <div className="admin-skeleton shimmer" style={{ width: "100%", height: 200, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="Section assignment"
        title="Assign students to a section"
        subtitle="Update the selected students' grade/section and enroll them in every class offering for that section."
        icon={<Layers3 size={22} />}
        actions={(
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-secondary" href="/admin/registration" style={{ borderRadius: 12 }}>Registration</Link>
            <Link className="btn btn-primary" href="/admin/school-setup" style={{ borderRadius: 12 }}>School setup</Link>
          </div>
        )}
      />

      <div className="stats-grid admin-dash-stats-grid" style={{ marginBottom: "2rem" }}>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon blue"><GraduationCap size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Academic year</div>
            <div className="stat-value" style={{ fontSize: "1.1rem" }}>{selectedYear?.label ?? "Select a year"}</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon teal"><Layers3 size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Target section</div>
            <div className="stat-value" style={{ fontSize: "1.1rem" }}>{selectedGrade?.name ?? "—"} {selectedSection?.name ?? ""}</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon orange"><Users size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Selected students</div>
            <div className="stat-value">{selectedStudentIds.length}</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon purple"><CheckCircle2 size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Section subjects</div>
            <div className="stat-value">{selectedOfferingCount}</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 12, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ padding: "1rem", marginBottom: "1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, color: "#166534" }}>
          {message}
        </div>
      )}

      <div className="card" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Academic year</label>
            <Select
              id="year"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              disabled={yearOptions.length === 0}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "20px",
                border: "1.5px solid var(--primary-200)",
                backgroundColor: "var(--primary-50)",
                fontSize: "0.95rem",
                width: "100%",
                outline: "none",
                transition: "all 0.2s",
                color: "var(--primary-800)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {yearOptions.length === 0 ? (
                <option value="">No academic years available</option>
              ) : (
                yearOptions.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}{year.isActive ? " (active)" : ""}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Grade</label>
            <Select
              id="grade"
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              disabled={gradeOptions.length === 0}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "20px",
                border: "1.5px solid var(--primary-200)",
                backgroundColor: "var(--primary-50)",
                fontSize: "0.95rem",
                width: "100%",
                outline: "none",
                transition: "all 0.2s",
                color: "var(--primary-800)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {gradeOptions.length === 0 ? (
                <option value="">No grades available</option>
              ) : (
                gradeOptions.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Section</label>
            <Select
              id="section"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={sectionOptions.length === 0}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "20px",
                border: "1.5px solid var(--primary-200)",
                backgroundColor: sectionOptions.length === 0 ? "var(--gray-50)" : "var(--primary-50)",
                fontSize: "0.95rem",
                width: "100%",
                outline: "none",
                transition: "all 0.2s",
                color: "var(--primary-800)",
                fontWeight: 600,
                cursor: sectionOptions.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {sectionOptions.length === 0 ? (
                <option value="">No sections available</option>
              ) : (
                sectionOptions.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))
              )}
            </Select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginTop: 20, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Search students</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }} />
              <input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
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
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => void refreshStudentsAndOfferings()} style={{ height: "48px", borderRadius: "10px", padding: "0 1.5rem" }}>
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Students in {selectedGrade?.name ?? "selected grade"}</h3>
            <p style={{ margin: 0, color: "var(--gray-500)", fontSize: "0.85rem" }}>
              Choose students to move into {selectedGrade?.name ?? "this grade"} {selectedSection?.name ?? ""}.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={toggleAll} disabled={!students.length} style={{ borderRadius: 8 }}>
            {allSelected ? "Clear selection" : "Select all"}
          </button>
        </div>

        {loadingStudents ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-500)" }}>
            <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24, border: "3px solid var(--gray-200)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-500)" }}>No students found for the selected grade.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </th>
                  <th>Student</th>
                  <th>Current grade</th>
                  <th>Current section</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--gray-900)" }}>
                      {student.firstName} {student.lastName}
                    </td>
                    <td>
                      <span className="admin-dash-chip" style={{ background: "var(--primary-50)", color: "var(--primary-700)" }}>
                        {student.grade ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="admin-dash-chip" style={{ background: "var(--gray-50)", color: "var(--gray-600)" }}>
                        {student.section ?? "—"}
                      </span>
                    </td>
                    <td style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {students.length > rowsPerPage && (
          <TablePagination
            total={students.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
          />
        )}
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "2rem", alignItems: "start" }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={18} />
              Enrollment preview
            </h3>
            <p style={{ marginTop: 0, color: "var(--gray-500)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              The selected students will be enrolled in the following class offerings for {selectedGrade?.name} {selectedSection?.name}.
            </p>

            {selectedOfferingCount === 0 ? (
              <div style={{ padding: 14, borderRadius: 12, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", fontSize: "0.85rem" }}>
                No class offerings found for this section.
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: "1px solid var(--gray-200)", borderRadius: 12 }}>
                <table style={{ background: "transparent" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "var(--gray-50)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.025em" }}>Subject</th>
                      <th style={{ background: "var(--gray-50)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.025em" }}>Code</th>
                      <th style={{ background: "var(--gray-50)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.025em" }}>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerings.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600, fontSize: "0.9rem" }}>{o.subjectName ?? o.displayName ?? o.name}</td>
                        <td style={{ fontSize: "0.85rem", color: "var(--gray-500)" }}>{(o as any).subjectCode || "—"}</td>
                        <td style={{ fontSize: "0.85rem", color: "var(--gray-600)" }}>{(o as any).teacherName || "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Students selected</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{selectedStudentIds.length}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Subjects enrolled</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{selectedOfferingCount}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Assign section & enroll"}
          </button>
        </div>
      </div>
    </div>
  );
}