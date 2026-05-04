"use client";
import { Megaphone } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Announcements"
            description="School-wide and class-level announcements."
            icon={<Megaphone size={22} />}
        />
    );
}
