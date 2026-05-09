"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Trophy,
  Calendar as CalendarIcon,
  GraduationCap,
  CheckCircle2,
  Clock,
  Save,
  AlertCircle,
  Printer,
  Home,
  ArrowLeft,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import {
  getActiveAcademicYear,
  listAcademicYears,
  listTerms,
  listGrades,
  listSections,
  listHomeroomAssignments,
  getClassTermReportCard,
  getStudentTermReportCard,
  upsertReportCardRemark,
  type AcademicYear,
  type TermRow,
  type Grade,
  type Section,
  type HomeroomAssignmentRow,
  type ClassTermReportCard,
  type ClassTermReportCardRow,
  type StudentTermReportCard,
} from "@/lib/admin-api";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";

function rankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { background: "linear-gradient(135deg, #fde68a, #f59e0b)", color: "#78350f" };
  if (rank === 2) return { background: "linear-gradient(135deg, #e5e7eb, #9ca3af)", color: "#1f2937" };
  if (rank === 3) return { background: "linear-gradient(135deg, #fecaca, #ef4444)", color: "#7f1d1d" };
  return { background: "var(--gray-100)", color: "var(--gray-600)" };
}

function pctColor(pct: number | null): string {
  if (pct == null) return "var(--gray-400)";
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--primary-600)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}

