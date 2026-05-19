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
import Select from "@/components/Select";

/* ─── Skeleton ─── */
function DashboardSkeleton() {
  return (
    <div className="teacher-page-wrapper">
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
      background: "#fff", borderRadius: 20, padding: "1.5rem",
      border: "1.5px solid var(--gray-100)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
      display: "flex", flexDirection: "column", gap: "1rem",
      transition: "all 0.2s ease-in-out",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color.bg, color: color.icon,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 10px ${color.bg === "#fff" ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)"}`
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>{label}</div>
        <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: "0.35rem", fontWeight: 500 }}>{note}</div>
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
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);

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
    <div className="teacher-page-wrapper" suppressHydrationWarning>

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
            <button onClick={() => setShowCreateExamModal(true)} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 1rem", borderRadius: 12 }}>
              <Plus size={14} /> Create Exam
            </button>
          </div>
        )}
      />

      {/* ── Stats ── */}
      <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "1.5rem" }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Main grid ── */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Assigned Classes */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                  <BookOpen size={16} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Assigned Classes</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 600 }}>{offerings.length} class{offerings.length !== 1 ? "es" : ""}</span>
            </div>
            <div style={{ padding: "1.5rem" }}>
              {offerings.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<BookOpen size={26} />}
                  title="No classes assigned yet"
                  description="Ask an admin to assign you to class offerings."
                />
              ) : (
                <div style={{
                  maxHeight: "340px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  paddingRight: "0.5rem"
                }}
                  className="custom-scrollbar"
                >
                  {offerings.map(c => {
                    const g = c.gradeName || (c as any).grade?.name || "";
                    const subj = c.subjectName || (c as any).subject?.name || "";
                    const sec = c.sectionName || (c as any).section?.name || "";
                    return (
                      <div key={c.id} style={{
                        padding: "1rem 1.25rem", borderRadius: 14,
                        background: "#ffffff", border: "1.5px solid var(--gray-100)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        cursor: "pointer", transition: "all 0.2s ease-in-out",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.01)"
                      }}
                        className="inner-class-card"
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "var(--primary-300)";
                          e.currentTarget.style.boxShadow = "0 6px 18px rgba(37,99,235,0.06)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "var(--gray-100)";
                          e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.01)";
                          e.currentTarget.style.transform = "none";
                        }}
                      >
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                          {/* Subject initial bubble */}
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: "linear-gradient(135deg, var(--primary-50), #dbeafe)",
                            color: "var(--primary-600)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: "0.85rem"
                          }}>
                            {subj ? subj[0].toUpperCase() : "C"}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--gray-900)" }}>{subj || "Untitled Class"}</span>
                              {sec && (
                                <span style={{
                                  fontSize: "0.65rem", fontWeight: 700,
                                  padding: "0.15rem 0.45rem", borderRadius: 6,
                                  background: "var(--primary-50)", color: "var(--primary-700)"
                                }}>
                                  Section {sec}
                                </span>
                              )}
                            </div>
                            {g && (
                              <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", fontWeight: 600, marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <GraduationCap size={11} style={{ color: "var(--primary-400)" }} /> {g}
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--gray-400)" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Snapshot */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                <TrendingUp size={16} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Activity Snapshot</span>
            </div>
            <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {[
                { label: "Released Exams",   value: dash.publishedExams,        color: "var(--primary-600)" },
                { label: "Broadcasts Sent",  value: dash.recentAnnouncements,   color: "#16a34a" },
                { label: "Unread Alerts",    value: dash.unreadNotifications,   color: dash.unreadNotifications > 0 ? "#ea580c" : "var(--primary-600)" },
              ].map(item => (
                <div key={item.label} style={{ textAlign: "center", padding: "1.25rem", background: "var(--gray-50)", borderRadius: 12, border: "1px solid var(--gray-100)" }}>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.5rem" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* School Feed */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                  <Megaphone size={16} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>School Feed</span>
              </div>
              <button
                onClick={() => router.push("/teacher/announcements?from=dashboard")}
                style={{ background: "none", border: "none", color: "var(--primary-600)", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
              >
                View all
              </button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {announcements.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<Megaphone size={22} />}
                  title="No announcements yet"
                  description="Posts you publish or receive will show up here."
                />
              ) : announcements.slice(0, 4).map(a => (
                <div key={a.id} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                  padding: "1rem",
                  background: "linear-gradient(135deg, rgba(37,99,235,0.03), rgba(37,99,235,0.01))",
                  border: "1px solid var(--primary-100)",
                  borderRadius: 14,
                  transition: "all 0.2s ease-in-out",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "var(--primary-300)";
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--primary-100)";
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.03), rgba(37,99,235,0.01))";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{
                      background: "var(--primary-100)",
                      color: "var(--primary-700)",
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}>
                      {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    {a.audience && (
                      <span style={{
                        background: a.audience === "teachers" ? "var(--indigo-100)" : a.audience === "parents" ? "var(--emerald-100)" : "var(--amber-100)",
                        color: a.audience === "teachers" ? "var(--indigo-700)" : a.audience === "parents" ? "var(--emerald-700)" : "var(--amber-700)",
                        padding: "2px 8px",
                        borderRadius: 9999,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}>
                        {a.audience}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--primary-950)", marginTop: "0.15rem" }}>
                    {a.title}
                  </div>
                  <p style={{
                    fontSize: "0.78rem",
                    color: "var(--gray-700)",
                    lineHeight: 1.45,
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>{a.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Broadcast Hub */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--gray-100)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                <Send size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)" }}>Broadcast Hub</div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>Send a message to your students</div>
              </div>
            </div>
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Broadcast Headline</label>
                <input
                  placeholder="e.g. Midterm Exam Prep Checklist"
                  value={broadTitle}
                  onChange={e => setBroadTitle(e.target.value)}
                  className="broadcast-input"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Audience</label>
                  <Select
                    value={broadAudience}
                    onChange={e => setBroadAudience(e.target.value)}
                    style={{
                      padding: "0.45rem 1.15rem",
                      borderRadius: "9999px",
                      border: "1.5px solid var(--primary-100)",
                      background: "var(--primary-50)",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "var(--primary-700)",
                      width: "100%"
                    }}
                    dropdownMinWidth="100%"
                  >
                    <option value="students">Students</option>
                    <option value="parents">Parents</option>
                    <option value="all">Everyone</option>
                  </Select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class Scope</label>
                  <Select
                    value={broadClassId}
                    onChange={e => setBroadClassId(e.target.value)}
                    style={{
                      padding: "0.45rem 1.15rem",
                      borderRadius: "9999px",
                      border: "1.5px solid var(--primary-100)",
                      background: "var(--primary-50)",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "var(--primary-700)",
                      width: "100%"
                    }}
                    dropdownMinWidth="100%"
                  >
                    <option value="">All classes</option>
                    {offerings.map(o => <option key={o.id} value={o.id}>{offeringLabel(o)}</option>)}
                  </Select>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Message Body</label>
                <textarea
                  placeholder="Type your message details here…"
                  value={broadBody}
                  onChange={e => setBroadBody(e.target.value)}
                  rows={4}
                  className="broadcast-input"
                  style={{ resize: "none", fontFamily: "inherit" }}
                />
              </div>

              <button
                className="btn btn-primary broadcast-btn"
                onClick={handleBroadcast}
                disabled={isPublishing}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                {isPublishing ? <RefreshCcw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                {isPublishing ? "Sending…" : "Publish Broadcast"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showCreateExamModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 24,
            width: "100%",
            maxWidth: 420,
            padding: "2rem",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center"
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--primary-50)",
              color: "var(--primary-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.25rem"
            }}>
              <BookOpen size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.5rem" }}>
              Exams & Assessments
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--gray-500)", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              You will be redirected to the Exam Manager page where you can create quizzes, manage questions, and schedule assessments.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
              <button
                onClick={() => setShowCreateExamModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: "0.65rem", borderRadius: 12, fontWeight: 700, fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreateExamModal(false);
                  router.push("/teacher/exams?from=dashboard");
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: "0.65rem", borderRadius: 12, fontWeight: 700, fontSize: "0.85rem", justifyContent: "center" }}
              >
                Go to Exams
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <RealtimeToast toast={toast} onClose={() => setToast(null)} />}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .broadcast-input {
          padding: 0.75rem 1rem !important;
          border-radius: 12px !important;
          border: 1.5px solid var(--gray-200) !important;
          background: var(--gray-50) !important;
          font-size: 0.875rem !important;
          outline: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
          transition: all 0.2s ease-in-out !important;
        }
        .broadcast-input:focus {
          border-color: var(--primary-500) !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px var(--primary-50) !important;
        }
        .broadcast-select {
          padding: 0.75rem 1.25rem !important;
          border-radius: 9999px !important;
          border: 1.5px solid var(--primary-100) !important;
          background: var(--primary-50) !important;
          font-size: 0.82rem !important;
          font-weight: 700 !important;
          color: var(--primary-700) !important;
          outline: none !important;
          cursor: pointer !important;
          transition: all 0.2s ease-in-out !important;
          width: 100% !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e") !important;
          background-repeat: no-repeat !important;
          background-position: right 1rem center !important;
          background-size: 14px !important;
          padding-right: 2.25rem !important;
        }
        .broadcast-select:focus {
          border-color: var(--primary-400) !important;
          background: var(--primary-100) !important;
          box-shadow: 0 0 0 3px var(--primary-200) !important;
        }
        .broadcast-btn {
          border-radius: 12px !important;
          padding: 0.85rem !important;
          font-weight: 700 !important;
          font-size: 0.9rem !important;
          transition: all 0.2s ease-in-out !important;
        }
        .broadcast-btn:hover:not(:disabled) {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(37,99,235,0.2) !important;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--gray-200);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--gray-300);
        }

        @media (max-width: 1024px) {
          .dashboard-grid { 
            grid-template-columns: 1fr !important; 
            gap: 1.5rem !important;
          }
          .stats-row { 
            grid-template-columns: repeat(2, 1fr) !important; 
            gap: 1rem !important;
          }
        }
        
        @media (max-width: 640px) {
          .stats-row { 
            grid-template-columns: 1fr !important; 
          }
        }
      `}</style>
    </div>
  );
}
