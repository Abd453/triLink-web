"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Building2, AlertTriangle, Users, Search } from "lucide-react";
import { type PublicUser, listUsers, patchUser } from "@/lib/admin-api";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/ui";

function TeachersSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

type EditState = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export default function AdminTeachers() {
  const [rows, setRows] = useState<PublicUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Edit modal
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setLoading(true);
    setErr(null);
    listUsers("teacher")
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // Derived filter options
  const subjectOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.subject).filter(Boolean) as string[])).sort();
  }, [rows]);

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.department).filter(Boolean) as string[])).sort();
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    const qLow = q.toLowerCase();
    return rows.filter((t) => {
      if (q && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(qLow) && !t.email.toLowerCase().includes(qLow)) return false;
      if (subjectFilter && t.subject !== subjectFilter) return false;
      if (departmentFilter && t.department !== departmentFilter) return false;
      return true;
    });
  }, [rows, q, subjectFilter, departmentFilter]);

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const visibleRows = filtered.slice(startIdx, endIdx);

  const withSubject = rows.filter((t) => !!t.subject).length;
  const withDepartment = rows.filter((t) => !!t.department).length;
  const unassigned = rows.filter((t) => !t.subject && !t.department).length;

  const openEdit = (t: PublicUser) => {
    setSaveErr(null);
    setEditState({ id: t.id, firstName: t.firstName, lastName: t.lastName, phone: t.phone ?? "" });
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await patchUser(editState.id, {
        firstName: editState.firstName,
        lastName: editState.lastName,
        phone: editState.phone || null,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditState(null);
      showToast("Teacher updated successfully");
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && rows.length === 0) {
    return <TeachersSkeleton />;
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--gray-200)",
    fontSize: "0.9rem",
    outline: "none",
    background: "var(--gray-50)",
    width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--gray-200)",
    fontSize: "0.9rem",
    outline: "none",
    background: "var(--gray-50)",
    cursor: "pointer",
  };

  return (
    <div className="page-wrapper">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "var(--success, #22c55e)", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Faculty Directory"
        title="Teachers"
        subtitle="Teachers on staff."
        icon={<BookOpen size={22} />}
        actions={(
          <Link href="/admin/registration?from=teachers" className="btn btn-primary" style={{ borderRadius: 12 }}>+ Register</Link>
        )}
      />

      <div className="stats-grid admin-dash-stats-grid">
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon blue">
            <Users size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Total teachers</div>
            <div className="stat-value">{rows.length}</div>
            <div className="admin-dash-stat-note">Faculty members</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon teal">
            <BookOpen size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">With subject</div>
            <div className="stat-value">{withSubject}</div>
            <div className="admin-dash-stat-note">Assigned expertise</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon orange">
            <Building2 size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">With department</div>
            <div className="stat-value">{withDepartment}</div>
            <div className="admin-dash-stat-note">Departmentalized staff</div>
          </div>
        </div>
        <div className="stat-card admin-dash-stat-card">
          <div className="stat-icon admin-dash-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label admin-dash-stat-label">Unassigned</div>
            <div className="stat-value">{unassigned}</div>
            <div className="admin-dash-stat-note">No subject or dept</div>
          </div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1rem", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search name or email…"
            style={{
              padding: "0.75rem 1rem 0.75rem 2.75rem",
              borderRadius: "20px",
              border: "1.5px solid var(--gray-300)",
              backgroundColor: "var(--gray-50)",
              fontSize: "0.95rem",
              width: "100%",
              outline: "none",
              transition: "all 0.2s ease",
              color: "var(--gray-800)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--primary-400)";
              e.target.style.backgroundColor = "#fff";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--gray-300)";
              e.target.style.backgroundColor = "var(--gray-50)";
            }}
          />
        </div>
        <Select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(0); }}
          style={{
            padding: "0.65rem 1.75rem 0.65rem 1rem",
            borderRadius: "20px",
            border: "1.5px solid var(--primary-200)",
            backgroundColor: "var(--primary-50)",
            color: "var(--primary-800)",
            fontWeight: 600,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All subjects</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select
          value={departmentFilter}
          onChange={(e) => { setDepartmentFilter(e.target.value); setPage(0); }}
          style={{
            padding: "0.65rem 1.75rem 0.65rem 1rem",
            borderRadius: "20px",
            border: "1.5px solid var(--primary-200)",
            backgroundColor: "var(--primary-50)",
            color: "var(--primary-800)",
            fontWeight: 600,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All departments</option>
          {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Subject</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--gray-500)" }}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--gray-500)" }}>No teachers found.</td>
                </tr>
              ) : (
                visibleRows.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</td>
                    <td>{t.email}</td>
                    <td>{t.subject ?? "—"}</td>
                    <td>{t.department ?? "—"}</td>
                    <td>{t.phone ?? "—"}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={total}
          page={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        />
      </div>

      {/* Edit Modal */}
      {editState && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9998, padding: "1rem" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div className="modal" style={{ maxWidth: 420, width: "100%", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem" }}>Edit teacher</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                First name
                <input
                  value={editState.firstName}
                  onChange={(e) => setEditState((s) => s ? { ...s, firstName: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Last name
                <input
                  value={editState.lastName}
                  onChange={(e) => setEditState((s) => s ? { ...s, lastName: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Phone
                <input
                  value={editState.phone}
                  onChange={(e) => setEditState((s) => s ? { ...s, phone: e.target.value } : s)}
                  style={{ ...inputStyle, marginTop: 4 }}
                  placeholder="Optional"
                />
              </label>
            </div>
            {saveErr && <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginTop: "0.75rem" }}>{saveErr}</div>}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditState(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
