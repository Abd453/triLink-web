"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getStoredUser } from "@/lib/auth";
import { cachedFetch } from "@/lib/cache";
import { toLetterGrade, type LetterGrade } from "@/lib/grading";
import {
  getActiveAcademicYear,
  getStudentGradesByTerm,
  type StudentTermGradesResponse,
  type StudentTermGradesSubject,
  type GradeEntryType,
} from "@/lib/admin-api";
import { PageHeader, TableSkeleton, EmptyState, StatGridSkeleton } from "@/components/ui";
import { GraduationCap, Award, BookOpen, AlertCircle } from "lucide-react";

type SubjectStats = {
  subjectId: string;
  subjectName: string;
  totalEntries: number;
  scoredEntries: number;
  averagePercent: number | null;
  letterGrade: LetterGrade | null;
};

const TYPE_BADGE: Record<GradeEntryType, { bg: string; fg: string; label: string }> = {
  exam:       { bg: "#eef2ff", fg: "#4338ca", label: "Exam" },
  assignment: { bg: "#ecfdf5", fg: "#047857", label: "Assignment" },
  quiz:       { bg: "#fffbeb", fg: "#b45309", label: "Quiz" },
  project:    { bg: "#fdf4ff", fg: "#a21caf", label: "Project" },
  other:      { bg: "#f1f5f9", fg: "#475569", label: "Other" },
};

function percentColor(p: number | null): string {
  if (p == null) return "var(--gray-400)";
  if (p >= 85) return "var(--success)";
  if (p >= 70) return "var(--primary-600)";
  if (p >= 50) return "var(--warning)";
  return "var(--danger)";
}

function headerPercentColor(p: number | null): string {
  if (p == null) return "rgba(255,255,255,0.4)";
  if (p >= 85) return "#34d399";
  if (p >= 70) return "#60a5fa";
  if (p >= 50) return "#fbbf24";
  return "#f87171";
}


function buildSubjectStats(subject: StudentTermGradesSubject): SubjectStats {
  const scored = subject.entries.filter(
    (e) => e.score != null && e.maxScore > 0,
  );
  const averagePercent =
    scored.length > 0
      ? Math.round(
          (scored.reduce(
            (s, e) => s + (e.score! / e.maxScore) * 100,
            0,
          ) /
            scored.length) *
            10,
        ) / 10
      : null;
  return {
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    totalEntries: subject.entries.length,
    scoredEntries: scored.length,
    averagePercent,
    letterGrade: averagePercent != null ? toLetterGrade(averagePercent) : null,
  };
}

