"use client";
import { MessageCircleHeart } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function Page() {
    return (
        <ComingSoon
            title="Feedback"
            description="Share feedback with the school."
            icon={<MessageCircleHeart size={22} />}
        />
    );
}
