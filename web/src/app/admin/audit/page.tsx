"use client";

import { useEffect, useState } from "react";
import { listAuditLogs, listUsers, type PublicUser } from "@/lib/admin-api";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui";
import { ShieldCheck, Search } from "lucide-react";

type Row = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  diffJson?: string | null;
  createdAt: string;
};

function describeAction(action: string): string {
  switch (action) {
    case "user.login":
      return "Signed in";
    case "user.register":
      return "Registered a new user";
    case "user.password_change":
      return "Changed password";
    default:
      return action.replace(/\./g, " · ");
  }
}

function describeDetails(row: Row): string {
  if (!row.diffJson) {
    if (row.action === "user.login") return "Admin portal session started";
    if (row.action === "user.password_change") return "Account password updated";
    return "—";
  }
  try {
    const d = JSON.parse(row.diffJson) as Record<string, unknown>;
    if (row.action === "user.register") {
      const email = typeof d.email === "string" ? d.email : "";
      const role = typeof d.role === "string" ? d.role : "";
      const name = typeof d.name === "string" ? d.name : "";
      const bits = [name, email, role].filter(Boolean);
      return bits.length ? bits.join(" · ") : "New account";
    }
    if (row.action === "user.login") {
      const portal = typeof d.portalRole === "string" ? d.portalRole : "";
      return portal ? `Signed in as ${portal}` : "Signed in";
    }
  } catch {
    /* ignore */
  }
  return "—";
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [data, everyone] = await Promise.all([listAuditLogs(150), listUsers()]);
        setRows(data as Row[]);
        const m = new Map<string, string>();
        (everyone as PublicUser[]).forEach((u) => {
          m.set(u.id, `${u.firstName} ${u.lastName}`.trim() || u.email);
        });
        setNameById(m);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredRows = rows.filter((r) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    const who = (nameById.get(r.actorId) ?? "Staff member").toLowerCase();
    const action = describeAction(r.action).toLowerCase();
    const details = describeDetails(r).toLowerCase();
    const when = new Date(r.createdAt).toLocaleString().toLowerCase();
    return who.includes(q) || action.includes(q) || details.includes(q) || when.includes(q);
  });

  const total = filteredRows.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const visibleRows = filteredRows.slice(startIdx, endIdx);

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="Security"
        title="Activity log"
        subtitle="Important account and security events across your school."
        icon={<ShieldCheck size={22} />}
        variant="light"
      />

      <div className="card" style={{ marginBottom: "1.5rem", background: "var(--primary-50)", border: "1.5px solid var(--primary-200)", borderRadius: 20, display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "2rem" }}>
        <div style={{ padding: "0.65rem", background: "white", borderRadius: "50%", color: "var(--primary-600)", display: "flex", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </div>
        <div>
          <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1.05rem", color: "var(--primary-800)", fontWeight: 700 }}>About Activity Logs</h3>
          <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--primary-700)", opacity: 0.9 }}>
            This log helps you review crucial security events—such as sign-ins, new user registrations, and password updates.
            Routine browsing is not recorded here. Logouts are handled locally by the browser and will not appear. Older entries automatically roll off to keep the log relevant and performant.
          </p>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}
      <div className="card">
        <div style={{ padding: "1.25rem 2rem", borderBottom: "1.5px solid var(--gray-50)", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
            <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(0);
              }}
              style={{
                width: "100%",
                padding: "0.75rem 1rem 0.75rem 2.75rem",
                borderRadius: "20px",
                border: "1.5px solid var(--gray-300)",
                backgroundColor: "var(--gray-50)",
                fontSize: "0.95rem",
                outline: "none",
                transition: "all 0.2s ease",
                color: "var(--gray-800)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--primary-400)";
                e.target.style.backgroundColor = "#fff";
                e.target.style.boxShadow = "0 0 0 3px var(--primary-50)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--gray-300)";
                e.target.style.backgroundColor = "var(--gray-50)";
                e.target.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.02)";
              }}
            />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0, border: 0 }}>
                    <TableSkeleton rows={5} columns={4} />
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0, border: 0 }}>
                    <EmptyState icon={<ShieldCheck size={26} />} title="No activity found" description="No audit logs match your current filters." />
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const who = nameById.get(r.actorId) ?? "Staff member";
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{who}</td>
                      <td>{describeAction(r.action)}</td>
                      <td style={{ fontSize: "0.9rem", color: "var(--gray-700)" }}>{describeDetails(r)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={total}
          page={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>
    </div>
  );
}
