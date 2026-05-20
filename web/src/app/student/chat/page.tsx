"use client";

import RestChat from "@/components/RestChat";

export default function StudentChat() {
  return (
    <div className="chat-page-wrapper">
      <RestChat role="student" />
    </div>
  );
}
