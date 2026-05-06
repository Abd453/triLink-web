"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  PlayCircle,
  Search,
  Timer,
} from "lucide-react";
import { getActiveAcademicYear, listStudentExams, type Exam } from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";

type ExamStatus = "available" | "completed" | "upcoming" | "missed";

type ExamRow = {
  exam: Exam;
  attempt?: NonNullable<Exam["attempts"]>[number];
  status: ExamStatus;
};

const pageShell: React.CSSProperties = {
  minHeight: "calc(100vh - 108px)",
  margin: "-1.5rem",
  padding: "2rem",
  background:
    "radial-gradient(circle at top right, rgba(224, 231, 255, 0.72), transparent 34rem), linear-gradient(180deg, #F4F7FE 0%, #F8FAFC 100%)",
  fontFamily: "Inter, var(--font-display), system-ui, sans-serif",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 28,
  border: "1px solid rgba(226, 232, 240, 0.58)",
  boxShadow: "0 22px 54px rgba(15, 23, 42, 0.055)",
};

function getStatus(exam: Exam, attempt?: NonNullable<Exam["attempts"]>[number]): ExamStatus {
  if (attempt?.submittedAt) return "completed";
  const now = Date.now();
  const opens = new Date(exam.opensAt).getTime();
  const closes = new Date(exam.closesAt).getTime();
  if (now >= opens && now <= closes) return "available";
  if (now > closes) return "missed";
  return "upcoming";
}

function StatusPill({ status }: { status: ExamStatus }) {
  const styles: Record<ExamStatus, { bg: string; fg: string; label: string }> = {
    available: { bg: "#DCFCE7", fg: "#166534", label: "Available" },
    completed: { bg: "#E0E7FF", fg: "#3730A3", label: "Completed" },
    upcoming: { bg: "#FEF3C7", fg: "#92400E", label: "Upcoming" },
    missed: { bg: "#FEE2E2", fg: "#991B1B", label: "Missed" },
  };
  const s = styles[status];
  return (
    <span style={{ display: "inline-flex", borderRadius: 999, padding: "0.35rem 0.75rem", background: s.bg, color: s.fg, fontSize: "0.72rem", fontWeight: 900 }}>
      {s.label}
    </span>
  );
}

