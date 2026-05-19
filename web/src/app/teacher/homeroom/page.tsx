"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Home, Users, MessageSquare, FileText, Search, AlertCircle } from "lucide-react";
import {
  getMyHomeroomClass,
  type HomeroomMyClass,
  type HomeroomStudent,
} from "@/lib/admin-api";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";
import { PageHeader, PageHeaderSkeleton, ListSkeleton, EmptyState } from "@/components/ui";
import TablePagination from "@/components/TablePagination";

function studentInitials(s: HomeroomStudent): string {
  return ((s.firstName?.[0] ?? "") + (s.lastName?.[0] ?? "")).toUpperCase() || "??";
}

export default function TeacherHomeroomPage() {
  const [data, setData] = useState<HomeroomMyClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Auto-reset page when query changes
  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await getMyHomeroomClass();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load homeroom";
          setErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [data, query]);

  const pagedStudents = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, page, rowsPerPage]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <PageHeaderSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  // Not assigned as homeroom — show friendly empty state
  if (err || !data) {
    return (
      <div className="page-wrapper">
        <PageHeader kicker="Homeroom" title="My Homeroom Class" subtitle="No homeroom assignment found." icon={<Home size={22} />} variant="light" />
        <EmptyState
          icon={<AlertCircle size={26} />}
          title="No Homeroom Assignment"
          description="You are not assigned as a homeroom teacher for any class this academic year. Contact your school administrator if you believe this is incorrect."
        />
      </div>
    );
  }

  const { students } = data;
  const grade = students[0]?.grade ?? "—";
  const section = students[0]?.section ?? "—";

  return (
    <div className="page-wrapper">
      <PageHeader
        kicker="My Homeroom Class"
        title={`${grade}${section && section !== "—" ? ` — Section ${section}` : ""}`}
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"} under your care`}
        icon={<Home size={22} />}
        actions={(
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link
              href="/teacher/report-cards?from=homeroom"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.55rem 1rem",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <FileText size={14} /> Report Cards
            </Link>
            <Link
              href="/teacher/attendance?from=homeroom"
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}
            >
              <Users size={14} /> Take Attendance
            </Link>
          </div>
        )}
      />

      {/* Search bar */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid var(--gray-100)",
          padding: "0.85rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Search size={16} color="var(--gray-400)" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "0.9rem",
            background: "transparent",
            color: "var(--gray-800)",
          }}
        />
        <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
          {filteredStudents.length} of {students.length}
        </span>
      </div>

      {/* Student list */}
      {filteredStudents.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1.5px dashed var(--gray-200)",
            padding: "2.5rem",
            textAlign: "center",
            color: "var(--gray-500)",
          }}
        >
          <Users size={36} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
          <div style={{ fontSize: "0.95rem" }}>
            {query ? "No students match your search." : "No students enrolled in this class yet."}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1.5px solid var(--gray-100)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              padding: "0.75rem 1.25rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "var(--gray-50)",
              borderBottom: "1px solid var(--gray-100)",
            }}
          >
            <span>Student</span>
            <span>Actions</span>
          </div>

          {pagedStudents.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                padding: "0.85rem 1.25rem",
                borderBottom: i < pagedStudents.length - 1 ? "1px solid var(--gray-100)" : "none",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <AuthenticatedAvatar
                  fileId={s.profileImageFileId}
                  initials={studentInitials(s)}
                  size={42}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--gray-900)", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.firstName} {s.lastName}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>
                    {s.grade}
                    {s.section ? ` · Section ${s.section}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link
                  href={`/teacher/report-cards?studentId=${s.id}&from=homeroom`}
                  title="View Report Card"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "0.4rem 0.7rem",
                    borderRadius: 8,
                    background: "var(--primary-50)",
                    color: "var(--primary-700)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    border: "1px solid var(--primary-100)",
                  }}
                >
                  <FileText size={13} /> Report
                </Link>
                <Link
                  href={`/teacher/chat?to=${s.id}&from=homeroom`}
                  title="Message Student"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "0.4rem 0.7rem",
                    borderRadius: 8,
                    background: "var(--gray-50)",
                    color: "var(--gray-700)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    border: "1px solid var(--gray-100)",
                  }}
                >
                  <MessageSquare size={13} /> Message
                </Link>
              </div>
            </div>
          ))}
          {filteredStudents.length > 0 && (
            <TablePagination
              total={filteredStudents.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => {
                setRowsPerPage(n);
                setPage(0);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
