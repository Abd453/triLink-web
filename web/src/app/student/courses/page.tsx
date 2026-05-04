"use client";
import { BookOpen } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="My courses"
            description="Subjects you're enrolled in, with teachers and schedule."
            icon={<BookOpen size={22} />}
        />
    );
}
