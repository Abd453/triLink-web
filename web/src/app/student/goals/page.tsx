"use client";
import { Sparkles } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Goals"
            description="Set and track your personal academic goals."
            icon={<Sparkles size={22} />}
        />
    );
}
