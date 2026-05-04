"use client";
import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
    leftIcon?: ReactNode;
    rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, hint, error, leftIcon, rightAddon, id, ...rest },
    ref,
) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <div className="ui-field">
            {label ? <label htmlFor={inputId} className="ui-label">{label}</label> : null}
            <div className={`ui-input-wrap${error ? " ui-input-wrap-error" : ""}`}>
                {leftIcon ? <span className="ui-input-leading" aria-hidden>{leftIcon}</span> : null}
                <input ref={ref} id={inputId} className="ui-input" aria-invalid={!!error || undefined} aria-describedby={hint || error ? `${inputId}-hint` : undefined} {...rest} />
                {rightAddon ? <span className="ui-input-trailing">{rightAddon}</span> : null}
            </div>
            {(hint || error) ? (
                <p id={`${inputId}-hint`} className={`ui-help${error ? " ui-help-error" : ""}`}>
                    {error || hint}
                </p>
            ) : null}
        </div>
    );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, hint, error, id, ...rest },
    ref,
) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <div className="ui-field">
            {label ? <label htmlFor={inputId} className="ui-label">{label}</label> : null}
            <div className={`ui-input-wrap${error ? " ui-input-wrap-error" : ""}`}>
                <textarea ref={ref} id={inputId} className="ui-input ui-textarea" aria-invalid={!!error || undefined} aria-describedby={hint || error ? `${inputId}-hint` : undefined} {...rest} />
            </div>
            {(hint || error) ? (
                <p id={`${inputId}-hint`} className={`ui-help${error ? " ui-help-error" : ""}`}>
                    {error || hint}
                </p>
            ) : null}
        </div>
    );
});
