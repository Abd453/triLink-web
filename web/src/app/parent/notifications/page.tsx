"use client";
import { Bell } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Notifications"
            description="Updates about your child and the school."
            icon={<Bell size={22} />}
        />
    );
}
