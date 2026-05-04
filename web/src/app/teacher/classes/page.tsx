"use client";
import { GraduationCap } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="My classes"
            description="Sections you teach, with rosters and quick actions."
            icon={<GraduationCap size={22} />}
        />
    );
}
