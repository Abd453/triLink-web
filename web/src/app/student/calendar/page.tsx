"use client";
import { CalendarDays } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Calendar"
            description="Exams, assignment due dates, and school events."
            icon={<CalendarDays size={22} />}
        />
    );
}
