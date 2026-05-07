"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarDays, Megaphone, RefreshCcw, Sparkles, Users, Trash2, Send } from "lucide-react";
import { 
  type AcademicYear, 
  type Announcement, 
  createAnnouncement, 
  deleteAnnouncement, 
  getActiveAcademicYear, 
  listAnnouncements 
} from "@/lib/admin-api";
import Select from "@/components/Select";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, CardSkeleton } from "@/components/ui";

const AUDIENCES = ["all", "students", "teachers", "parents"];

function AnnouncementsSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={3} />
      <CardSkeleton lines={4} />
      <div style={{ height: 12 }} />
      <CardSkeleton lines={4} />
    </div>
  );
}

export default function AdminAnnouncements() {
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const active = await getActiveAcademicYear();
      setYear(active);
      if (active) {
        setRows(await listAnnouncements(active.id));
      } else {
        setRows(await listAnnouncements());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    if (!year) {
      showToast("No active academic year — activate one in Settings first.", false);
      return;
    }
    if (!title.trim() || !body.trim()) {
      showToast("Both title and message are required.", false);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createAnnouncement({
        academicYearId: year.id,
        title: title.trim(),
        body: body.trim(),
        audience,
      });
      setTitle("");
      setBody("");
      await load();
      showToast("Announcement published successfully!", true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Publishing failed", false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteAnnouncement(id);
      await load();
      showToast("Announcement deleted.", true);
    } catch (e) {
      showToast("Delete failed", false);
    }
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const audienceStats = {
    all: rows.filter((r) => r.audience === "all").length,
    scoped: rows.filter((r) => r.audience !== "all" && r.audience !== "all").length, // 'students', 'teachers', etc
  };

  if (loading && rows.length === 0) {
    return <AnnouncementsSkeleton />;
  }

  return (
    <div className="page-wrapper">
      {toast && (
        <div style={{ 
          position: "fixed", 
          top: 30, 
          right: 30, 
          zIndex: 9999, 
          background: toast.ok ? "#065f46" : "var(--danger)", 
          color: "#fff",
          padding: "0.85rem 1.75rem", 
          borderRadius: 14, 
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)", 
          fontWeight: 700,
          fontSize: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          animation: "toast-entry 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards"
        }}>
          {toast.ok ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      <PageHeader
        kicker="Communication Hub"
        title="Announcements"
        subtitle="Create and manage broadcast messages for the school community."
        icon={<Megaphone size={22} />}
        actions={(
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} style={{ borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCcw size={14} className={loading ? "spin" : ""} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        )}
      />

      <div className="announcements-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="card announcements-summary-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="announcements-summary-icon blue" style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-100)", color: "var(--primary-600)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
            <Megaphone size={20} />
          </div>
          <div className="announcements-summary-label" style={{ fontSize: "0.85rem", color: "var(--gray-500)", fontWeight: 500 }}>Total Broadcasts</div>
          <div className="announcements-summary-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--gray-900)" }}>{rows.length}</div>
        </div>
        <div className="card announcements-summary-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="announcements-summary-icon teal" style={{ width: 42, height: 42, borderRadius: 12, background: "var(--success-light)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
            <Users size={20} />
          </div>
          <div className="announcements-summary-label" style={{ fontSize: "0.85rem", color: "var(--gray-500)", fontWeight: 500 }}>Global Messages</div>
          <div className="announcements-summary-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--gray-900)" }}>{audienceStats.all}</div>
        </div>
        <div className="card announcements-summary-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="announcements-summary-icon orange" style={{ width: 42, height: 42, borderRadius: 12, background: "var(--warning-light)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
            <CalendarDays size={20} />
          </div>
          <div className="announcements-summary-label" style={{ fontSize: "0.85rem", color: "var(--gray-500)", fontWeight: 500 }}>Recent Scoped</div>
          <div className="announcements-summary-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--gray-900)" }}>{audienceStats.scoped}</div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", padding: "1rem", marginBottom: "1.5rem", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12, fontWeight: 500 }}>{err}</div>}

      <div className="card announcements-panel" style={{ padding: "2rem", marginBottom: "2rem", borderRadius: 20, border: "1.5px solid var(--gray-100)" }}>
        <h3 className="card-title announcements-section-title" style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          <BellRing size={20} className="text-primary-500" />
          Create New Broadast
        </h3>
        
        <div style={{ display: "grid", gap: "1.5rem", maxWidth: "800px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "1rem" }}>
             <div style={{ display: "grid", gap: "0.5rem" }}>
               <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Subject / Title</label>
               <input 
                 placeholder="Main heading for the announcement" 
                 value={title} 
                 onChange={(e) => setTitle(e.target.value)} 
                 style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", fontSize: "0.95rem", width: "100%", outline: "none" }} 
               />
             </div>
             <div style={{ display: "grid", gap: "0.5rem" }}>
               <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Target Audience</label>
               <Select 
                 value={audience} 
                 onChange={(e) => setAudience(e.target.value)} 
                 style={{ padding: "0.75rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", cursor: "pointer", fontWeight: 600 }}
               >
                 {AUDIENCES.map((a) => (
                   <option key={a} value={a}>
                     {a.charAt(0).toUpperCase() + a.slice(1)}
                   </option>
                 ))}
               </Select>
             </div>
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-700)" }}>Message Content</label>
            <textarea 
              placeholder="Provide more details about this announcement..." 
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              rows={4} 
              style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1.5px solid var(--gray-200)", fontSize: "0.95rem", width: "100%", outline: "none", resize: "none" }} 
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-500)" }}>
              {year ? (
                <span>Publishing to <strong>{year.label}</strong></span>
              ) : (
                <span className="text-danger">Target year not selected</span>
              )}
            </p>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={publish} 
              disabled={isSubmitting || !year}
              style={{ padding: "0.75rem 2rem", borderRadius: 12, fontWeight: 700, gap: "0.5rem" }}
            >
              <Send size={16} />
              {isSubmitting ? "Publishing..." : "Send Announcement"}
            </button>
          </div>
        </div>
      </div>

      <div className="card announcements-panel" style={{ padding: "0", overflow: "hidden", borderRadius: 20, border: "1.5px solid var(--gray-100)" }}>
        <div style={{ padding: "1.5rem 2rem", borderBottom: "1.5px solid var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="card-title announcements-section-title" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            Recent Activities
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 500 }}>
            {year ? `Showing broadcast for ${year.label}` : "All historic broadcasts"}
          </span>
        </div>
        
        <div className="table-wrapper">
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0" }}>
            <thead>
              <tr style={{ background: "var(--gray-50)" }}>
                <th style={{ padding: "1rem 2rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gray-500)" }}>Broadcast Title</th>
                <th style={{ padding: "1rem 2rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gray-500)" }}>Audience</th>
                <th style={{ padding: "1rem 2rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gray-500)" }}>Date Posted</th>
                <th style={{ padding: "1rem 2rem", textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--gray-400)" }}>
                    <Megaphone size={32} style={{ opacity: 0.1, marginBottom: "1rem" }} />
                    <p>No announcements found for this period.</p>
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className="table-row-hover">
                    <td style={{ padding: "1.25rem 2rem", fontWeight: 700, color: "var(--gray-800)" }}>{a.title}</td>
                    <td style={{ padding: "1.25rem 2rem" }}>
                      <span style={{ 
                        padding: "0.25rem 0.75rem", 
                        borderRadius: "20px", 
                        fontSize: "0.75rem", 
                        fontWeight: 700,
                        background: a.audience === 'all' ? 'var(--primary-50)' : 'var(--gray-100)',
                        color: a.audience === 'all' ? 'var(--primary-700)' : 'var(--gray-600)',
                        textTransform: "capitalize"
                      }}>
                        {a.audience}
                      </span>
                    </td>
                    <td style={{ padding: "1.25rem 2rem", fontSize: "0.85rem", color: "var(--gray-500)" }}>
                      {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: "1.25rem 2rem", textAlign: "right" }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-icon" 
                        onClick={() => del(a.id)}
                        style={{ color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer" }}
                        title="Delete broadcast"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style jsx>{`
        .table-row-hover:hover {
          background: var(--primary-50)/10;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes toast-entry {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
