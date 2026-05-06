"use client";

import { useCallback, useEffect, useState } from "react";
import { 
  Activity, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  GraduationCap, 
  Layout, 
  Megaphone, 
  Sparkles, 
  Star, 
  Plus,
  Send,
  RefreshCcw,
  ChevronRight
} from "lucide-react";
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

function DashboardSkeleton() {
  return (
    <div className="page-wrapper" style={{ padding: "2rem" }}>
      <div className="admin-dash-hero admin-dash-skeleton-block">
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div className="admin-skeleton shimmer" style={{ height: 12, width: 140, marginBottom: 12 }} />
          <div className="admin-skeleton shimmer" style={{ height: 32, width: "90%", marginBottom: 10 }} />
          <div className="admin-skeleton shimmer" style={{ height: 14, width: "70%" }} />
        </div>
      </div>
      <div className="stats-grid admin-dash-stats-grid" style={{ marginTop: "2rem" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="stat-card admin-dash-stat-card admin-dash-skeleton-block" key={i}>
            <div className="admin-skeleton shimmer" style={{ width: 48, height: 48, borderRadius: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function offeringLabel(o: ClassOffering) {
  let gradeStr = "";
  if (o.gradeName) gradeStr = "Grade " + o.gradeName;
  else if ((o as any).grade?.name) gradeStr = "Grade " + (o as any).grade.name;
  else if ((o as any).class?.name) gradeStr = (o as any).class.name;

  const subj = o.subjectName || (o as any).subject?.name || "";
  const sec = o.sectionName || (o as any).section?.name || "";
  if (subj && sec) return gradeStr ? `${gradeStr} | ${subj} - ${sec}` : `${subj} - ${sec}`;
  return o.displayName || o.name?.trim() || "Untitled Class";
}

export default function TeacherDashboard() {
  const user = useCurrentUser("teacher");
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const [dash, setDash] = useState<Awaited<ReturnType<typeof teacherDashboard>> | null>(null);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Broadcast Form
  const [broadTitle, setBroadTitle] = useState("");
  const [broadBody, setBroadBody] = useState("");
  const [broadAudience, setBroadAudience] = useState("students");
  const [broadClassId, setBroadClassId] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState<(ToastState & { ok?: boolean }) | null>(null);
  const [activeYear, setActiveYear] = useState<any>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    setLoading(true);
    try {
      const [d, year, ann] = await Promise.all([
        teacherDashboard(), 
        getActiveAcademicYear(),
        announcementsForMe()
      ]);
      setDash(d);
      setAnnouncements(ann);
      setActiveYear(year);
      
      if (year?.id) {
        let mine = await listOfferings(year.id);
        const { filterOfferingsBySubject } = await import("@/lib/teacher-utils");
        mine = filterOfferingsBySubject(mine, user?.subject);
        setOfferings(mine);
      } else {
        setOfferings([]);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.subject]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBroadcast = async () => {
    if (!activeYear) {
      showToast("No active academic year found", false);
      return;
    }
    if (!broadTitle.trim() || !broadBody.trim()) {
      showToast("Please fill in all fields", false);
      return;
    }
    setIsPublishing(true);
    try {
      await createAnnouncement({
        academicYearId: activeYear.id,
        title: broadTitle.trim(),
        body: broadBody.trim(),
        audience: broadAudience,
        ...(broadClassId ? { classOfferingId: broadClassId } : {})
      });
      setBroadClassId("");
      setBroadTitle("");
      setBroadBody("");
      showToast("Broadcast sent successfully!", true);
      load();
    } catch (e) {
      showToast("Failed to send broadcast", false);
    } finally {
      setIsPublishing(false);
    }
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok, type: ok ? 'announcement' : undefined });
    setTimeout(() => setToast(null), 3500);
  };

  if (!isClient || loading || !dash) return <DashboardSkeleton />;

  const stats = [
    { label: "My Classes", value: String(dash.myClasses), icon: Layout, tone: "blue", note: "Assigned" },
    { label: "Total Students", value: String(dash.totalStudents), icon: GraduationCap, tone: "green", note: "Enrolled" },
    { label: "Attendance Rate", value: dash.attendanceRate != null ? `${Math.round(dash.attendanceRate * 100)}%` : "—", icon: CheckCircle2, tone: "teal", note: "Recent" },
    { label: "Pending Review", value: String(dash.pendingGradingApprox), icon: Star, tone: "orange", note: "Grading" },
  ];

  return (
    <div 
      className="page-wrapper" 
      style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}
      suppressHydrationWarning
    >
      <div className="admin-dash-hero" style={{ marginBottom: "2.5rem" }}>
        <div>
          <p className="admin-dash-kicker" style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary-600)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <Sparkles size={14} />
            Institutional Context
          </p>
          <h1 className="admin-dash-title" style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.5rem" }}>
            Today&apos;s teaching workspace
          </h1>
          <p className="admin-dash-subtitle" style={{ fontSize: "1.05rem", color: "var(--gray-500)" }}>
            {user.firstName ? `${user.firstName}, ` : ""}your classes, grading, attendance, and broadcasts are organized for the current academic day.
          </p>
        </div>
        <div className="admin-dash-pill" style={{ height: "fit-content", background: "#fff", border: "1.5px solid var(--gray-100)", padding: "0.5rem 1rem", borderRadius: 12, display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--gray-600)" }}>
          <Calendar size={16} className="text-primary-500" />
          {isClient ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'numeric', day: 'numeric', year: 'numeric' }) : "Loading..."}
        </div>
      </div>

      <div className="stats-grid admin-dash-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
        {stats.map((s) => (
          <div className="stat-card" style={{ background: "#fff", padding: "1.5rem", borderRadius: 24, border: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "1.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} key={s.label}>
            <div style={{ 
              width: 54, height: 54, borderRadius: 16, 
              background: s.tone === 'blue' ? 'var(--primary-100)' : s.tone === 'green' ? 'var(--success-light)' : s.tone === 'teal' ? '#f0fdfa' : '#fff7ed',
              color: s.tone === 'blue' ? 'var(--primary-600)' : s.tone === 'green' ? 'var(--success)' : s.tone === 'teal' ? '#0d9488' : '#ea580c',
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <s.icon size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{s.label}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)" }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "2.5rem", alignItems: "start" }}>
        
        {/* Main Column: Classes & Metrics */}
        <div style={{ display: "grid", gap: "2.5rem" }}>
          
          <div className="card" style={{ padding: "2rem", borderRadius: 24, border: "1.5px solid var(--gray-100)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <BookOpen size={20} className="text-primary-500" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Assigned Classes</h3>
              </div>
              <button 
                onClick={() => router.push("/teacher/exams")}
                className="btn btn-secondary" 
                style={{ fontSize: "0.8rem", fontWeight: 700, padding: "0.4rem 0.8rem", borderRadius: 8 }}
              >
                Create Exam
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {offerings.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray-400)", background: "var(--gray-50)", borderRadius: 16 }}>
                  <p>No class offerings match your profile.</p>
                </div>
              ) : (
                offerings.map((c) => (
                  <div key={c.id} style={{ 
                    padding: "1.25rem", borderRadius: 16, background: "var(--gray-50)", border: "1px solid var(--gray-100)",
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                  }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{offeringLabel(c)}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 500 }}>Semester Session</div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ padding: "2rem", borderRadius: 24, border: "1.5px solid var(--gray-100)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "1.5rem" }}>Teacher Snapshot</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
              <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: 16, textAlign: "center" }}>
                 <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", marginBottom: "0.5rem" }}>Released Exams</div>
                 <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary-600)" }}>{dash.publishedExams}</div>
              </div>
              <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: 16, textAlign: "center" }}>
                 <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", marginBottom: "0.5rem" }}>Broadcasts Sent</div>
                 <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary-600)" }}>{dash.recentAnnouncements}</div>
              </div>
              <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: 16, textAlign: "center" }}>
                 <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", marginBottom: "0.5rem" }}>New Alerts</div>
                 <div style={{ fontSize: "1.5rem", fontWeight: 800, color: dash.unreadNotifications > 0 ? "var(--warning)" : "var(--primary-600)" }}>{dash.unreadNotifications}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: School Feed */}
        <div style={{ position: "sticky", top: "2rem" }}>
          <div className="card" style={{ padding: "0", borderRadius: 24, border: "1.5px solid var(--gray-100)", overflow: "hidden" }}>
             <div style={{ padding: "1.5rem 2rem", background: "var(--gray-50)", borderBottom: "1.5px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                 <Megaphone size={18} className="text-primary-500" />
                 <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>School Feed</h3>
               </div>
               <button 
                 onClick={() => router.push("/teacher/announcements")}
                 style={{ background: "none", border: "none", color: "var(--primary-600)", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
               >
                 View All
               </button>
             </div>

             <div style={{ padding: "1.5rem", display: "grid", gap: "1.25rem" }}>
               {announcements.length === 0 ? (
                 <p style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem 0", fontSize: "0.85rem" }}>No current announcements available.</p>
               ) : (
                announcements.slice(0, 5).map(a => (
                  <div key={a.id} style={{ display: "flex", gap: "1rem" }}>
                     <div style={{ width: 4, borderRadius: 2, background: "var(--primary-200)" }} />
                     <div>
                       <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gray-400)", marginBottom: "0.2rem" }}>
                         {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                       </div>
                       <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.25rem" }}>{a.title}</h4>
                       <p style={{ fontSize: "0.8rem", color: "var(--gray-600)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.body}</p>
                     </div>
                  </div>
                ))
               )}
             </div>
          </div>

          <div className="card" style={{ marginTop: "1.5rem", padding: "1.75rem", borderRadius: 24, border: "1.5px solid var(--gray-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ width: 40, height: 40, background: "var(--primary-100)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                    <Send size={20} />
                </div>
                <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Broadcast Hub</h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 600 }}>Update your students</p>
                </div>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.75rem" }}>
                    <input 
                        placeholder="Headline..." 
                        value={broadTitle} 
                        onChange={e => setBroadTitle(e.target.value)}
                        style={{ padding: "0.7rem 1rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.85rem", width: "100%", outline: "none" }}
                    />
                    <select 
                        value={broadClassId}
                        onChange={e => setBroadClassId(e.target.value)}
                        style={{ padding: "0.7rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.75rem", fontWeight: 700, outline: "none", cursor: "pointer", maxWidth: "200px" }}
                    >
                        <option value="">All My Classes</option>
                        {offerings.map(o => (
                           <option key={o.id} value={o.id}>{offeringLabel(o)}</option>
                        ))}
                    </select>
                    <select 
                        value={broadAudience}
                        onChange={e => setBroadAudience(e.target.value)}
                        style={{ padding: "0.7rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.75rem", fontWeight: 700, outline: "none", cursor: "pointer" }}
                    >
                        <option value="students">Students</option>
                        <option value="parents">Parents</option>
                        <option value="all">Everyone</option>
                    </select>
                </div>
                <textarea 
                    placeholder="Type your message here..." 
                    value={broadBody}
                    onChange={e => setBroadBody(e.target.value)}
                    rows={3}
                    style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", fontSize: "0.85rem", width: "100%", outline: "none", resize: "none" }}
                />
                <button 
                    className="btn btn-primary" 
                    onClick={handleBroadcast} 
                    disabled={isPublishing}
                    style={{ width: "100%", justifyContent: "center", padding: "0.85rem", borderRadius: 12, fontWeight: 800, gap: "0.5rem" }}
                >
                    {isPublishing ? <RefreshCcw size={16} className="spin" /> : <Send size={16} />}
                    {isPublishing ? "Sending..." : "Publish Broadcast"}
                </button>
            </div>
          </div>
          
          <div style={{ 
            marginTop: "1.5rem", padding: "1.5rem", borderRadius: 24, 
            background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1.5px solid var(--gray-100)",
            display: "flex", alignItems: "flex-start", gap: "1rem"
          }}>
             <div style={{ padding: "0.6rem", background: "#fff", borderRadius: 12, color: "var(--primary-600)", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
                <Sparkles size={20} />
             </div>
             <div>
               <h4 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Tip: Subject Banks</h4>
               <p style={{ fontSize: "0.8rem", color: "var(--gray-600)", lineHeight: 1.5 }}>You can leverage shared question banks to build your exams faster without leaving the portal.</p>
             </div>
          </div>
        </div>

      </div>

      {toast && (
        <RealtimeToast 
          toast={toast} 
          onClose={() => setToast(null)} 
        />
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
