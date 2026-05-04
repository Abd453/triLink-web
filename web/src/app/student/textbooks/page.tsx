"use client";
import { Library } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Textbooks"
            description="Books for your grade and subjects — read and download."
            icon={<Library size={22} />}
        />
    );
}
