"use client";
import Select from "./Select";


interface TablePaginationProps {
  total: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
}

export default function TablePagination({
  total,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const startIdx = currentPage * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);

  return (
    <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "flex-end", 
        gap: "1.5rem", 
        padding: "1.25rem 1.5rem", 
        borderTop: "1px solid var(--gray-100)", 
        fontSize: "0.875rem", 
        color: "var(--gray-600)",
        background: "var(--gray-50)",
        borderBottomLeftRadius: "16px",
        borderBottomRightRadius: "16px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <span style={{ fontWeight: 500 }}>Rows per page:</span>
        <Select
          direction="up"
          dropdownMinWidth="100%"
          optionTextAlign="center"
          optionPadding="0.35rem 0.5rem"
          value={rowsPerPage}
          onChange={(e) => {
            onRowsPerPageChange(Number(e.target.value));
          }}
          style={{ 
            border: "1px solid var(--primary-200)", 
            background: "var(--primary-50)", 
            color: "var(--primary-800)", 
            fontWeight: 600, 
            padding: "0.25rem 0.65rem", 
            borderRadius: "20px",
            fontSize: "0.85rem",
            minWidth: "65px"
          }}
        >
          {[5, 10, 25, 50].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
      </div>
      
      <div style={{ fontWeight: 600, color: "var(--gray-500)", minWidth: "80px", textAlign: "center" }}>
        {total === 0 ? "0-0 of 0" : `${startIdx + 1}–${endIdx} of ${total}`}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={currentPage === 0}
          title="Previous Page"
          style={{ 
            background: "white", 
            border: "1px solid var(--gray-200)", 
            cursor: currentPage === 0 ? "not-allowed" : "pointer", 
            opacity: currentPage === 0 ? 0.4 : 1, 
            padding: "0.4rem", 
            borderRadius: "8px",
            display: "flex", 
            alignItems: "center", 
            color: "var(--gray-700)",
            transition: "all 0.2s"
          }}
          onMouseOver={e => currentPage !== 0 && (e.currentTarget.style.background = "var(--gray-50)")}
          onMouseOut={e => (e.currentTarget.style.background = "white")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={endIdx >= total}
          title="Next Page"
          style={{ 
            background: "white", 
            border: "1px solid var(--gray-200)", 
            cursor: endIdx >= total ? "not-allowed" : "pointer", 
            opacity: endIdx >= total ? 0.4 : 1, 
            padding: "0.4rem", 
            borderRadius: "8px",
            display: "flex", 
            alignItems: "center", 
            color: "var(--gray-700)",
            transition: "all 0.2s"
          }}
          onMouseOver={e => endIdx < total && (e.currentTarget.style.background = "var(--gray-50)")}
          onMouseOut={e => (e.currentTarget.style.background = "white")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
