"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen, Calendar, CheckCircle2, GraduationCap,
  Layout, Megaphone, Send, RefreshCcw, Star, Sparkles,
  TrendingUp, Clock, ChevronRight, Plus
} from "lucide-react";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, CardSkeleton, EmptyState } from "@/components/ui";
import {
  getActiveAcademicYear,
  listMyClassOfferings as listOfferings,
  teacherDashboard,
  announcementsForMe,
  createAnnouncement,
  type ClassOffering,
  type Announcement
} from "@/lib/admin-api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useRouter } from "next/navigation";
import RealtimeToast from "@/components/RealtimeToast";
import { type ToastState } from "@/hooks/useRealtimeNotifications";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";

/* ─── Skeleton ─── */
function DashboardSkeleton() {
  return (
    <div style={{ padding: "2rem", maxWidth: 1280, margin: "0 auto" }}>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function offeringLabel(o: ClassOffering) {
  const g = o.gradeName || (o as any).grade?.name || "";
  const subj = o.subjectName || (o as any).subject?.name || "";
  const sec = o.sectionName || (o as any).section?.name || "";
  if (subj && sec) return g ? `${g} · ${subj} — ${sec}` : `${subj} — ${sec}`;
  return o.displayName || o.name?.trim() || "Untitled Class";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Stat Card ─── */
function StatCard({ label, value, note, icon: Icon, color }: {
  label: string; value: string; note: string;
  icon: React.ComponentType<{ size?: number }>;
  color: { bg: string; text: string; icon: string };
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "1.5rem",
      border: "1.5px solid var(--gray-100)",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color.bg, color: color.icon,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>{label}</div>
        <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", marginTop: "0.25rem" }}>{note}</div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function TeacherDashboard() {
  const user = useCurrentUser("teacher");
  const router = useRouter();
  const { selectedTermId } = useTermStore();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const [dash, setDash] = useState<Awaited<ReturnType<typeof teacherDashboard>> | null>(null);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast form
  const [broadTitle, setBroadTitle] = useState("");
  const [broadBody, setBroadBody] = useState("");
  const [broadAudience, setBroadAudience] = useState("students");
  const [broadClassId, setBroadClassId] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState<(ToastState & { ok?: boolean }) | null>(null);
  const [activeYear, setActiveYear] = useState<any>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok, type: ok ? "announcement" : undefined });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, year, ann] = await Promise.all([
        teacherDashboard(selectedTermId ?? undefined),
        getActiveAcademicYear(),
        announcementsForMe(selectedTermId ?? undefined),
      ]);
      setDash(d);
      setAnnouncements(ann);
      setActiveYear(year);
      if (year?.id) {
        let mine = await listOfferings(year.id);
        const { filterOfferingsBySubject } = await import("@/lib/teacher-utils");
        mine = filterOfferingsBySubject(mine, user?.subject);
        setOfferings(mine);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.subject, selectedTermId]);

  useEffect(() => { load(); }, [load]);

  const handleBroadcast = async () => {
    if (!activeYear) { showToast("No active academic year", false); return; }
    if (!broadTitle.trim() || !broadBody.trim()) { showToast("Fill in all fields", false); return; }
    setIsPublishing(true);
    try {
      await createAnnouncement({
        academicYearId: activeYear.id,
        title: broadTitle.trim(),
        body: broadBody.trim(),
        audience: broadAudience,
        ...(broadClassId ? { classOfferingId: broadClassId } : {}),
      });
      setBroadTitle(""); setBroadBody(""); setBroadClassId("");
      showToast("Broadcast sent!");
      load();
    } catch { showToast("Failed to send", false); }
    finally { setIsPublishing(false); }
  };

  if (!isClient || loading || !dash) return <DashboardSkeleton />;

  const stats = [
    { label: "My Classes",      value: String(dash.myClasses),       note: "Assigned this year",  icon: Layout,       color: { bg: "var(--primary-50)",  text: "var(--primary-700)", icon: "var(--primary-600)" } },
    { label: "Total Students",  value: String(dash.totalStudents),   note: "Enrolled",             icon: GraduationCap, color: { bg: "#f0fdf4",            text: "#166534",            icon: "#16a34a" } },
    { label: "Attendance Rate", value: dash.attendanceRate != null ? `${Math.round(dash.attendanceRate * 100)}%` : "—", note: "Recent sessions", icon: CheckCircle2, color: { bg: "#f0fdfa", text: "#134e4a", icon: "#0d9488" } },
    { label: "Pending Review",  value: String(dash.pendingGradingApprox), note: "Needs grading",  icon: Star,         color: { bg: "#fff7ed",            text: "#9a3412",            icon: "#ea580c" } },
  ];

  const today = isClient ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }} suppressHydrationWarning>

      <PageHeader
        kicker="Teacher Portal"
        title={`${getGreeting()}, ${user.firstName || "Teacher"}`}
        subtitle={`${user.subject ? `${user.subject} Teacher` : "Welcome back"} · ${today}`}
        icon={<GraduationCap size={22} />}
        actions={(
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <TermSelector academicYearId={activeYear?.id ?? null} />
            <button onClick={() => router.push("/teacher/attendance")} className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 1rem", borderRadius: 12 }}>
              <CheckCircle2 size={14} /> Attendance
            </button>
            <button onClick={() => router.push("/teacher/exams")} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 1rem", borderRadius: 12 }}>
              <Plus size={14} /> Create Exam
            </button>
          </div>
        )}
      />

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Assigned Classes */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                  <BookOpen size={16} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Assigned Classes</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 600 }}>{offerings.length} class{offerings.length !== 1 ? "es" : ""}</span>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {offerings.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<BookOpen size={26} />}
                  title="No classes assigned yet"
                  description="Ask an admin to assign you to class offerings."
                />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
                  {offerings.map(c => (
                    <div key={c.id} style={{
                      padding: "1rem 1.25rem", borderRadius: 12,
                      background: "var(--gray-50)", border: "1.5px solid var(--gray-100)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-200)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--gray-100)")}
                    >
                      <div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--gray-900)" }}>{offeringLabel(c)}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginTop: "0.2rem" }}>Active session</div>
                      </div>
                      <ChevronRight size={16} color="var(--gray-300)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Snapshot */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                <TrendingUp size={16} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Activity Snapshot</span>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {[
                { label: "Released Exams",   value: dash.publishedExams,        color: "var(--primary-600)" },
                { label: "Broadcasts Sent",  value: dash.recentAnnouncements,   color: "#16a34a" },
                { label: "Unread Alerts",    value: dash.unreadNotifications,   color: dash.unreadNotifications > 0 ? "#ea580c" : "var(--primary-600)" },
              ].map(item => (
                <div key={item.label} style={{ textAlign: "center", padding: "1.25rem", background: "var(--gray-50)", borderRadius: 12 }}>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.4rem" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* School Feed */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                  <Megaphone size={16} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>School Feed</span>
              </div>
              <button
                onClick={() => router.push("/teacher/announcements")}
                style={{ background: "none", border: "none", color: "var(--primary-600)", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
              >
                View all
              </button>
            </div>
            <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {announcements.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<Megaphone size={22} />}
                  title="No announcements yet"
                  description="Posts you publish or receive will show up here."
                />
              ) : announcements.slice(0, 4).map(a => (
                <div key={a.id} style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                  <div style={{ width: 3, borderRadius: 2, background: "var(--primary-200)", alignSelf: "stretch", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gray-400)" }}>
                        {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--gray-900)", marginBottom: "0.2rem" }}>{a.title}</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Broadcast Hub */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                <Send size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Broadcast Hub</div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>Send a message to your students</div>
              </div>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                placeholder="Headline…"
                value={broadTitle}
                onChange={e => setBroadTitle(e.target.value)}
                style={{ padding: "0.65rem 0.875rem", borderRadius: 10, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.875rem", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <select
                  value={broadAudience}
                  onChange={e => setBroadAudience(e.target.value)}
                  style={{ padding: "0.65rem 0.75rem", borderRadius: 10, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.8rem", fontWeight: 600, outline: "none", cursor: "pointer" }}
                >
                  <option value="students">Students</option>
                  <option value="parents">Parents</option>
                  <option value="all">Everyone</option>
                </select>
                <select
                  value={broadClassId}
                  onChange={e => setBroadClassId(e.target.value)}
                  style={{ padding: "0.65rem 0.75rem", borderRadius: 10, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.8rem", fontWeight: 600, outline: "none", cursor: "pointer" }}
                >
                  <option value="">All classes</option>
                  {offerings.map(o => <option key={o.id} value={o.id}>{offeringLabel(o)}</option>)}
                </select>
              </div>
              <textarea
                placeholder="Type your message…"
                value={broadBody}
                onChange={e => setBroadBody(e.target.value)}
                rows={3}
                style={{ padding: "0.65rem 0.875rem", borderRadius: 10, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.875rem", outline: "none", resize: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <button
                className="btn btn-primary"
                onClick={handleBroadcast}
                disabled={isPublishing}
                style={{ width: "100%", justifyContent: "center", padding: "0.75rem", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                {isPublishing ? <RefreshCcw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                {isPublishing ? "Sending…" : "Publish Broadcast"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {toast && <RealtimeToast toast={toast} onClose={() => setToast(null)} />}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .stats-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
