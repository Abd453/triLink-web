"use client";
import { FolderOpen } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Learning materials"
            description="Notes, slides, and reference files shared by your teachers."
            icon={<FolderOpen size={22} />}
        />
    );
}
