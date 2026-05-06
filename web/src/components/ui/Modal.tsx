"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    closeOnBackdrop?: boolean;
}

const sizeWidth = { sm: 420, md: 560, lg: 760, xl: 960 } as const;

export function Modal({ open, onClose, title, description, children, footer, size = "md", closeOnBackdrop = true }: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="ui-modal-backdrop"
            onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-modal-title"
        >
            <div className="ui-modal" style={{ maxWidth: sizeWidth[size] }}>
                <header className="ui-modal-header">
                    <div>
                        <h2 id="ui-modal-title" className="ui-modal-title">{title}</h2>
                        {description ? <p className="ui-modal-description">{description}</p> : null}
                    </div>
                    <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </header>
                <div className="ui-modal-body">{children}</div>
                {footer ? <footer className="ui-modal-footer">{footer}</footer> : null}
            </div>
        </div>
    );
}
