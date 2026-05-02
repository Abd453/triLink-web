import { useState, useEffect } from "react";
import { chatRealtime } from "@/lib/chat-realtime";

export type ToastType = 'chat' | 'announcement' | 'notification' | 'error';

export interface ToastState {
    msg: string;
    ok: boolean;
    type?: ToastType;
}

export function useRealtimeNotifications(userId?: string, userName?: string) {
    const [toast, setToast] = useState<ToastState | null>(null);

    useEffect(() => {
        if (!userId) return;

        const showToast = (msg: string, type: ToastType = 'notification') => {
            setToast({ msg, ok: true, type });
            setTimeout(() => setToast(null), 5000);
        };

        chatRealtime.connect({ id: userId, name: userName || "User" });

        const unsubMsg = chatRealtime.on("message:new", (payload) => {
            showToast(`New message in chat: "${payload.message.text.slice(0, 30)}${payload.message.text.length > 30 ? '...' : ''}"`, 'chat');
        });

        const unsubNotif = chatRealtime.on("notification:new", (payload) => {
            showToast(`${payload.title || 'Alert'}: ${(payload.body || '').slice(0, 40)}...`, 'notification');
        });

        const unsubAnnounce = chatRealtime.on("announcement:new", (payload) => {
            showToast(`New Announcement: ${payload.title || 'See Dashboard'}`, 'announcement');
        });

        const unsubError = chatRealtime.on("connection:error", (payload) => {
             // Silence connection errors from auto-toasts to avoid annoyance, 
             // but could be used for debugging.
             console.error("Realtime connection error:", payload.message);
        });

        return () => {
            unsubMsg();
            unsubNotif();
            unsubAnnounce();
            unsubError();
        };
    }, [userId, userName]);

    return { toast, setToast };
}
