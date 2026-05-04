"use client";
import React, { useState, useRef, useEffect, ReactNode, ChangeEvent } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export default function Select({ children, value, onChange, disabled, style, className, id }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  const options: { value: string; label: ReactNode; disabled?: boolean }[] = [];

  type OptionLikeProps = { value?: unknown; children?: ReactNode; disabled?: boolean };

  // Recursively extract <option> children, drilling through Fragments/arrays.
  function extractOptions(node: ReactNode) {
    React.Children.forEach(node, (child) => {
      if (Array.isArray(child)) {
        child.forEach(extractOptions);
        return;
      }
      if (!React.isValidElement(child)) return;
      const props = child.props as OptionLikeProps;
      if (child.type === "option") {
        const val = props.value ?? props.children;
        options.push({
          value: String(val),
          label: props.children,
          disabled: props.disabled,
        });
      } else if (props.children) {
        extractOptions(props.children);
      }
    });
  }

  extractOptions(children);

  const selectedOption = options.find((o) => o.value === String(value));

  const handleSelect = (val: string) => {
    if (onChange) {
      const e = {
        target: { value: val },
        currentTarget: { value: val },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as ChangeEvent<HTMLSelectElement>;
      onChange(e);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", height: "100%", padding: "0", background: "none", border: "none",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontFamily: "inherit", fontWeight: "inherit", cursor: disabled ? "not-allowed" : "pointer",
          outline: "none", color: "inherit", textAlign: "left"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption ? selectedOption.label : "Select..."}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", marginLeft: 8, flexShrink: 0 }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--gray-200)",
          borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          maxHeight: "320px", overflowY: "auto", zIndex: 99999,
          padding: "0.4rem", display: "flex", flexDirection: "column", gap: "2px",
          minWidth: "120px"
        }}>
          {options.length === 0 ? (
            <div style={{ padding: "0.6rem 1rem", color: "var(--gray-500)", fontSize: "0.9rem" }}>No options</div>
          ) : (
            options.map((opt, i) => {
              const isSelected = String(value) === String(opt.value);
              return (
                <button
                  key={`${opt.value}-${i}`}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    width: "100%", padding: "0.5rem 0.8rem", textAlign: "left",
                    background: isSelected ? "var(--primary-50)" : "transparent",
                    color: isSelected ? "var(--primary-700)" : "var(--gray-800)",
                    border: "none", borderRadius: "10px",
                    cursor: opt.disabled ? "not-allowed" : "pointer",
                    fontSize: "0.9rem", fontWeight: isSelected ? 600 : 500,
                    display: "block", outline: "none",
                    transition: "all 0.15s ease"
                  }}
                  onMouseOver={(e) => {
                    if(!opt.disabled && !isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--gray-50)";
                  }}
                  onMouseOut={(e) => {
                    if(!opt.disabled && !isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {opt.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
