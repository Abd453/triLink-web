"use client";
import { Library } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Textbooks"
            description="Manage the school textbook library — upload, tag, and assign."
            icon={<Library size={22} />}
        />
    );
}
