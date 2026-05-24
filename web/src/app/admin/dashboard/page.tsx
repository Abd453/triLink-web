"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Megaphone,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { adminAnalytics, adminDashboard } from "@/lib/admin-api";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, CardSkeleton, EmptyState } from "@/components/ui";
import { AlertCircle } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={6} />
      <div className="content-grid admin-dash-bottom-grid" style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [dash, setDash] = useState<Awaited<ReturnType<typeof adminDashboard>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof adminAnalytics>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, a] = await Promise.all([adminDashboard(), adminAnalytics()]);
        if (!cancelled) {
          setDash(d);
          setAnalytics(a);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <div className="page-wrapper">
        <PageHeader kicker="Command Center" title="School overview" subtitle="Couldn't load the dashboard." icon={<ShieldCheck size={22} />} variant="light" />
        <EmptyState icon={<AlertCircle size={26} />} title="Couldn't load dashboard" description={err} />
      </div>
    );
  }

  if (!dash || !analytics) {
    return <DashboardSkeleton />;
  }

  const attendanceRatePct =
    analytics.attendance.presentRateLast30DaysApprox != null
      ? Math.round(analytics.attendance.presentRateLast30DaysApprox * 100)
      : null;

  const stats = [
    {
      label: "Students",
      value: String(dash.users.student),
      icon: GraduationCap,
      tone: "blue",
      note: "Active learners",
    },
    {
      label: "Teachers",
      value: String(dash.users.teacher),
      icon: BookOpen,
      tone: "green",
      note: "Faculty members",
    },
    {
      label: "Parents",
      value: String(dash.users.parent),
      icon: Users,
      tone: "purple",
      note: "Linked guardians",
    },
    {
      label: "Class offerings",
      value: String(dash.classes),
      icon: School,
      tone: "orange",
      note: "Running classes",
    },
    {
      label: "Enrollments",
      value: String(dash.enrollments),
      icon: ClipboardList,
      tone: "blue",
      note: "Current registrations",
    },
    {
      label: "Attendance (30d)",
      value: attendanceRatePct != null ? `${attendanceRatePct}%` : "—",
      icon: CheckCircle2,
      tone: "teal",
      note: `${analytics.attendance.marksRecordedLast30Days} marks logged`,
    },
  ];

  const feedbackTotal = analytics.feedbackTicketsByStatus.reduce((total, item) => total + item.count, 0);

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="Command Center"
        title="School overview"
        subtitle={`Snapshot updated ${new Date(analytics.generatedAt).toLocaleString()}`}
        icon={<ShieldCheck size={22} />}
        actions={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.4rem 0.85rem", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
            <Sparkles size={13} /> Admin view
          </span>
        )}
      />

      <div className="stats-grid admin-dash-stats-grid">
        {stats.map((s) => (
          <div className="stat-card admin-dash-stat-card" key={s.label}>
            <div className={`stat-icon admin-dash-stat-icon ${s.tone}`}>
              <s.icon size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-label admin-dash-stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="admin-dash-stat-note">{s.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="content-grid admin-dash-bottom-grid" style={{ marginTop: "1.5rem" }}>
        <div className="card admin-dash-bottom-card">
          <div className="admin-dash-bottom-head">
            <h3 className="card-title admin-dash-bottom-title">Exams, release, and reach</h3>
            <div className="admin-dash-chip">
              <Activity size={14} />
              Academic pulse
            </div>
          </div>
          <div className="admin-dash-metric-list">
            <div className="admin-dash-metric-item">
              <span>Published exams</span>
              <strong>{analytics.exams.publishedCount}</strong>
            </div>
            <div className="admin-dash-metric-item">
              <span>Attempts submitted</span>
              <strong>{analytics.examAttempts.submitted}</strong>
            </div>
            <div className="admin-dash-metric-item">
              <span>Results released</span>
              <strong>{analytics.examAttempts.released}</strong>
            </div>
            <div className="admin-dash-metric-item">
              <span>Announcements sent</span>
              <strong>{analytics.announcementsTotal}</strong>
            </div>
          </div>
        </div>
        <div className="card admin-dash-bottom-card">
          <div className="admin-dash-bottom-head">
            <h3 className="card-title admin-dash-bottom-title">Feedback tickets by status</h3>
            <div className="admin-dash-chip">
              <Megaphone size={14} />
              Total {feedbackTotal}
            </div>
          </div>
          {analytics.feedbackTicketsByStatus.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "220px" }}>
              <div style={{ width: "64px", height: "64px", background: "#edf2fa", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                <MessageSquare size={28} style={{ color: "#a0aabf" }} strokeWidth={2.5} />
              </div>
              <h4 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--gray-600)", marginBottom: "0.5rem" }}>No feedback yet.</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--gray-400)", lineHeight: 1.5, maxWidth: "260px", fontWeight: 500, marginBottom: "1.25rem" }}>Feedback from teachers and parents will appear here once they start reaching out.</p>
              <Link href="/admin/feedback" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-600)", textDecoration: "none" }}>
                View feedback <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <ul className="admin-dash-feedback-list">
              {analytics.feedbackTicketsByStatus.map((f) => (
                <li key={f.status} className="admin-dash-feedback-item">
                  <div className="admin-dash-feedback-row">
                    <strong>{f.status.replace(/_/g, " ")}</strong>
                    <span>{f.count}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${feedbackTotal > 0 ? (f.count / feedbackTotal) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
