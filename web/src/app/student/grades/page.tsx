"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveAcademicYear,
  listStudentExams,
  listGradesForStudent,
  type Exam,
  type GradeEntry,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";
import { toLetterGrade } from "@/lib/grading";

// Unified row shown in the table
type GradeRow = {
  id: string;           // attemptId or gradeEntryId
  title: string;
  type: string;         // "exam" | "assignment" | "quiz" | "project" | "other"
  score: number;
  maxPoints: number;
  percent: number;
  letter: string;
  releasedAt: string;
  note?: string | null;
  // only for platform exams
  attemptId?: string;
};

function scoreColor(pct: number) {
  if (pct >= 90) return "var(--success)";
  if (pct >= 70) return "var(--primary-600)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    exam: "badge-primary",
    quiz: "badge-warning",
    assignment: "badge-success",
    project: "badge-success",
    other: "",
  };
  return <span className={`badge ${colors[type] ?? ""}`}>{type}</span>;
}

export default function StudentGradesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GradeRow[]>([]);

  const load = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const year = await getActiveAcademicYear();
      const me = getStoredUser();
      const meId = me?.id;
      if (!year?.id || !meId) {
        setRows([]);
        return;
      }

      // Fetch platform exam results + grade-ledger entries in parallel
      const [exams, gradeEntries] = await Promise.all([
        listStudentExams(year.id).catch(() => [] as Exam[]),
        listGradesForStudent(meId).catch(() => [] as GradeEntry[]),
      ]);

      const combined: GradeRow[] = [];

      // ── Platform exam attempts ──────────────────────────────────────────
      const attemptSortTime = (a: NonNullable<Exam["attempts"]>[number]) => {
        const t = a.releasedAt ?? a.submittedAt ?? a.startedAt;
        return t ? new Date(t).getTime() : 0;
      };

      // Track which exam titles are already covered by grade-ledger entries
      // so we don't double-count platform exams
      const ledgerExamTitles = new Set(
        gradeEntries.filter(g => g.type === "exam").map(g => g.title)
      );

      for (const ex of exams) {
        // Skip if the grade ledger already has this exam (auto-created entry)
        if (ledgerExamTitles.has(ex.title)) continue;

        const mineAttempts = (ex.attempts || []).filter(a => !meId || a.studentId === meId);
        const mine = mineAttempts.reduce<typeof mineAttempts[number] | undefined>((latest, cur) => {
          if (!latest) return cur;
          return attemptSortTime(cur) > attemptSortTime(latest) ? cur : latest;
        }, undefined);

        // Only show released results with a score
        if (!mine || mine.score == null || !mine.releasedAt) continue;

        const percent = ex.maxPoints > 0
          ? Math.round((mine.score / ex.maxPoints) * 1000) / 10
          : 0;

        combined.push({
          id: mine.id,
          title: ex.title,
          type: "exam",
          score: mine.score,
          maxPoints: ex.maxPoints,
          percent,
          letter: toLetterGrade(percent),
          releasedAt: mine.releasedAt,
          attemptId: mine.id,
        });
      }

      // ── Grade ledger entries (assignments, quizzes, exams) ──────────────
      for (const g of gradeEntries) {
        // listGradesForStudent already filters to released-only for students
        if (g.score == null) continue;
        const percent = g.maxScore > 0
          ? Math.round((g.score / g.maxScore) * 1000) / 10
          : 0;
        combined.push({
          id: g.id,
          title: g.title,
          type: g.type,
          score: g.score,
          maxPoints: g.maxScore,
          percent,
          letter: toLetterGrade(percent),
          releasedAt: g.releasedAt!,
          note: g.note,
          // if it's an exam type and has an attemptId, allow viewing detail
          attemptId: g.examAttemptId ?? undefined,
        });
      }

      // Sort newest first
      combined.sort((a, b) =>
        new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
      );

      setRows(combined);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to load grades");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void load();

    const onFocus = () => { if (!cancelled) void load({ silent: true }); };
    const onVisible = () => { if (!cancelled && document.visibilityState === "visible") void load({ silent: true }); };
    const intervalId = window.setInterval(() => { if (!cancelled && !document.hidden) void load({ silent: true }); }, 30_000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(intervalId);
    };
  }, []);

  const summary = useMemo(() => {
    if (rows.length === 0) return { count: 0, avg: 0, highest: 0, lowest: 0 };
    const avg = Math.round((rows.reduce((s, r) => s + r.percent, 0) / rows.length) * 10) / 10;
    const highest = Math.max(...rows.map(r => r.percent));
    const lowest = Math.min(...rows.map(r => r.percent));
    return { count: rows.length, avg, highest, lowest };
  }, [rows]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--gray-500)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Loading grades…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)" }}>My Grades</h1>
      <p style={{ marginTop: "0.35rem", color: "var(--gray-500)", fontSize: "0.9rem" }}>
        Released results from your teacher — exams, assignments, quizzes, and more.
      </p>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { label: "Released Results", value: summary.count },
          { label: "Average", value: summary.count > 0 ? `${summary.avg}%` : "—", color: summary.count > 0 ? scoreColor(summary.avg) : undefined },
          { label: "Highest", value: summary.count > 0 ? `${summary.highest}%` : "—", color: summary.count > 0 ? scoreColor(summary.highest) : undefined },
          { label: "Lowest", value: summary.count > 0 ? `${summary.lowest}%` : "—", color: summary.count > 0 ? scoreColor(summary.lowest) : undefined },
        ].map(card => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 10, padding: "0.75rem 1rem", minWidth: 100 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--gray-500)", marginBottom: "0.2rem" }}>{card.label}</div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: card.color ?? "var(--gray-900)" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed var(--gray-200)", borderRadius: 12, padding: "3rem", textAlign: "center", color: "var(--gray-400)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No released grades yet</div>
          <div style={{ fontSize: "0.85rem" }}>Your teacher will release results here once graded.</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--gray-50)" }}>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Title</th>
                <th style={{ textAlign: "center", padding: "0.75rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Type</th>
                <th style={{ textAlign: "center", padding: "0.75rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Score</th>

                <th style={{ textAlign: "left", padding: "0.75rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Released</th>
                <th style={{ textAlign: "center", padding: "0.75rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--gray-100)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    {r.title}
                    {r.note && <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 400, marginTop: "0.15rem" }}>{r.note}</div>}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                    <TypeBadge type={r.type} />
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", fontWeight: 700, color: scoreColor(r.percent) }}>
                    {r.score}/{r.maxPoints}
                  </td>

                  <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem", color: "var(--gray-500)" }}>
                    {new Date(r.releasedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                    {r.attemptId ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => router.push(`/student/result/${r.attemptId}`)}
                      >
                        View
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--gray-400)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
