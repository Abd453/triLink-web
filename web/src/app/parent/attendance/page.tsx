"use client";
import { ClipboardCheck } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Attendance"
            description="Daily attendance and absence history."
            icon={<ClipboardCheck size={22} />}
        />
    );
}
