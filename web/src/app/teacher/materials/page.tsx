"use client";
import { FolderOpen } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Learning materials"
            description="Upload notes, slides, and reference files for your classes."
            icon={<FolderOpen size={22} />}
        />
    );
}