export default function StudentExamsPage() {
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ExamStatus>("all");
  const [yearLabel, setYearLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const year = await getActiveAcademicYear();
        setYearLabel(year?.label ?? null);
        if (!year?.id) {
          setRows([]);
          return;
        }
        const meId = getStoredUser()?.id;
        const exams = await listStudentExams(year.id);
        const mapped = exams.map((exam) => {
          const attempts = exam.attempts ?? [];
          const attempt = attempts.find((row) => !meId || row.studentId === meId) ?? attempts[0];
          return { exam, attempt, status: getStatus(exam, attempt) };
        });
        if (!cancelled) setRows(mapped);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load exams");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const haystack = `${row.exam.title} ${row.exam.classOffering?.displayName ?? ""} ${row.exam.classOffering?.subjectName ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query, rows]);

  const counts = {
    all: rows.length,
    available: rows.filter((row) => row.status === "available").length,
    completed: rows.filter((row) => row.status === "completed").length,
    upcoming: rows.filter((row) => row.status === "upcoming").length,
  };

  return (
    <div style={pageShell}>
      <div style={{ display: "grid", gap: "1.5rem", maxWidth: 1440, margin: "0 auto" }}>
        <section style={{ ...card, padding: "2rem", background: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 58%, #EEF2FF 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.42rem 0.75rem", borderRadius: 999, background: "#EEF2FF", color: "#4F46E5", fontWeight: 900, fontSize: "0.78rem", marginBottom: "1rem" }}>
                <FileText size={15} />
                Exam Center
              </div>
              <h1 className="premium-hero-title" style={{ margin: 0, color: "#0F172A", lineHeight: 1.04, fontWeight: 900, letterSpacing: 0 }}>
                Exams
              </h1>
              <p style={{ margin: "0.75rem 0 0", color: "#64748B", fontWeight: 600, lineHeight: 1.7 }}>
                {yearLabel ? `Showing exams for ${yearLabel}.` : "No active academic year found."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 280, padding: "0.75rem 0.95rem", borderRadius: 18, background: "#fff", border: "1px solid #E2E8F0" }}>
              <Search size={18} color="#94A3B8" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exams" style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "#0F172A", fontWeight: 700 }} />
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          {[
            { label: "All Exams", value: counts.all, icon: FileText, bg: "linear-gradient(135deg, #E0E7FF 0%, #F5D0FE 100%)", color: "#4F46E5" },
            { label: "Available", value: counts.available, icon: PlayCircle, bg: "linear-gradient(135deg, #DCFCE7 0%, #BAE6FD 100%)", color: "#047857" },
            { label: "Completed", value: counts.completed, icon: CheckCircle2, bg: "linear-gradient(135deg, #E0E7FF 0%, #DBEAFE 100%)", color: "#3730A3" },
            { label: "Upcoming", value: counts.upcoming, icon: Clock3, bg: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)", color: "#B45309" },
          ].map((item) => (
            <div key={item.label} style={{ ...card, padding: "1.35rem" }}>
              <div style={{ width: 50, height: 50, borderRadius: 18, background: item.bg, color: item.color, display: "grid", placeItems: "center", marginBottom: "1rem" }}>
                <item.icon size={21} />
              </div>
              <div style={{ color: "#64748B", fontSize: "0.8rem", fontWeight: 800 }}>{item.label}</div>
              <div style={{ color: "#0F172A", fontSize: "2rem", fontWeight: 900, marginTop: "0.25rem" }}>{item.value}</div>
            </div>
          ))}
        </section>

        <section style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", borderBottom: "1px solid #F1F5F9" }}>
            {(["all", "available", "upcoming", "completed", "missed"] as const).map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: 999,
                  border: "1px solid transparent",
                  background: filter === key ? "#4F46E5" : "#F8FAFC",
                  color: filter === key ? "#fff" : "#64748B",
                  fontWeight: 900,
                  textTransform: "capitalize",
                  transition: "all 160ms ease",
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {error ? (
            <div style={{ padding: "2rem", color: "#B91C1C", fontWeight: 800 }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: "2rem", color: "#64748B", fontWeight: 800 }}>Loading exams...</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "3rem 2rem", textAlign: "center", color: "#64748B", fontWeight: 700 }}>No exams match this view.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Exam", "Class", "Window", "Duration", "Score", "Status", ""].map((heading) => (
                      <th key={heading} style={{ padding: "1rem 1.25rem", textAlign: heading ? "left" : "right", color: "#94A3B8", fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", borderBottom: "1px solid #EEF2F7" }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ exam, attempt, status }) => (
                    <tr key={exam.id}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #4F46E5 0%, #9333EA 100%)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <FileText size={19} />
                          </div>
                          <div>
                            <div style={{ color: "#0F172A", fontWeight: 900 }}>{exam.title}</div>
                            <div style={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.78rem", marginTop: 3 }}>Max {exam.maxPoints} points</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>{exam.classOffering?.displayName ?? exam.classOffering?.subjectName ?? "General"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <CalendarDays size={16} color="#94A3B8" />
                          {new Date(exam.opensAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <Timer size={16} color="#94A3B8" />
                          {exam.durationMinutes} min
                        </div>
                      </td>
                      <td style={td}>{attempt?.score != null ? `${attempt.score}/${exam.maxPoints}` : "-"}</td>
                      <td style={td}><StatusPill status={status} /></td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {status === "available" ? (
                          <Link href={`/student/exam/${exam.id}`} className="btn btn-primary btn-sm">
                            Start
                          </Link>
                        ) : attempt?.releasedAt ? (
                          <Link href={`/student/result/${attempt.id}`} className="btn btn-secondary btn-sm">
                            Result
                          </Link>
                        ) : (
                          <span style={{ color: "#CBD5E1", fontWeight: 900 }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const td: React.CSSProperties = {
  padding: "1.1rem 1.25rem",
  borderBottom: "1px solid #F1F5F9",
  color: "#475569",
  fontWeight: 700,
  verticalAlign: "middle",
};