export default function StudentGradesPage() {
  useCurrentUser("student");
  const stored = typeof window !== "undefined" ? getStoredUser() : null;
  const studentId = stored?.id ?? null;

  const { selectedTermId, selectedTermName } = useTermStore();

  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [data, setData] = useState<StudentTermGradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadYear = useCallback(async () => {
    try {
      const year = await cachedFetch("active-year", () => getActiveAcademicYear(), 120_000);
      setActiveYearId(year?.id ?? null);
    } catch {
      setActiveYearId(null);
    }
  }, []);

  const loadGrades = useCallback(async () => {
    if (!studentId || !selectedTermId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const result = await getStudentGradesByTerm(studentId, selectedTermId);
      setData(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load grades");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, selectedTermId]);

  useEffect(() => {
    void loadYear();
  }, [loadYear]);

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  const subjectStats = useMemo(() => {
    if (!data) return [];
    return data.subjects.map(buildSubjectStats);
  }, [data]);

  const overall = useMemo(() => {
    const withAvg = subjectStats.filter((s) => s.averagePercent != null);
    if (withAvg.length === 0) return { percent: null as number | null, letter: null as LetterGrade | null, count: 0 };
    const avg =
      Math.round(
        (withAvg.reduce((s, x) => s + x.averagePercent!, 0) / withAvg.length) * 10,
      ) / 10;
    return { percent: avg, letter: toLetterGrade(avg), count: withAvg.length };
  }, [subjectStats]);

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="My Grades"
        title={selectedTermName ?? "Term Grades"}
        subtitle="All released assessments for the selected term, grouped by subject."
        icon={<GraduationCap size={22} />}
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <TermSelector academicYearId={activeYearId} onTermChange={() => undefined} />
            {overall.percent != null && (
              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 14,
                  padding: "0.55rem 0.95rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  color: "#fff",
                }}
              >
                <Award size={18} style={{ color: headerPercentColor(overall.percent) }} />
                <div>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                    Overall
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1 }}>
                    {overall.percent}% <span style={{ color: headerPercentColor(overall.percent), fontSize: "0.9rem", fontWeight: 700 }}>{overall.letter}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      />

      {/* ── Body ── */}
      {!selectedTermId ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="Select a term to view your grades"
          description="Choose an academic term from the picker above to see your released assessments grouped by subject."
        />
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StatGridSkeleton count={4} />
          <TableSkeleton rows={5} columns={6} />
          <TableSkeleton rows={4} columns={6} showHeader={false} />
        </div>
      ) : err ? (
        <EmptyState
          icon={<AlertCircle size={26} />}
          title="Couldn't load grades"
          description={err}
          action={(
            <button className="btn btn-primary" onClick={() => void loadGrades()} style={{ borderRadius: 12 }}>Try again</button>
          )}
        />
      ) : !data || data.subjects.length === 0 ? (
        <EmptyState
          icon={<Award size={26} />}
          title="No grades yet for this term"
          description="Released assessments will appear here grouped by subject as soon as your teachers publish them."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Subject summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {subjectStats.map((s) => (
              <div
                key={s.subjectId}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "1rem 1.15rem",
                  border: "1.5px solid var(--gray-100)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--gray-400)",
                    fontWeight: 700,
                  }}
                >
                  {s.subjectName}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: percentColor(s.averagePercent),
                    }}
                  >
                    {s.averagePercent != null ? `${s.averagePercent}%` : "—"}
                  </span>
                  {s.letterGrade && (
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: percentColor(s.averagePercent),
                      }}
                    >
                      {s.letterGrade}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray-500)", marginTop: 4 }}>
                  {s.scoredEntries} / {s.totalEntries} graded
                </div>
              </div>
            ))}
          </div>

          {/* Per-subject details */}
          {data.subjects.map((subject) => {
            const stats = subjectStats.find((x) => x.subjectId === subject.subjectId)!;
            return (
              <div key={subject.subjectId} className="card" style={{ overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "0.9rem 1.25rem",
                    background: "var(--gray-50)",
                    borderBottom: "1.5px solid var(--gray-100)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--gray-900)" }}>
                      {subject.subjectName}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>
                      {subject.entries.length} assessment{subject.entries.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {stats.averagePercent != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--gray-500)", fontWeight: 600 }}>
                        Average
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          color: percentColor(stats.averagePercent),
                        }}
                      >
                        {stats.averagePercent}% · {stats.letterGrade}
                      </span>
                    </div>
                  )}
                </div>
                <div className="table-wrapper" style={{ margin: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th style={{ width: 110 }}>Type</th>
                        <th style={{ textAlign: "center", width: 100 }}>Score</th>
                        <th style={{ textAlign: "center", width: 80 }}>%</th>
                        <th style={{ width: 110 }}>Released</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subject.entries.map((e) => {
                        const badge = TYPE_BADGE[e.type] ?? TYPE_BADGE.other;
                        const pct =
                          e.percent != null
                            ? e.percent
                            : e.score != null && e.maxScore > 0
                            ? Math.round((e.score / e.maxScore) * 1000) / 10
                            : null;
                        return (
                          <tr key={e.id}>
                            <td style={{ fontWeight: 600 }}>{e.title}</td>
                            <td>
                              <span
                                style={{
                                  display: "inline-flex",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: 999,
                                  background: badge.bg,
                                  color: badge.fg,
                                }}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: percentColor(pct) }}>
                              {e.score != null ? `${e.score} / ${e.maxScore}` : "—"}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: percentColor(pct) }}>
                              {pct != null ? `${pct}%` : "—"}
                            </td>
                            <td style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                              {e.releasedAt
                                ? new Date(e.releasedAt).toLocaleDateString()
                                : "—"}
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>
                              {e.note || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