export default function AdminReportCardsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [assignments, setAssignments] = useState<HomeroomAssignmentRow[]>([]);

  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const [bootLoading, setBootLoading] = useState(true);
  const [bootErr, setBootErr] = useState<string | null>(null);

  const [classCard, setClassCard] = useState<ClassTermReportCard | null>(null);
  const [classLoading, setClassLoading] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentCard, setStudentCard] = useState<StudentTermReportCard | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  const [remark, setRemark] = useState("");
  const [conduct, setConduct] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [query, setQuery] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setBootErr(null);
      try {
        const [yearsRes, activeYear, gradesRes, sectionsRes] = await Promise.all([
          listAcademicYears(),
          getActiveAcademicYear(),
          listGrades(),
          listSections(),
        ]);
        if (cancelled) return;
        setYears(yearsRes);
        setGrades(gradesRes);
        setSections(sectionsRes);
        const yearId = activeYear?.id ?? yearsRes[0]?.id ?? "";
        setSelectedYearId(yearId);
      } catch (e) {
        if (!cancelled) setBootErr(e instanceof Error ? e.message : "Failed to bootstrap");
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load terms + assignments when year changes
  useEffect(() => {
    if (!selectedYearId) return;
    let cancelled = false;
    (async () => {
      try {
        const [termsRes, assignmentsRes] = await Promise.all([
          listTerms(selectedYearId).catch(() => [] as TermRow[]),
          listHomeroomAssignments(selectedYearId).catch(() => [] as HomeroomAssignmentRow[]),
        ]);
        if (cancelled) return;
        setTerms(termsRes);
        setAssignments(assignmentsRes);
        if (termsRes[0] && !selectedTermId) setSelectedTermId(termsRes[0].id);
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearId]);

  // Load class card when grade/section/term selected
  const loadClass = useCallback(async () => {
    if (!selectedGradeId || !selectedSectionId || !selectedTermId) {
      setClassCard(null);
      return;
    }
    setClassLoading(true);
    try {
      const data = await getClassTermReportCard(selectedGradeId, selectedSectionId, selectedTermId);
      setClassCard(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load class report card", false);
      setClassCard(null);
    } finally {
      setClassLoading(false);
    }
  }, [selectedGradeId, selectedSectionId, selectedTermId]);

  useEffect(() => {
    if (!selectedStudentId) void loadClass();
  }, [selectedStudentId, loadClass]);

  // Load student detail
  const loadStudent = useCallback(async () => {
    if (!selectedStudentId || !selectedTermId) return;
    setStudentLoading(true);
    try {
      const data = await getStudentTermReportCard(selectedStudentId, selectedTermId);
      setStudentCard(data);
      setRemark(data.homeroomRemark?.remark ?? "");
      setConduct(data.homeroomRemark?.conductGrade ?? "");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load student report card", false);
      setStudentCard(null);
    } finally {
      setStudentLoading(false);
    }
  }, [selectedStudentId, selectedTermId]);

  useEffect(() => {
    if (selectedStudentId && selectedTermId) void loadStudent();
  }, [selectedStudentId, selectedTermId, loadStudent]);

  async function handleSaveRemark() {
    if (!studentCard || !selectedTermId) return;
    if (!remark.trim()) {
      showToast("Remark cannot be empty", false);
      return;
    }
    setSavingRemark(true);
    try {
      await upsertReportCardRemark({
        studentId: studentCard.student.id,
        termId: selectedTermId,
        remark: remark.trim(),
        conductGrade: conduct.trim() || undefined,
      });
      showToast("Remark saved successfully");
      await loadStudent();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save remark", false);
    } finally {
      setSavingRemark(false);
    }
  }

  // Build class options from homeroom assignments
  const classOptions = useMemo(() => {
    return assignments.map((a) => {
      const g = grades.find((gg) => gg.id === a.gradeId);
      const s = sections.find((ss) => ss.id === a.sectionId);
      return {
        gradeId: a.gradeId,
        sectionId: a.sectionId,
        label: `${a.gradeName || g?.name || "Grade"} · ${a.sectionName || s?.name || "Section"}`,
        teacher: a.teacherName ?? "",
      };
    });
  }, [assignments, grades, sections]);

  const filteredStudents = useMemo(() => {
    if (!classCard) return [];
    const q = query.trim().toLowerCase();
    if (!q) return classCard.students;
    return classCard.students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [classCard, query]);

  if (bootLoading) {
    return (
      <div className="page-wrapper">
        <div className="admin-skeleton shimmer" style={{ height: 120, borderRadius: 18, marginBottom: 16 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="admin-skeleton shimmer" style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (bootErr) {
    return (
      <div className="page-wrapper">
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 14, padding: "1.25rem 1.5rem", color: "#991b1b" }}>
          <strong>Error:</strong> {bootErr}
        </div>
      </div>
    );
  }

  // ─── STUDENT DETAIL VIEW ─────────────────────────────────────────────────

  if (selectedStudentId) {
    return (
      <div className="page-wrapper">
        <button
          type="button"
          onClick={() => {
            setSelectedStudentId(null);
            setStudentCard(null);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: "var(--gray-600)",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "1rem",
            padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back to class
        </button>

        <TermPicker terms={terms} selected={selectedTermId} onChange={setSelectedTermId} />

        {studentLoading ? (
          <div className="admin-skeleton shimmer" style={{ height: 400, borderRadius: 18, marginTop: 16 }} />
        ) : !studentCard ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--gray-500)" }}>
            No data available.
          </div>
        ) : (
          <StudentReportCardView
            card={studentCard}
            canEditRemark
            remark={remark}
            setRemark={setRemark}
            conduct={conduct}
            setConduct={setConduct}
            saving={savingRemark}
            onSave={handleSaveRemark}
          />
        )}

        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ─── CLASS LIST VIEW ─────────────────────────────────────────────────────

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="School-wide Report Cards"
        title="All Classes & Students"
        subtitle="Browse class rankings, view per-student details, and override homeroom remarks."
        icon={<FileText size={22} />}
      />

      {/* Filter bar */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid var(--gray-100)",
          padding: "1rem 1.25rem",
          marginBottom: "1rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Academic Year">
          <NativeSelect value={selectedYearId} onChange={setSelectedYearId}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.isActive ? " (Active)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Term">
          <NativeSelect value={selectedTermId} onChange={setSelectedTermId}>
            <option value="">Select term…</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Class (Grade · Section)">
          <NativeSelect
            value={selectedGradeId && selectedSectionId ? `${selectedGradeId}|${selectedSectionId}` : ""}
            onChange={(v) => {
              if (!v) {
                setSelectedGradeId("");
                setSelectedSectionId("");
                return;
              }
              const [gId, sId] = v.split("|");
              setSelectedGradeId(gId);
              setSelectedSectionId(sId);
            }}
          >
            <option value="">Select class…</option>
            {classOptions.length === 0 && (
              <option value="" disabled>
                No homeroom classes assigned for this year
              </option>
            )}
            {classOptions.map((c) => (
              <option key={`${c.gradeId}|${c.sectionId}`} value={`${c.gradeId}|${c.sectionId}`}>
                {c.label}
                {c.teacher ? ` (${c.teacher})` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {/* Class result */}
      {!selectedGradeId || !selectedSectionId || !selectedTermId ? (
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
          <FileText size={36} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
          <div style={{ fontSize: "0.95rem" }}>Select an academic year, term, and class to view report cards.</div>
        </div>
      ) : classLoading ? (
        <div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="admin-skeleton shimmer" style={{ height: 56, borderRadius: 12, marginBottom: 8 }} />
          ))}
        </div>
      ) : !classCard || classCard.students.length === 0 ? (
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
          <FileText size={36} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
          <div style={{ fontSize: "0.95rem" }}>No grades released yet for this term.</div>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1.5px solid var(--gray-100)",
              padding: "0.75rem 1rem",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Search size={14} color="var(--gray-400)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter students by name…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "0.88rem",
                background: "transparent",
                color: "var(--gray-800)",
              }}
            />
            <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>
              {filteredStudents.length} of {classCard.students.length}
            </span>
          </div>

          {/* List */}
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
                gridTemplateColumns: "60px 1fr 110px 110px 110px",
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
              <span>Rank</span>
              <span>Student</span>
              <span style={{ textAlign: "center" }}>Overall %</span>
              <span style={{ textAlign: "center" }}>Grade</span>
              <span style={{ textAlign: "center" }}>Attendance</span>
            </div>
            {filteredStudents.map((row, i) => (
              <ClassRow
                key={row.studentId}
                row={row}
                isLast={i === filteredStudents.length - 1}
                onClick={() => setSelectedStudentId(row.studentId)}
              />
            ))}
          </div>
        </>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── Reusable sub-components ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
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
        width: "100%",
        padding: "0.55rem 0.75rem",
        borderRadius: 8,
        border: "1.5px solid var(--gray-200)",
        background: "#fff",
        color: "var(--gray-800)",
        fontSize: "0.88rem",
        outline: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function TermPicker({ terms, selected, onChange }: { terms: TermRow[]; selected: string; onChange: (id: string) => void }) {
  if (terms.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, border: "1.5px solid var(--gray-100)", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: 12 }}>
        No terms defined for this academic year.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "#fff", borderRadius: 12, border: "1.5px solid var(--gray-100)", padding: "0.6rem", marginBottom: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.4rem 0.6rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <CalendarIcon size={13} /> Term:
      </span>
      {terms.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 8,
            background: selected === t.id ? "var(--primary-600)" : "var(--gray-50)",
            color: selected === t.id ? "#fff" : "var(--gray-700)",
            fontSize: "0.82rem",
            fontWeight: 600,
            border: selected === t.id ? "1px solid var(--primary-600)" : "1px solid var(--gray-100)",
            cursor: "pointer",
          }}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

function ClassRow({ row, isLast, onClick }: { row: ClassTermReportCardRow; isLast: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 110px 110px 110px",
        alignItems: "center",
        padding: "0.85rem 1.25rem",
        borderBottom: isLast ? "none" : "1px solid var(--gray-100)",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-50)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            fontSize: "0.85rem",
            fontWeight: 800,
            ...rankBadgeStyle(row.rank),
          }}
        >
          {row.rank <= 3 ? <Trophy size={14} /> : row.rank}
        </div>
      </div>
      <div style={{ fontWeight: 600, color: "var(--gray-900)", fontSize: "0.93rem" }}>
        {row.firstName} {row.lastName}
      </div>
      <div style={{ textAlign: "center", fontSize: "0.95rem", fontWeight: 700, color: pctColor(row.overallPercent) }}>
        {row.overallPercent != null ? `${row.overallPercent.toFixed(1)}%` : "—"}
      </div>
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.2rem 0.6rem",
            borderRadius: 6,
            background: "var(--gray-50)",
            color: "var(--gray-700)",
            fontWeight: 700,
            fontSize: "0.85rem",
            border: "1px solid var(--gray-100)",
          }}
        >
          {row.overallLetterGrade ?? "—"}
        </span>
      </div>
      <div style={{ textAlign: "center", fontSize: "0.85rem", fontWeight: 600, color: row.attendancePercent != null && row.attendancePercent >= 85 ? "var(--success)" : "var(--gray-600)" }}>
        {row.attendancePercent != null ? `${row.attendancePercent.toFixed(1)}%` : "—"}
      </div>
    </div>
  );
}

function StudentReportCardView({
  card,
  canEditRemark,
  remark,
  setRemark,
  conduct,
  setConduct,
  saving,
  onSave,
}: {
  card: StudentTermReportCard;
  canEditRemark: boolean;
  remark: string;
  setRemark: (v: string) => void;
  conduct: string;
  setConduct: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      {/* Header card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          border: "1.5px solid var(--gray-100)",
          padding: "1.5rem",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <AuthenticatedAvatar
            fileId={card.student.profileImageFileId}
            initials={(card.student.firstName?.[0] ?? "") + (card.student.lastName?.[0] ?? "")}
            size={64}
          />
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--gray-900)" }}>
              {card.student.firstName} {card.student.lastName}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginTop: 2 }}>
              {card.student.grade}
              {card.student.section ? ` · Section ${card.student.section}` : ""} · {card.term.name} · {card.academicYear.label}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0.55rem 1rem",
            borderRadius: 10,
            background: "var(--gray-50)",
            color: "var(--gray-700)",
            fontSize: "0.85rem",
            fontWeight: 600,
            border: "1px solid var(--gray-100)",
            cursor: "pointer",
          }}
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard
          icon={<Trophy size={18} />}
          label="Overall %"
          value={card.overallPercent != null ? `${card.overallPercent.toFixed(1)}%` : "—"}
          color={pctColor(card.overallPercent)}
        />
        <StatCard
          icon={<GraduationCap size={18} />}
          label="Letter Grade"
          value={card.overallLetterGrade ?? "—"}
          color="var(--primary-600)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="GPA"
          value={card.overallGpa != null ? card.overallGpa.toFixed(2) : "—"}
          color="var(--purple)"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Attendance"
          value={`${card.attendance.attendancePercent.toFixed(1)}%`}
          color={card.attendance.attendancePercent >= 85 ? "var(--success)" : "var(--warning)"}
          subtitle={`${card.attendance.present}/${card.attendance.total} present`}
        />
      </div>

      {/* Subjects */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid var(--gray-100)",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--gray-100)",
            background: "var(--gray-50)",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--gray-800)",
          }}
        >
          Subjects ({card.subjects.length})
        </div>
        {card.subjects.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--gray-500)" }}>
            No subject grades available for this term.
          </div>
        ) : (
          card.subjects.map((subj, idx) => (
            <div
              key={subj.subjectId}
              style={{
                padding: "1rem 1.25rem",
                borderBottom: idx < card.subjects.length - 1 ? "1px solid var(--gray-100)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--gray-900)", fontSize: "1rem" }}>{subj.subjectName}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginTop: 2 }}>
                    Teacher: {subj.teacherName} · {subj.summary.totalEntries} entries
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "1rem",
                      color: pctColor(subj.summary.averagePercent),
                    }}
                  >
                    {subj.summary.averagePercent != null ? `${subj.summary.averagePercent.toFixed(1)}%` : "—"}
                  </span>
                  <span
                    style={{
                      padding: "0.2rem 0.55rem",
                      borderRadius: 6,
                      background: "var(--gray-50)",
                      color: "var(--gray-700)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      border: "1px solid var(--gray-100)",
                    }}
                  >
                    {subj.summary.letterGrade ?? "—"}
                  </span>
                </div>
              </div>
              {subj.entries.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {subj.entries.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.3rem 0.55rem",
                        borderRadius: 6,
                        background: "var(--gray-50)",
                        border: "1px solid var(--gray-100)",
                        color: "var(--gray-700)",
                      }}
                      title={`${e.title} (${e.type})`}
                    >
                      <span style={{ fontWeight: 600 }}>{e.title}</span>:{" "}
                      <span style={{ fontWeight: 700, color: pctColor(e.percent) }}>
                        {e.score != null ? `${e.score}/${e.maxScore}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Homeroom remark */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid var(--gray-100)",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Home size={16} color="var(--primary-600)" />
          <div style={{ fontWeight: 700, color: "var(--gray-900)", fontSize: "0.95rem" }}>Homeroom Teacher's Remark</div>
          <span
            style={{
              marginLeft: 8,
              padding: "0.15rem 0.5rem",
              borderRadius: 6,
              background: "var(--primary-50)",
              color: "var(--primary-700)",
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Admin Override
          </span>
        </div>

        {canEditRemark && (
          <>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Write remark for this student…"
              rows={4}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: "1.5px solid var(--gray-200)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                color: "var(--gray-800)",
                background: "var(--gray-50)",
                resize: "vertical",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 240px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Conduct:</label>
                <input
                  type="text"
                  value={conduct}
                  onChange={(e) => setConduct(e.target.value)}
                  placeholder="e.g. A, B+, Excellent"
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    borderRadius: 8,
                    border: "1.5px solid var(--gray-200)",
                    fontSize: "0.85rem",
                    background: "var(--gray-50)",
                    outline: "none",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !remark.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0.6rem 1.25rem",
                  borderRadius: 10,
                  background: saving || !remark.trim() ? "var(--gray-200)" : "var(--primary-600)",
                  color: saving || !remark.trim() ? "var(--gray-500)" : "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: saving || !remark.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Save size={14} /> {saving ? "Saving…" : "Save Remark"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid var(--gray-100)", padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: "0.76rem", color: "var(--gray-500)", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: ok ? "var(--success)" : "var(--danger)",
        color: "#fff",
        padding: "0.75rem 1.25rem",
        borderRadius: 10,
        fontSize: "0.88rem",
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        zIndex: 9999,
        maxWidth: 360,
      }}
    >
      {msg}
    </div>
  );
}
