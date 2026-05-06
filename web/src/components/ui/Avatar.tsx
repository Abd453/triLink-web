"use client";
import { useState } from "react";
import { getFileUrl } from "@/lib/api";

interface AvatarProps {
    initials: string;
    name?: string;
    fileId?: string | null;
    size?: number;
    rounded?: "full" | "md";
}

export function Avatar({ initials, name, fileId, size = 40, rounded = "full" }: AvatarProps) {
    const [errored, setErrored] = useState(false);
    const url = fileId ? getFileUrl(fileId) : "";
    const showImage = !!url && !errored;
    const radius = rounded === "full" ? "9999px" : "10px";
    const fontSize = Math.max(10, Math.round(size * 0.4));

    return (
        <div
            className="ui-avatar"
            style={{ width: size, height: size, borderRadius: radius, fontSize }}
            aria-label={name || "User avatar"}
            role="img"
        >
            {showImage ? (
                <img
                    src={url}
                    alt={name || "Avatar"}
                    onError={() => setErrored(true)}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius }}
                />
            ) : (
                <span aria-hidden>{initials}</span>
            )}
        </div>
    );
}
