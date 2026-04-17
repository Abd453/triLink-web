"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Edit3, Filter, MoreHorizontal, Plus, Search, Trash2, Users } from "lucide-react";
import { type PublicUser, listUsers } from "@/lib/admin-api";
import TablePagination from "@/components/TablePagination";

type StudentRecord = PublicUser & {
  address?: string | null;
  cityState?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  dob?: string | null;
  rollNumber?: string | null;
};

const avatarGradients = [
  "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #38bdf8 100%)",
  "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
  "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
];

const shellStyle: React.CSSProperties = {
  minHeight: "100%",
  margin: "-1.5rem",
  padding: "1.5rem",
  background: "#F4F7FE",
  fontFamily: "Inter, var(--font-display), system-ui, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 24,
  border: "1px solid rgba(226, 232, 240, 0.72)",
  boxShadow: "0 18px 46px rgba(15, 23, 42, 0.045)",
};

function initialsFor(student: PublicUser) {
  return `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase() || "ST";
}

function fullName(student: PublicUser) {
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Unnamed Student";
}

function studentRoll(student: StudentRecord, index: number) {
  return student.rollNumber || `ST-${String(index + 1).padStart(4, "0")}`;
}

function studentAddress(student: StudentRecord) {
  return student.address || [student.cityState, student.country].filter(Boolean).join(", ") || "Not added";
}

function studentClass(student: PublicUser) {
  return [student.grade, student.section].filter(Boolean).join(" - ") || "Unassigned";
}

function studentDob(student: StudentRecord) {
  const raw = student.dateOfBirth || student.dob;
  if (!raw) return "Not added";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.35rem 0.75rem",
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 800,
        background: complete ? "#DCFCE7" : "#FEF3C7",
        color: complete ? "#166534" : "#92400E",
        whiteSpace: "nowrap",
      }}
    >
      {complete ? "Active" : "Needs info"}
    </span>
  );
}

function StudentsSkeleton() {
  return (
    <div style={shellStyle}>
      <div style={{ ...cardStyle, padding: "2rem" }}>
        <div className="admin-skeleton shimmer" style={{ width: 180, height: 18, borderRadius: 12, marginBottom: 18 }} />
        <div className="admin-skeleton shimmer" style={{ width: "100%", height: 380, borderRadius: 20 }} />
      </div>
    </div>
  );
}

export default function AdminStudentsPremiumPage() {
  const [students, setStudents] = useState<PublicUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = async (search = query) => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listUsers("student", search.trim() || undefined);
      setStudents(data);
      setPage(0);
      setSelected(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = students.length;
  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const startIdx = currentPage * rowsPerPage;
  const visibleRows = students.slice(startIdx, startIdx + rowsPerPage);
  const pageIds = visibleRows.map((student) => student.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const stats = useMemo(() => {
    const active = students.filter((student) => student.grade && student.section).length;
    const missingPhone = students.filter((student) => !student.phone).length;
    return { active, missingPhone };
  }, [students]);

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleStudent = (studentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  if (loading && students.length === 0) return <StudentsSkeleton />;

  return (
    <div style={shellStyle}>
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <div style={{ ...cardStyle, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: "1 1 360px", minWidth: 240 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)", color: "#4f46e5", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Search size={18} />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
              placeholder="Search by student name, email, class, or roll number"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", color: "#0f172a", fontSize: "0.95rem", fontWeight: 600 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => void load()} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 14, height: 42, padding: "0 1rem", display: "inline-flex", alignItems: "center", gap: "0.45rem", fontWeight: 800, cursor: "pointer" }}>
              <Filter size={16} />
              Filter
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          <div style={{ ...cardStyle, padding: "1.75rem", background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)", gridColumn: "1 / -1", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <p style={{ color: "#7c3aed", fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "0.65rem" }}>
                  Student directory
                </p>
                <h1 style={{ color: "#0f172a", fontSize: "2rem", lineHeight: 1.08, margin: 0, letterSpacing: 0, fontWeight: 900 }}>
                  Manage students
                </h1>
                <p style={{ color: "#64748b", fontSize: "0.95rem", marginTop: "0.65rem", maxWidth: 560, lineHeight: 1.6 }}>
                  Review enrollment details, class placement, contact information, and student records.
                </p>
              </div>
              <Link href="/admin/registration" style={primaryButtonStyle}>
                <Plus size={17} />
                Add Student
              </Link>
            </div>
          </div>

          {[
            { label: "Total students", value: total, icon: <Users size={18} />, bg: "linear-gradient(135deg, #fce7f3 0%, #fed7aa 100%)", color: "#be123c" },
            { label: "Active profiles", value: stats.active, icon: <Users size={18} />, bg: "linear-gradient(135deg, #dcfce7 0%, #bae6fd 100%)", color: "#047857" },
            { label: "Need phone", value: stats.missingPhone, icon: <Bell size={18} />, bg: "linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)", color: "#4f46e5" },
          ].map((item) => (
            <div key={item.label} style={{ ...cardStyle, padding: "1.35rem" }}>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: item.bg, color: item.color, display: "grid", placeItems: "center", marginBottom: "1rem" }}>
                {item.icon}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.78rem", fontWeight: 800 }}>{item.label}</div>
              <div style={{ color: "#0f172a", fontSize: "1.75rem", fontWeight: 900, marginTop: "0.25rem" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {err && (
          <div style={{ ...cardStyle, padding: "1rem 1.25rem", color: "#b91c1c", background: "#fff1f2" }}>
            {err}
          </div>
        )}

        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "1.5rem 1.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", borderBottom: "1px solid #f1f5f9" }}>
            <div>
              <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.15rem", fontWeight: 900 }}>Students List</h2>
              <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.86rem", fontWeight: 600 }}>
                {selected.size > 0 ? `${selected.size} selected` : "All enrolled student records"}
              </p>
            </div>
            <button type="button" aria-label="More student actions" style={topIconButtonStyle}>
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1040 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>
                    <input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Select all visible students" style={checkboxStyle} />
                  </th>
                  {["Student Name", "Roll Number", "Address", "Class", "DOB", "Phone", "Status", "Action"].map((heading) => (
                    <th key={heading} style={{ ...thStyle, textAlign: heading === "Action" ? "right" : "left" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "2rem", color: "#64748b", fontWeight: 700 }}>
                      Loading students...
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "2rem", color: "#64748b", fontWeight: 700 }}>
                      No students found.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((student, i) => {
                    const record = student as StudentRecord;
                    const absoluteIndex = startIdx + i;
                    const profileComplete = Boolean(student.grade && student.section && student.phone);
                    return (
                      <tr key={student.id} style={{ background: selected.has(student.id) ? "#f5f3ff" : "#fff" }}>
                        <td style={tdStyle}>
                          <input type="checkbox" checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} aria-label={`Select ${fullName(student)}`} style={checkboxStyle} />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", minWidth: 250 }}>
                            <div style={{ width: 46, height: 46, borderRadius: "50%", background: avatarGradients[absoluteIndex % avatarGradients.length], color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, boxShadow: "0 12px 24px rgba(79, 70, 229, 0.16)", flexShrink: 0 }}>
                              {initialsFor(student)}
                            </div>
                            <div>
                              <div style={{ color: "#0f172a", fontWeight: 900, fontSize: "0.94rem" }}>{fullName(student)}</div>
                              <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.78rem", marginTop: 3 }}>{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>{studentRoll(record, absoluteIndex)}</td>
                        <td style={{ ...tdStyle, maxWidth: 220 }}>{studentAddress(record)}</td>
                        <td style={tdStyle}>{studentClass(student)}</td>
                        <td style={tdStyle}>{studentDob(record)}</td>
                        <td style={tdStyle}>{student.phone || "Not added"}</td>
                        <td style={tdStyle}>
                          <StatusBadge complete={profileComplete} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                            <button type="button" aria-label={`Edit ${fullName(student)}`} style={iconButtonStyle}>
                              <Edit3 size={16} />
                            </button>
                            <button type="button" aria-label={`Delete ${fullName(student)}`} style={{ ...iconButtonStyle, color: "#ef4444", background: "#fff1f2" }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
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
            onRowsPerPageChange={(value) => {
              setRowsPerPage(value);
              setPage(0);
            }}
          />
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  color: "#94a3b8",
  fontSize: "0.72rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  borderBottom: "1px solid #eef2f7",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "1.15rem 1.25rem",
  color: "#475569",
  fontSize: "0.88rem",
  fontWeight: 700,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  accentColor: "#4f46e5",
  cursor: "pointer",
};

const topIconButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#475569",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "none",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: 16,
  height: 46,
  padding: "0 1.1rem",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  fontWeight: 900,
  boxShadow: "0 16px 34px rgba(79, 70, 229, 0.24)",
  whiteSpace: "nowrap",
};

const iconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#64748b",
  display: "inline-grid",
  placeItems: "center",
  cursor: "pointer",
};
