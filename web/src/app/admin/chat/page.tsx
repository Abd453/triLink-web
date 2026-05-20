"use client";

import RestChat from "@/components/RestChat";

export default function AdminChat() {
  return (
    <div className="chat-page-wrapper">
      <RestChat role="admin" />
    </div>
  );
}
