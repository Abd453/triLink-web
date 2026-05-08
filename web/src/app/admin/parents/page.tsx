"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { type ParentLink, type PublicUser, createParentLink, deleteParentLink, listParentLinks, listUsers, patchUser } from "@/lib/admin-api";
import Select from "@/components/Select";
import TablePagination from "@/components/TablePagination";
import { PageHeader, PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/ui";

function ParentsSkeleton() {
  return (
    <div className="page-wrapper">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={3} />
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}

type EditState = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export default function AdminParents() {
  const [parents, setParents] = useState<PublicUser[]>([]);
  const [students, setStudents] = useState<PublicUser[]>([]);
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Parents directory filters
  const [parentQ, setParentQ] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [parentPage, setParentPage] = useState(0);
  const [parentRowsPerPage, setParentRowsPerPage] = useState(10);

  // Links table state
  const [linksPage, setLinksPage] = useState(0);
  const [linksRowsPerPage, setLinksRowsPerPage] = useState(10);
  const [filterText, setFilterText] = useState("");

  // Add link form
  const [form, setForm] = useState({ parentId: "", studentId: "", relationship: "Father" });

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

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, s, l] = await Promise.all([listUsers("parent"), listUsers("student"), listParentLinks()]);
      setParents(p);
      setStudents(s);
      setLinks(l);
      setForm((f) => ({
        ...f,
        parentId: f.parentId || p[0]?.id || "",
        studentId: f.studentId || s[0]?.id || "",
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parentMap = new Map(parents.map((u) => [u.id, u]));
  const studentMap = new Map(students.map((u) => [u.id, u]));

  // Derived: linked children count per parent
  const childrenCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) {
      m.set(l.parentId, (m.get(l.parentId) ?? 0) + 1);
    }
    return m;
  }, [links]);

  // Derived: unique relationship values for filter dropdown
  const relationshipOptions = useMemo(() => {
    return Array.from(new Set(links.map((l) => l.relationship).filter(Boolean))).sort();
  }, [links]);

  // Parents directory filtered
  const filteredParents = useMemo(() => {
    const qLow = parentQ.toLowerCase();
    return parents.filter((p) => {
      if (qLow && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(qLow) && !p.email.toLowerCase().includes(qLow)) return false;
      if (relationshipFilter) {
        const hasRel = links.some((l) => l.parentId === p.id && l.relationship === relationshipFilter);
        if (!hasRel) return false;
      }
      return true;
    });
  }, [parents, parentQ, relationshipFilter, links]);

  const parentTotal = filteredParents.length;
  const parentMaxPage = Math.max(0, Math.ceil(parentTotal / parentRowsPerPage) - 1);
  const parentCurrentPage = Math.min(parentPage, parentMaxPage);
  const parentStartIdx = parentCurrentPage * parentRowsPerPage;
  const parentEndIdx = Math.min(parentStartIdx + parentRowsPerPage, parentTotal);
  const visibleParents = filteredParents.slice(parentStartIdx, parentEndIdx);

  // Links filtered
  const filteredLinks = useMemo(() => {
    if (!filterText.trim()) return links;
    const q = filterText.toLowerCase();
    return links.filter((l) => {
      const p = parentMap.get(l.parentId);
      const s = studentMap.get(l.studentId);
      const pn = p ? `${p.firstName} ${p.lastName}`.toLowerCase() : "";
      const sn = s ? `${s.firstName} ${s.lastName}`.toLowerCase() : "";
      return pn.includes(q) || sn.includes(q) || l.relationship.toLowerCase().includes(q);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, filterText, parents, students]);

  const linksTotal = filteredLinks.length;
  const linksMaxPage = Math.max(0, Math.ceil(linksTotal / linksRowsPerPage) - 1);
  const linksCurrentPage = Math.min(linksPage, linksMaxPage);
  const linksStartIdx = linksCurrentPage * linksRowsPerPage;
  const linksEndIdx = Math.min(linksStartIdx + linksRowsPerPage, linksTotal);
  const visibleLinks = filteredLinks.slice(linksStartIdx, linksEndIdx);

  const addLink = async () => {
    if (!form.parentId || !form.studentId) return;
    try {
      await createParentLink({
        parentId: form.parentId,
        studentId: form.studentId,
        relationship: form.relationship,
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Link failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove link?")) return;
    try {
      await deleteParentLink(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openEdit = (p: PublicUser) => {
    setSaveErr(null);
    setEditState({ id: p.id, firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? "" });
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
      setParents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditState(null);
      showToast("Parent updated successfully");
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !parents.length && !students.length && !links.length) {
    return <ParentsSkeleton />;
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
        kicker="Guardian Mapping"
        title="Parents & links"
        subtitle="Link guardians to the right student records."
        icon={<UserRound size={22} />}
        actions={(
          <Link href="/admin/registration" className="btn btn-primary" style={{ borderRadius: 12 }}>+ Register parent</Link>
        )}
      />

      <div className="parents-summary-grid">
        <div className="card parents-summary-card">
          <div className="parents-summary-icon blue">
            <UserRound size={18} />
          </div>
          <div className="parents-summary-label">Parents</div>
          <div className="parents-summary-value">{parents.length}</div>
        </div>
        <div className="card parents-summary-card">
          <div className="parents-summary-icon teal">
            <Users size={18} />
          </div>
          <div className="parents-summary-label">Students</div>
          <div className="parents-summary-value">{students.length}</div>
        </div>
        <div className="card parents-summary-card">
          <div className="parents-summary-icon orange">
            <Link2 size={18} />
          </div>
          <div className="parents-summary-label">Existing links</div>
          <div className="parents-summary-value">{links.length}</div>
        </div>
      </div>

      {err && <div className="card" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{err}</div>}

      {/* Filter bar — matches students/teachers pattern */}
      <div className="card" style={{ marginBottom: "1rem", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={parentQ}
          onChange={(e) => { setParentQ(e.target.value); setParentPage(0); }}
          placeholder="Search name or email…"
          style={{ ...inputStyle, minWidth: 220, flex: "1 1 220px" }}
        />
        <select
          value={relationshipFilter}
          onChange={(e) => { setRelationshipFilter(e.target.value); setParentPage(0); }}
          style={selectStyle}
        >
          <option value="">All relationships</option>
          {relationshipOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Parents Directory */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--gray-100)", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="card-title parents-section-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UserRound size={16} />
            Parents directory
          </h3>
          <span style={{ fontSize: "0.8rem", color: "var(--gray-400)", fontWeight: 500 }}>
            {parentTotal} of {parents.length} parent{parents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Linked children</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--gray-500)" }}>Loading…</td>
                </tr>
              ) : filteredParents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--gray-500)" }}>No parents found.</td>
                </tr>
              ) : (
                visibleParents.map((p) => {
                  const count = childrenCountMap.get(p.id) ?? 0;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</td>
                      <td>{p.email}</td>
                      <td>{p.phone ?? "—"}</td>
                      <td>
                        {count > 0 ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, background: "var(--primary-50)", color: "var(--primary-700)" }}>
                            <Link2 size={11} />
                            {count}
                          </span>
                        ) : (
                          <span style={{ color: "var(--gray-400)", fontSize: "0.82rem" }}>None</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={parentTotal}
          page={parentCurrentPage}
          rowsPerPage={parentRowsPerPage}
          onPageChange={setParentPage}
          onRowsPerPageChange={(v) => { setParentRowsPerPage(v); setParentPage(0); }}
        />
      </div>

      {/* Add link form */}
      <div className="card parents-panel" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title parents-section-title" style={{ marginBottom: "1rem" }}>
          <ShieldCheck size={16} />
          Add parent–student link
        </h3>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
          <label>
            Parent
            <Select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: "0.6rem 1rem", borderRadius: "20px", border: "1px solid var(--primary-200)", background: "var(--primary-50)", color: "var(--primary-800)", outline: "none", cursor: "pointer", fontWeight: 500 }}>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.email})
                </option>
              ))}
            </Select>
          </label>
          <label>
            Student
            <Select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: "0.6rem 1rem", borderRadius: "20px", border: "1px solid var(--primary-200)", background: "var(--primary-50)", color: "var(--primary-800)", outline: "none", cursor: "pointer", fontWeight: 500 }}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Relationship
            <Select value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: "0.6rem 1rem", borderRadius: "20px", border: "1px solid var(--primary-200)", background: "var(--primary-50)", color: "var(--primary-800)", outline: "none", cursor: "pointer", fontWeight: 500 }}>
              <option>Father</option>
              <option>Mother</option>
              <option>Guardian</option>
            </Select>
          </label>
          <button type="button" className="btn btn-primary" onClick={addLink} disabled={loading || !parents.length || !students.length}>
            Create link
          </button>
        </div>
      </div>

      {/* Existing links */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--gray-100)", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="card-title parents-section-title" style={{ margin: 0 }}>
            Existing links
          </h3>
          <input
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setLinksPage(0); }}
            placeholder="Filter by name or relationship…"
            style={{ ...inputStyle, maxWidth: 280, width: "auto" }}
          />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Student</th>
                <th>Relationship</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Loading…</td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--gray-500)" }}>No links.</td>
                </tr>
              ) : (
                visibleLinks.map((l) => {
                  const p = parentMap.get(l.parentId);
                  const s = studentMap.get(l.studentId);
                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{p ? `${p.firstName} ${p.lastName}` : "Unknown parent"}</td>
                      <td>{s ? `${s.firstName} ${s.lastName}` : "Unknown student"}</td>
                      <td>{l.relationship}</td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(l.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={linksTotal}
          page={linksCurrentPage}
          rowsPerPage={linksRowsPerPage}
          onPageChange={setLinksPage}
          onRowsPerPageChange={(v) => { setLinksRowsPerPage(v); setLinksPage(0); }}
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
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem" }}>Edit parent</h2>
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
