"use client";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    ghost: "btn-ghost",
    danger: "btn-danger",
    success: "btn-success",
};

const sizeClass: Record<Size, string> = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "primary", size = "md", loading, leftIcon, rightIcon, fullWidth, children, className = "", disabled, ...rest },
    ref,
) {
    const cls = [
        "btn",
        variantClass[variant],
        sizeClass[size],
        fullWidth ? "btn-full" : "",
        className,
    ].filter(Boolean).join(" ");

    return (
        <button ref={ref} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
            {loading ? <Spinner size={size === "lg" ? 18 : 14} /> : leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
});

function Spinner({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animation: "spin 0.8s linear infinite" }}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
