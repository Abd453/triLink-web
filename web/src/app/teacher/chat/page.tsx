"use client";

import RestChat from "@/components/RestChat";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TeacherChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHomeroom = searchParams?.get("from") === "homeroom";

  return (
    <div className="page-wrapper">
      {fromHomeroom && (
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={() => router.push("/teacher/homeroom")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#fff",
              border: "1.5px solid var(--gray-150)",
              borderRadius: "12px",
              padding: "0.55rem 1.15rem",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              color: "var(--gray-800)",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--primary-300)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(37, 99, 235, 0.08)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--gray-150)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <ArrowLeft size={14} strokeWidth={3} style={{ color: "var(--primary-600)" }} />
            <span>Back to Homeroom</span>
          </button>
        </div>
      )}
      <RestChat role="teacher" />
    </div>
  );
}
