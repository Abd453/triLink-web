"use client";

import { useEffect, useState } from "react";
import { type FeedbackTicket, type PublicUser, listFeedback, listUsers, patchFeedback } from "@/lib/admin-api";
import { Search, X, MessageSquare, Inbox, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui";

export default function AdminFeedback() {
  const [rows, setRows] = useState<FeedbackTicket[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterText, setFilterText] = useState("");
  const [detailTicket, setDetailTicket] = useState<FeedbackTicket | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [f, u1, u2, u3] = await Promise.all([listFeedback(), listUsers("student"), listUsers("teacher"), listUsers("parent")]);
      setRows(f);
      setUsers([...u1, ...u2, ...u3]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byId = new Map(users.map((u) => [u.id, u]));

  const filtered = rows.filter((t) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    const u = t.authorId ? byId.get(t.authorId) : undefined;
    const author = u ? `${u.firstName} ${u.lastName}`.toLowerCase() : "";
    const anon = t.isAnonymous || !t.authorId;
    const authorMatch = anon ? "anonymous".includes(q) : author.includes(q);
    return (
      authorMatch ||
      (t.message ?? "").toLowerCase().includes(q) ||
      (t.category ?? "").toLowerCase().includes(q) ||
      (t.status ?? "").toLowerCase().includes(q)
    );
  });
  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const visibleRows = filtered.slice(startIdx, endIdx);

  const setStatus = async (id: string, status: string) => {
    try {
      await patchFeedback(id, { status });
      await load();
      // Keep detail modal in sync
      setDetailTicket((prev) => (prev?.id === id ? { ...prev, status } : prev));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return { bg: "#eff6ff", color: "#1d4ed8" };
      case "in_progress": return { bg: "#fefce8", color: "#a16207" };
      case "resolved": return { bg: "#f0fdf4", color: "#15803d" };
      case "closed": return { bg: "#f3f4f6", color: "#374151" };
      default: return { bg: "var(--gray-100)", color: "var(--gray-600)" };
    }
  };

  return (
    <div className="page-wrapper">
      {/* Detail modal */}
      {detailTicket && (
        <div
          className="modal-overlay"
          onClick={() => setDetailTicket(null)}
          style={{ zIndex: 9998 }}
        >
          <div
            className="modal"
            style={{ maxWidth: 540, width: "92%", padding: "2rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                  <span style={{
                    padding: "0.2rem 0.65rem",
                    borderRadius: 20,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    background: "#ede9fe",
                    color: "#6d28d9",
                    textTransform: "capitalize",
                  }}>
                    {detailTicket.category}
                  </span>
                  {(() => {
                    const sc = statusColor(detailTicket.status);
                    return (
                      <span style={{ padding: "0.2rem 0.65rem", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, background: sc.bg, color: sc.color }}>
                        {detailTicket.status.replace("_", " ")}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--gray-400)" }}>
                  {formatDateTime(detailTicket.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: "0.25rem", flexShrink: 0 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>From</div>
              <div style={{ fontWeight: 600, color: "var(--gray-800)" }}>
                {(() => {
                  const u = detailTicket.authorId ? byId.get(detailTicket.authorId) : undefined;
                  if (u) return `${u.firstName} ${u.lastName} (${u.email})`;
                  if (detailTicket.isAnonymous || !detailTicket.authorId) return "Anonymous";
                  return `${detailTicket.authorId.slice(0, 8)}…`;
                })()}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Message</div>
              <div style={{
                background: "var(--gray-50)",
                border: "1px solid var(--gray-100)",
                borderRadius: 12,
                padding: "1rem 1.25rem",
                fontSize: "0.95rem",
                color: "var(--gray-700)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                maxHeight: "40vh",
                overflowY: "auto",
              }}>
                {detailTicket.message}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-600)" }}>Status:</span>
                <Select
                  value={detailTicket.status}
                  onChange={(e) => setStatus(detailTicket.id, e.target.value)}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.85rem", borderRadius: 8 }}
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </Select>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setDetailTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        kicker="Support"
        title="Feedback tickets"
        subtitle="Tickets from students, teachers, and parents."
        icon={<MessageSquare size={22} />}
        variant="light"
      />

      <div className="stats-grid admin-dash-stats-grid">
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon blue"><Inbox size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Open</div>
            <div className="stat-value">{rows.filter(r => r.status === "open" || r.status === "new").length}</div>
            <div className="admin-dash-stat-note">Needs triage</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon orange"><Clock size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">In progress</div>
            <div className="stat-value">{rows.filter(r => r.status === "in_progress").length}</div>
            <div className="admin-dash-stat-note">Being handled</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon teal"><CheckCircle2 size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Resolved</div>
            <div className="stat-value">{rows.filter(r => r.status === "resolved" || r.status === "closed").length}</div>
            <div className="admin-dash-stat-note">Closed out</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon purple"><ShieldCheck size={20} /></div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Anonymous</div>
            <div className="stat-value">{rows.filter(r => r.isAnonymous || !r.authorId).length}</div>
            <div className="admin-dash-stat-note">Of total tickets</div>
          </div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--gray-100)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }} />
            <input
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setPage(0); }}
              placeholder="Filter feedback..."
              style={{
                  width: "100%",
                  padding: "0.65rem 1rem 0.65rem 2.5rem",
                  borderRadius: "12px",
                  border: "1px solid var(--gray-200)",
                  fontSize: "0.9rem",
                  outline: "none",
                  background: "var(--gray-50)"
              }}
            />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Message</th>
                <th>Author</th>
                <th>Date &amp; Time</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0, border: 0 }}>
                    <TableSkeleton rows={5} columns={6} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0, border: 0 }}>
                    <EmptyState icon={<MessageSquare size={26} />} title="No tickets yet" description="When feedback is submitted, it will appear here." />
                  </td>
                </tr>
              ) : (
                visibleRows.map((t) => {
                  const u = t.authorId ? byId.get(t.authorId) : undefined;
                  const authorLabel =
                    u != null
                      ? `${u.firstName} ${u.lastName}`
                      : t.isAnonymous || !t.authorId
                        ? "Anonymous"
                        : `${t.authorId.slice(0, 8)}…`;
                  const sc = statusColor(t.status);
                  return (
                    <tr
                      key={t.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setDetailTicket(t)}
                    >
                      <td>{t.category}</td>
                      <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem" }}>{t.message}</td>
                      <td>{authorLabel}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--gray-500)", whiteSpace: "nowrap" }}>
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td>
                        <span style={{ padding: "0.2rem 0.6rem", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, background: sc.bg, color: sc.color }}>
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={t.status}
                          onChange={(e) => setStatus(t.id, e.target.value)}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          <option value="open">open</option>
                          <option value="in_progress">in_progress</option>
                          <option value="resolved">resolved</option>
                          <option value="closed">closed</option>
                        </Select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > rowsPerPage && (
          <TablePagination
            total={total}
            page={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
          />
        )}
      </div>
    </div>
  );
}
