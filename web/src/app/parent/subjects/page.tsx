"use client";
import { BookOpen } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Subjects"
            description="Subjects your child is taking and how they're doing."
            icon={<BookOpen size={22} />}
        />
    );
}
