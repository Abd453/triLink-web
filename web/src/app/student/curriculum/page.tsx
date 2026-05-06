"use client";
import { ListChecks } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Curriculum"
            description="Topics, units, and what's coming up next per subject."
            icon={<ListChecks size={22} />}
        />
    );
}
