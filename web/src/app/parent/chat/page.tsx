"use client";

import RestChat from "@/components/RestChat";

export default function ParentChat() {
  return (
    <div className="page-wrapper">
      <RestChat role="parent" />
    </div>
  );
}
