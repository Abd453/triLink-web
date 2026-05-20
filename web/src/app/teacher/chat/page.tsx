"use client";

import RestChat from "@/components/RestChat";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TeacherChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHomeroom = searchParams?.get("from") === "homeroom";

  return (
    <div className="chat-page-wrapper">
      {fromHomeroom && (
        <div className="chat-back-row">
          <button
            type="button"
            className="chat-back-btn"
            onClick={() => router.push("/teacher/homeroom")}
          >
            <ArrowLeft size={14} strokeWidth={3} />
            <span>Back to Homeroom</span>
          </button>
        </div>
      )}
      <RestChat role="teacher" />
    </div>
  );
}
