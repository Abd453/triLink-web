"use client";
import { Users } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Teachers"
            description="Teachers your child has, with contact info."
            icon={<Users size={22} />}
        />
    );
}
