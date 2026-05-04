"use client";
import { Award } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Achievements"
            description="Badges, honors, and milestones you've unlocked."
            icon={<Award size={22} />}
        />
    );
}
