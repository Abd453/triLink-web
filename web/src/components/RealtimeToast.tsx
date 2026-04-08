"use client";
import { ToastState } from "@/hooks/useRealtimeNotifications";

interface RealtimeToastProps {
    toast: any;
    onClose: () => void;
}

export default function RealtimeToast({ toast, onClose }: RealtimeToastProps) {
    if (!toast) return null;

    const isSuccess = toast.ok === true || (!toast.type && !toast.ok);
    const isError = toast.ok === false;

    // Determine colors/icons based on type or success status
    let iconColor = "var(--primary-600)";
    let bgColor = "var(--primary-50)";
    let icon = (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    );

    if (isError) {
        iconColor = "var(--danger)";
        bgColor = "var(--danger-light)";
        icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    } else if (isSuccess) {
        iconColor = "var(--success)";
        bgColor = "var(--success-light)";
        icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
    }

    if (toast.type === 'chat') {
        iconColor = "var(--primary-600)";
        bgColor = "var(--primary-50)";
        icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    } else if (toast.type === 'announcement') {
        iconColor = "#b45309";
        bgColor = "#fef3c7";
        icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    }

    return (
        <div style={{
            position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 9999,
            padding: "0.875rem 1.125rem", borderRadius: "14px", background: "#fff",
            boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 0 0 1.5px rgba(0,0,0,0.02)", 
            border: `1.5px solid ${isError ? '#fee2e2' : isSuccess ? '#dcfce7' : 'var(--gray-100)'}`,
            display: "flex", alignItems: "center", gap: "0.85rem", minWidth: "320px",
            animation: "toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }}>
            <div style={{
                width: 38, height: 38, borderRadius: "10px",
                background: bgColor, color: iconColor,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.3 }}>
                    {toast.msg}
                </div>
                {(toast.type || toast.ok !== undefined) && (
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, color: isError ? "var(--danger)" : "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "0.15rem" }}>
                        {isError ? "Error" : isSuccess ? "Success" : toast.type}
                    </div>
                )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-300)", padding: "0.4rem", borderRadius: "8px", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--gray-500)"} onMouseLeave={e => e.currentTarget.style.color = "var(--gray-300)"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <style jsx>{`
                @keyframes toast-slide-in {
                    from { transform: translateX(110%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
