"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  announcementsForMe,
  getActiveAcademicYear,
  listAssignmentsForStudent,
  listGradesForStudent,
  listStudentExams,
  studentDashboard,
  type Announcement,
  type Assignment,
  type Exam,
  type GradeEntry,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";

type OverviewData = {
  activeEnrollments: number;
  unreadNotifications: number;
};

type ActivityRow = {
  id: string;
  title: string;
  detail: string;
  type: "Exam" | "Assignment" | "Grade" | "Announcement";
  status: "Active" | "Pending" | "Completed" | "New";
  date: Date;
  href?: string;
};

const shell: React.CSSProperties = {
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

function badge(status: ActivityRow["status"]) {
  const map = {
    Active: { bg: "#DCFCE7", fg: "#166534" },
    Pending: { bg: "#FEF3C7", fg: "#92400E" },
    Completed: { bg: "#E0E7FF", fg: "#3730A3" },
    New: { bg: "#DBEAFE", fg: "#1D4ED8" },
  }[status];
  return (
    <span style={{ borderRadius: 999, padding: "0.35rem 0.75rem", background: map.bg, color: map.fg, fontSize: "0.72rem", fontWeight: 900 }}>
      {status}
    </span>
  );
}

function activityIcon(type: ActivityRow["type"]) {
  const style: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
  if (type === "Exam") return <div style={{ ...style, background: "#E0E7FF", color: "#4F46E5" }}><FileText size={18} /></div>;
  if (type === "Assignment") return <div style={{ ...style, background: "#FEF3C7", color: "#D97706" }}><BookOpen size={18} /></div>;
  if (type === "Grade") return <div style={{ ...style, background: "#DCFCE7", color: "#059669" }}><Award size={18} /></div>;
  return <div style={{ ...style, background: "#DBEAFE", color: "#2563EB" }}><Bell size={18} /></div>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
}

export default function StudentDashboardOverview() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [yearLabel, setYearLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const user = getStoredUser();
  const userName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Student" : "Student";
  const gradeLabel = [user?.grade, user?.section].filter(Boolean).join(" - ") || "High School";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const activeYear = await getActiveAcademicYear().catch(() => null);
        const studentId = getStoredUser()?.id;
        const [dash, ann, examRows, assignmentRows, gradeRows] = await Promise.all([
          studentDashboard().catch(() => null),
          announcementsForMe().catch(() => [] as Announcement[]),
          activeYear ? listStudentExams(activeYear.id).catch(() => [] as Exam[]) : Promise.resolve([] as Exam[]),
          studentId ? listAssignmentsForStudent(studentId).catch(() => [] as Assignment[]) : Promise.resolve([] as Assignment[]),
          studentId ? listGradesForStudent(studentId).catch(() => [] as GradeEntry[]) : Promise.resolve([] as GradeEntry[]),
        ]);
        if (cancelled) return;
        setYearLabel(activeYear?.label ?? null);
        setOverview(dash);
        setAnnouncements(ann);
        setExams(examRows);
        setAssignments(assignmentRows);
        setGrades(gradeRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const examCounts = useMemo(() => {
    const now = Date.now();
    let available = 0;
    let completed = 0;
    for (const exam of exams) {
      const attempt = exam.attempts?.find((row) => row.studentId === user?.id) ?? exam.attempts?.[0];
      if (attempt?.submittedAt) completed += 1;
      else if (new Date(exam.opensAt).getTime() <= now && new Date(exam.closesAt).getTime() >= now) available += 1;
    }
    return { available, completed };
  }, [exams, user?.id]);

  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];
    const now = Date.now();
    for (const exam of exams) {
      const attempt = exam.attempts?.find((row) => row.studentId === user?.id) ?? exam.attempts?.[0];
      if (attempt?.submittedAt) {
        rows.push({
          id: `exam-${exam.id}`,
          type: "Exam",
          title: exam.title,
          detail: attempt.score != null ? `Score ${attempt.score}/${exam.maxPoints}` : "Submitted for review",
          status: "Completed",
          date: new Date(attempt.submittedAt),
          href: attempt.releasedAt ? `/student/result/${attempt.id}` : undefined,
        });
      } else if (new Date(exam.opensAt).getTime() <= now && new Date(exam.closesAt).getTime() >= now) {
        rows.push({
          id: `exam-open-${exam.id}`,
          type: "Exam",
          title: exam.title,
          detail: `${exam.durationMinutes} minute session is open`,
          status: "Active",
          date: new Date(exam.opensAt),
          href: `/student/exam/${exam.id}`,
        });
      }
    }
    for (const assignment of assignments) {
      rows.push({
        id: `assignment-${assignment.id}`,
        type: "Assignment",
        title: assignment.title,
        detail: assignment.submission?.submittedAt ? "Submission received" : `Due ${new Date(assignment.deadline).toLocaleDateString()}`,
        status: assignment.submission?.submittedAt ? "Completed" : "Pending",
        date: new Date(assignment.submission?.submittedAt ?? assignment.deadline),
        href: "/student/assignments",
      });
    }
    for (const grade of grades.filter((item) => item.releasedAt)) {
      rows.push({
        id: `grade-${grade.id}`,
        type: "Grade",
        title: grade.title,
        detail: grade.score != null ? `${grade.score}/${grade.maxScore} points released` : "Grade released",
        status: "Completed",
        date: new Date(grade.releasedAt!),
        href: "/student/grades",
      });
    }
    for (const announcement of announcements.slice(0, 4)) {
      rows.push({
        id: `announcement-${announcement.id}`,
        type: "Announcement",
        title: announcement.title,
        detail: announcement.body?.slice(0, 90) || "New school announcement",
        status: "New",
        date: new Date(announcement.createdAt),
        href: "/student/announcements",
      });
    }
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [announcements, assignments, exams, grades, user?.id]);

  const visibleActivity = activity.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${item.title} ${item.detail} ${item.type} ${item.status}`.toLowerCase().includes(q);
  });

  const stats = [
    { label: "Active Courses", value: overview?.activeEnrollments ?? 0, icon: GraduationCap, gradient: "linear-gradient(135deg, #E0E7FF 0%, #F5D0FE 100%)", color: "#4F46E5" },
    { label: "Open Exams", value: examCounts.available, icon: PlayCircle, gradient: "linear-gradient(135deg, #DCFCE7 0%, #BAE6FD 100%)", color: "#047857" },
    { label: "Pending Tasks", value: assignments.filter((item) => !item.submission?.submittedAt && !item.isOverdue).length, icon: Clock3, gradient: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)", color: "#B45309" },
    { label: "Unread Alerts", value: overview?.unreadNotifications ?? 0, icon: Bell, gradient: "linear-gradient(135deg, #FCE7F3 0%, #DDD6FE 100%)", color: "#BE123C" },
  ];

  if (loading) {
    return (
      <div style={shell}>
        <div className="admin-skeleton shimmer" style={{ width: "100%", height: 220, borderRadius: 28, marginBottom: 24 }} />
        <div className="admin-skeleton shimmer" style={{ width: "100%", height: 420, borderRadius: 28 }} />
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ display: "grid", gap: "1.5rem", maxWidth: 1440, margin: "0 auto" }}>
        <section style={{ ...card, overflow: "hidden", background: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 58%, #EEF2FF 100%)" }}>
          <div style={{ padding: "2rem", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "1.5rem", alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.42rem 0.75rem", borderRadius: 999, background: "#EEF2FF", color: "#4F46E5", fontWeight: 900, fontSize: "0.78rem", marginBottom: "1rem" }}>
                <Sparkles size={15} />
                Student Dashboard
              </div>
              <h1 className="premium-hero-title" style={{ margin: 0, color: "#0F172A", lineHeight: 1.04, fontWeight: 900, letterSpacing: 0 }}>
                Welcome back, {userName.split(" ")[0]}.
              </h1>
              <p style={{ margin: "0.85rem 0 0", color: "#64748B", fontSize: "1rem", maxWidth: 620, lineHeight: 1.7, fontWeight: 600 }}>
                {yearLabel ? `Academic year ${yearLabel}` : "Your academic overview"} with courses, tasks, exams, and recent activity in one place.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", justifySelf: "end" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #4F46E5 0%, #9333EA 100%)", color: "#fff", display: "grid", placeItems: "center", fontSize: "1.1rem", fontWeight: 900, boxShadow: "0 20px 40px rgba(79, 70, 229, 0.28)" }}>
                {initials(userName)}
              </div>
              <div>
                <div style={{ color: "#0F172A", fontWeight: 900 }}>{userName}</div>
                <div style={{ color: "#64748B", fontWeight: 700, fontSize: "0.85rem" }}>{gradeLabel}</div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ ...card, padding: "1.45rem" }}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: stat.gradient, color: stat.color, display: "grid", placeItems: "center", marginBottom: "1rem" }}>
                <stat.icon size={22} />
              </div>
              <div style={{ color: "#64748B", fontWeight: 800, fontSize: "0.82rem" }}>{stat.label}</div>
              <div style={{ color: "#0F172A", fontWeight: 900, fontSize: "2rem", marginTop: "0.25rem" }}>{stat.value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "1.5rem", alignItems: "start" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "1.5rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid #F1F5F9", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, color: "#0F172A", fontSize: "1.2rem", fontWeight: 900 }}>Recent Activity</h2>
                <p style={{ margin: "0.35rem 0 0", color: "#64748B", fontWeight: 600, fontSize: "0.88rem" }}>Latest exams, assignments, grades, and announcements.</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 260, padding: "0.65rem 0.85rem", borderRadius: 16, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <Search size={17} color="#94A3B8" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity" style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "#0F172A", fontWeight: 700 }} />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 820, borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Activity", "Type", "Status", "Date", ""].map((heading) => (
                      <th key={heading} style={{ padding: "1rem 1.25rem", textAlign: heading ? "left" : "right", color: "#94A3B8", fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", borderBottom: "1px solid #EEF2F7" }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleActivity.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "2.5rem", color: "#64748B", fontWeight: 700, textAlign: "center" }}>No recent activity found.</td>
                    </tr>
                  ) : (
                    visibleActivity.map((item) => (
                      <tr key={item.id}>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                            {activityIcon(item.type)}
                            <div>
                              <div style={{ color: "#0F172A", fontWeight: 900 }}>{item.title}</div>
                              <div style={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.8rem", marginTop: 3 }}>{item.detail}</div>
                            </div>
                          </div>
                        </td>
                        <td style={td}>{item.type}</td>
                        <td style={td}>{badge(item.status)}</td>
                        <td style={td}>{item.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {item.href ? (
                            <Link href={item.href} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 14, color: "#4F46E5", background: "#EEF2FF" }} aria-label={`Open ${item.title}`}>
                              <ChevronRight size={18} />
                            </Link>
                          ) : (
                            <span style={{ color: "#CBD5E1" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside style={{ display: "grid", gap: "1rem" }}>
            <div style={{ ...card, padding: "1.4rem", background: "linear-gradient(135deg, #ECFDF5 0%, #EFF6FF 100%)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 18, display: "grid", placeItems: "center", background: "#FFFFFF", color: "#059669", marginBottom: "1rem", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)" }}>
                <TrendingUp size={22} />
              </div>
              <h3 style={{ margin: 0, color: "#0F172A", fontSize: "1rem", fontWeight: 900 }}>Progress Snapshot</h3>
              <p style={{ color: "#64748B", fontWeight: 600, fontSize: "0.86rem", lineHeight: 1.6, marginTop: "0.5rem" }}>
                {examCounts.completed} exams completed and {grades.filter((grade) => grade.releasedAt).length} released grades recorded.
              </p>
            </div>

            <div style={{ ...card, padding: "1.4rem" }}>
              <h3 style={{ margin: 0, color: "#0F172A", fontSize: "1rem", fontWeight: 900 }}>Quick Actions</h3>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "1rem" }}>
                {[
                  { href: "/student/assignments", label: "View assignments", icon: BookOpen },
                  { href: "/student/grades", label: "Check grades", icon: CheckCircle2 },
                  { href: "/student/calendar", label: "Open calendar", icon: CalendarDays },
                ].map((action) => (
                  <Link key={action.href} href={action.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", padding: "0.85rem 0.95rem", borderRadius: 16, background: "#F8FAFC", color: "#334155", fontWeight: 800, transition: "all 160ms ease" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.65rem" }}>
                      <action.icon size={18} color="#4F46E5" />
                      {action.label}
                    </span>
                    <ChevronRight size={17} color="#94A3B8" />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
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
