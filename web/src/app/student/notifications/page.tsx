"use client";
import { Bell } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Notifications"
            description="System alerts and chat pings."
            icon={<Bell size={22} />}
        />
    );
}
