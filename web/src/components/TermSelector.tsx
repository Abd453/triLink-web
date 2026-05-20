"use client";
import { useEffect, useState } from "react";
import { listTerms, type TermRow } from "@/lib/admin-api";
import { useTermStore } from "@/store/termStore";
import Select from "./Select";

interface TermSelectorProps {
  academicYearId: string | null;
  onTermChange?: (termId: string | null, termName: string | null) => void;
  /** When true, renders as a read-only display (student/parent role) */
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TermSelector({
  academicYearId,
  onTermChange,
  readOnly = false,
  className,
  style,
}: TermSelectorProps) {
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedTermId, selectedTermName, setSelectedTerm } = useTermStore();

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    listTerms(academicYearId)
      .then((data) => {
        setTerms(data);
        // Auto-select first term if nothing is selected or current selection is stale
        if (data.length > 0) {
          const stillValid = data.some((t) => t.id === selectedTermId);
          const explicitAllTerms = selectedTermId === null && selectedTermName === "All Terms";
          if ((!selectedTermId || !stillValid) && !explicitAllTerms) {
            setSelectedTerm(data[0].id, data[0].name);
            onTermChange?.(data[0].id, data[0].name);
          }
        }
      })
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  const optionLabel = (t: TermRow) =>
    `${t.name} · ${formatShortDate(t.startDate)} – ${formatShortDate(t.endDate)}`;

  if (loading) {
    return (
      <div
        className="admin-skeleton shimmer"
        style={{ width: 200, height: 36, borderRadius: 8, display: "inline-block", ...style }}
      />
    );
  }

  if (readOnly) {
    const current = terms.find((t) => t.id === selectedTermId);
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.875rem",
          color: "var(--gray-600, #475569)",
          fontWeight: 500,
          ...style,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {current ? optionLabel(current) : selectedTermName ?? "No term selected"}
      </span>
    );
  }

  if (terms.length === 0) {
    return (
      <Select
        disabled
        className={className}
        style={{
          padding: "0.45rem 1.15rem",
          borderRadius: "9999px",
          border: "1.5px solid var(--gray-200, #e2e8f0)",
          background: "var(--gray-50, #f8fafc)",
          color: "var(--gray-400, #94a3b8)",
          fontSize: "0.85rem",
          minWidth: "160px",
          ...style,
        }}
      >
        <option>No terms available</option>
      </Select>
    );
  }

  return (
    <Select
      value={selectedTermId ?? "__all__"}
      onChange={(e) => {
        if (e.target.value === "__all__") {
          setSelectedTerm(null, "All Terms");
          onTermChange?.(null, "All Terms");
          return;
        }
        const term = terms.find((t) => t.id === e.target.value);
        if (term) {
          setSelectedTerm(term.id, term.name);
          onTermChange?.(term.id, term.name);
        }
      }}
      className={className}
      style={{
        padding: "0.45rem 1.15rem",
        borderRadius: "9999px",
        border: "1.5px solid var(--primary-200)",
        background: "var(--primary-50)",
        color: "var(--primary-800)",
        fontWeight: 600,
        fontSize: "0.85rem",
        cursor: "pointer",
        minWidth: "160px",
        ...style,
      }}
      dropdownMinWidth="240px"
    >
      <option value="__all__">All Terms</option>
      {terms.map((t) => (
        <option key={t.id} value={t.id}>
          {optionLabel(t)}
        </option>
      ))}
    </Select>
  );
}
