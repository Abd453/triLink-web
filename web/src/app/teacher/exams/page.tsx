"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import RealtimeToast from "@/components/RealtimeToast";
import TablePagination from "@/components/TablePagination";
import TermSelector from "@/components/TermSelector";
import { type ToastState } from "@/hooks/useRealtimeNotifications";

import {
    getActiveAcademicYear,
    listMyClassOfferings,
    listExams as apiListExams,
    createExam as apiCreateExam,
    publishExam as apiPublishExam,
    createQuestion as apiCreateQuestion,
    addQuestionsToExam,
    updateExamMaxPoints,
    listQuestions,
    listExamAttempts,
    gradeAttempt as apiGradeAttempt,
    releaseAttempt as apiReleaseAttempt,
    getViolations,
    getExamStudentRoster,
    type ClassOffering,
    type Exam as ApiExam,
    type ExamRosterStudent,
    type Violation,
} from "@/lib/admin-api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createPortal } from "react-dom";
import ExamMonitor from "@/components/ExamMonitor";
import Select from "@/components/Select";
import { refreshStoredProfile } from "@/lib/auth";
import { useCurrentUser } from "@/lib/useCurrentUser";


/* ─── Natural notation → LaTeX (so teachers don't need to know LaTeX syntax) ─── */
function preprocess(tex: string): string {
    let out = tex;
    // sqrt(expr) → \sqrt{expr}
    out = out.replace(/\bsqrt\s*\(([^)]+)\)/g, '\\sqrt{$1}');
    // (a)/(b) → \frac{a}{b}  (parenthesized fractions)
    out = out.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
    // Greek letter words  (only plain words, not already \-prefixed)
    const greek: [RegExp, string][] = [
        [/(?<!\\)\balpha\b/g,'\\alpha'],  [/(?<!\\)\bbeta\b/g,'\\beta'],
        [/(?<!\\)\bgamma\b/g,'\\gamma'],  [/(?<!\\)\bdelta\b/g,'\\delta'],
        [/(?<!\\)\btheta\b/g,'\\theta'],  [/(?<!\\)\blambda\b/g,'\\lambda'],
        [/(?<!\\)\bmu\b/g,'\\mu'],        [/(?<!\\)\bpi\b/g,'\\pi'],
        [/(?<!\\)\bsigma\b/g,'\\sigma'],  [/(?<!\\)\bphi\b/g,'\\phi'],
        [/(?<!\\)\bomega\b/g,'\\omega'],  [/(?<!\\)\bDelta\b/g,'\\Delta'],
        [/\binfinity\b/gi,'\\infty'],      [/(?<!\\)\binf\b/g,'\\infty'],
    ];
    for (const [re, rep] of greek) out = out.replace(re, rep);
    // Common shorthand operators
    out = out
        .replace(/(?<!\\)>=/g, '\\geq ')
        .replace(/(?<!\\)<=/g, '\\leq ')
        .replace(/(?<!\\)!=/g, '\\neq ')
        .replace(/(?<!\\)<->/g, '\\leftrightarrow ')
        .replace(/(?<!\\)->/g, '\\rightarrow ')
        .replace(/(?<![\\A-Za-z])\+-/g, '\\pm ');
    return out;
}

/* ─── Render LaTeX ─── */
function offeringLabel(o: ClassOffering) {
    return classOfferingLabel(o);
}

function normSub(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeLabelFromOffering(o: ClassOffering) {
    if (o.gradeName?.trim()) return o.gradeName.trim();
    const text = `${o.displayName || ""} ${o.name || ""}`;
    const match = text.match(/\b(?:grade\s*)?(\d{1,2})\b/i) ?? text.match(/\bG(\d{1,2})\b/i);
    return match ? `Grade ${match[1]}` : "";
}

function sectionLabelFromOffering(o: ClassOffering) {
    if (o.sectionName?.trim()) return o.sectionName.trim();
    const text = `${o.displayName || ""} ${o.name || ""}`;
    const match = text.match(/\b(?:grade\s*\d{1,2}\s*)?[-\/]?\s*([A-Z])\b/i) ?? text.match(/\bG\d{1,2}([A-Z])\b/i);
    return match ? match[1].toUpperCase() : "";
}

function subjectLabelFromOffering(o: ClassOffering) {
    return o.subjectName || (o as { subject?: { name?: string } }).subject?.name || "";
}

function classOfferingLabel(o?: ClassOffering | null) {
    if (!o) return "";
    const grade = gradeLabelFromOffering(o);
    const section = sectionLabelFromOffering(o);
    const subject = subjectLabelFromOffering(o);
    if (grade && section && subject) return `${grade} - ${section} | ${subject}`;
    if (grade && subject) return `${grade} | ${subject}`;
    if (grade && section) return `${grade} - ${section}`;
    if (section && subject) return `${section} | ${subject}`;
    if (subject) return subject;
    return o.displayName || o.name?.trim() || "Untitled Class";
}

import { filterOfferingsBySubject, subjectNameMatchesProfile } from "@/lib/teacher-utils";
import { useTermStore } from "@/store/termStore";
import { PageHeader, PageHeaderSkeleton, CardSkeleton } from "@/components/ui";
import { FileText } from "lucide-react";

type QuestionListRow = { subjectId: string; subject?: { name?: string } };

function allowedBankSubjectIds(offerings: ClassOffering[], profileSubject: string | undefined | null) {
    const scoped = filterOfferingsBySubject(offerings, profileSubject);
    return new Set(scoped.map((o) => o.subjectId).filter(Boolean));
}

function questionInTeacherSubjectBank(
    q: QuestionListRow,
    allowedSubjectIds: Set<string>,
    profileSubject: string | undefined | null,
) {
    if (allowedSubjectIds.size > 0 && allowedSubjectIds.has(q.subjectId)) return true;
    const qName = q.subject?.name ?? "";
    if (profileSubject?.trim() && subjectNameMatchesProfile(qName, profileSubject)) return true;
    return false;
}

function TeacherExamsSkeleton() {
    return (
        <div className="page-wrapper">
            <PageHeaderSkeleton />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "start" }}>
                <CardSkeleton lines={5} />
                <CardSkeleton lines={4} />
            </div>
        </div>
    );
}

function renderLatex(raw: string): string {
    if (!raw) return "";
    let out = raw.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex) => {
        try { return katex.renderToString(preprocess(tex.trim()), { displayMode: true, throwOnError: false }); }
        catch { return `<code>$$${tex}$$</code>`; }
    });
    out = out.replace(/\$([^\n$]+?)\$/g, (_m, tex) => {
        try { return katex.renderToString(preprocess(tex.trim()), { displayMode: false, throwOnError: false }); }
        catch { return `<code>$${tex}$</code>`; }
    });
    return out.replace(/\n/g, "<br />");
}

/* ─── Snippet data (pre-render KaTeX at module load for performance) ─── */
type Snippet = { display: string; insert: string; tip: string };

function preRender(items: Snippet[]) {
    return items.map(item => {
        let html = item.display;
        try { html = katex.renderToString(item.display, { displayMode: false, throwOnError: false }); } catch {}
        return { ...item, html };
    });
}

/* ─────────────────────────────────────────────────────────────
   ALL SUBJECT CONFIGS  - snippets, mini, tips, sidebar ref, placeholder
───────────────────────────────────────────────────────────── */
type RefItem = { name: string; input: string; tex: string; note: string };
type TipExample = { title: string; code: string; rendered: string; note: string };
type SubjectConfig = {
    icon: string;
    cats: { name: string; items: { display: string; insert: string; tip: string; html: string }[] }[];
    mini: { display: string; insert: string; tip: string; html: string }[];
    tips: TipExample[];
    ref: RefItem[];
    hintLine: string;
    placeholder: string;
};

function makeConfig(rawCats: { name: string; items: Snippet[] }[], rawMini: Snippet[], tips: TipExample[], ref: RefItem[], hintLine: string, placeholder: string, icon: string): SubjectConfig {
    return {
        icon,
        cats: rawCats.map(cat => ({ name: cat.name, items: preRender(cat.items) })),
        mini: preRender(rawMini),
        tips, ref, hintLine, placeholder,
    };
}

const SUBJECT_CONFIG: Record<string, SubjectConfig> = {

    /* ── MATHEMATICS ── */
    Mathematics: makeConfig(
        [
            { name: "Algebra", items: [
                { display: "\\frac{a}{b}", insert: "\\frac{a}{b}", tip: "Fraction - replace a and b" },
                { display: "\\sqrt{x}", insert: "\\sqrt{x}", tip: "Square root - replace x" },
                { display: "\\sqrt[3]{x}", insert: "\\sqrt[n]{x}", tip: "nth root - replace n and x" },
                { display: "x^{2}", insert: "x^{n}", tip: "Power - replace x and n" },
                { display: "x_{0}", insert: "x_{n}", tip: "Subscript - replace x and n" },
                { display: "\\log_{b}x", insert: "\\log_{b}(x)", tip: "Logarithm base b" },
                { display: "\\ln x", insert: "\\ln(x)", tip: "Natural logarithm" },
                { display: "|x|", insert: "|x|", tip: "Absolute value" },
            ]},
            { name: "Operators", items: [
                { display: "\\pm", insert: "\\pm", tip: "± Plus/Minus" },
                { display: "\\times", insert: "\\times", tip: "× Multiply" },
                { display: "\\div", insert: "\\div", tip: "÷ Divide" },
                { display: "\\neq", insert: "\\neq", tip: "≠ Not equal" },
                { display: "\\leq", insert: "\\leq", tip: "≤ Less or equal" },
                { display: "\\geq", insert: "\\geq", tip: "≥ Greater or equal" },
                { display: "\\approx", insert: "\\approx", tip: "≈ Approximately" },
                { display: "\\infty", insert: "\\infty", tip: "∞ Infinity" },
                { display: "\\therefore", insert: "\\therefore", tip: "∴ Therefore" },
                { display: "\\in", insert: "\\in", tip: "∈ Element of" },
            ]},
            { name: "Greek", items: [
                { display: "\\alpha", insert: "\\alpha", tip: "α Alpha" },
                { display: "\\beta", insert: "\\beta", tip: "β Beta" },
                { display: "\\gamma", insert: "\\gamma", tip: "γ Gamma" },
                { display: "\\delta", insert: "\\delta", tip: "δ Delta" },
                { display: "\\theta", insert: "\\theta", tip: "θ Theta" },
                { display: "\\lambda", insert: "\\lambda", tip: "λ Lambda" },
                { display: "\\mu", insert: "\\mu", tip: "μ Mu" },
                { display: "\\pi", insert: "\\pi", tip: "π Pi" },
                { display: "\\sigma", insert: "\\sigma", tip: "σ Sigma" },
                { display: "\\phi", insert: "\\phi", tip: "φ Phi" },
                { display: "\\omega", insert: "\\omega", tip: "ω Omega" },
                { display: "\\Delta", insert: "\\Delta", tip: "Δ Delta (capital)" },
            ]},
            { name: "Calculus", items: [
                { display: "\\int", insert: "\\int_{a}^{b} f(x)\\,dx", tip: "Definite integral" },
                { display: "\\frac{d}{dx}", insert: "\\frac{d}{dx}()", tip: "Derivative d/dx" },
                { display: "\\frac{dy}{dx}", insert: "\\frac{dy}{dx}", tip: "dy/dx notation" },
                { display: "\\lim_{x\\to0}", insert: "\\lim_{x \\to 0}", tip: "Limit" },
                { display: "\\sum", insert: "\\sum_{i=1}^{n}", tip: "Summation Σ" },
                { display: "\\partial", insert: "\\partial", tip: "∂ Partial derivative" },
            ]},
        ],
        [
            { display: "\\frac{a}{b}", insert: "\\frac{a}{b}", tip: "Fraction" },
            { display: "x^{2}", insert: "x^{n}", tip: "Power" },
            { display: "x_{0}", insert: "x_{n}", tip: "Subscript" },
            { display: "\\sqrt{x}", insert: "\\sqrt{x}", tip: "Square root" },
            { display: "\\pm", insert: "\\pm", tip: "±" },
            { display: "\\times", insert: "\\times", tip: "×" },
            { display: "\\pi", insert: "\\pi", tip: "π" },
            { display: "\\infty", insert: "\\infty", tip: "∞" },
            { display: "\\theta", insert: "\\theta", tip: "θ" },
        ],
        [
            { title: "① Surround math with $ signs", code: "Solve for $x = 5$", rendered: "x = 5", note: "Anything between $ $ becomes a formula" },
            { title: "② Fractions: (a)/(b)", code: "$(x+1)/(x-1)$", rendered: "\\frac{x+1}{x-1}", note: "Parenthesized fraction auto-converts" },
            { title: "③ Roots: sqrt( )", code: "$sqrt(x^2 + 4)$", rendered: "\\sqrt{x^2+4}", note: "Works for any expression" },
            { title: "④ Type greek letters", code: "$theta = pi/4$", rendered: "\\theta = \\frac{\\pi}{4}", note: "alpha, beta, gamma, delta, pi, theta…" },
        ],
        [
            { name: "(a)/(b)", input: "(a)/(b)", tex: "\\frac{a}{b}", note: "fraction" },
            { name: "sqrt(x)", input: "sqrt(x)", tex: "\\sqrt{x}", note: "square root" },
            { name: "x^{n}", input: "x^{n}", tex: "x^{n}", note: "exponent" },
            { name: "x_{n}", input: "x_{n}", tex: "x_{n}", note: "subscript" },
            { name: "pi", input: "pi", tex: "\\pi", note: "" },
            { name: "theta", input: "theta", tex: "\\theta", note: "" },
            { name: ">=  <=  !=", input: ">=", tex: "\\geq", note: "comparisons" },
            { name: "+-", input: "+-", tex: "\\pm", note: "" },
            { name: "infinity / inf", input: "inf", tex: "\\infty", note: "" },
        ],
        "Put math between $ dollar signs $ · Type (a)/(b) for fractions, sqrt(x), pi, theta, >= naturally",
        "Type question here…\n\nExample: Solve for $x$: $(x^2 - 4)/(x + 2) = 3$\n\nTip: write $(top)/(bottom)$ for fractions, sqrt(expr) for roots, and greek letters like theta, pi directly.",
        "∑"
    ),

    /* ── PHYSICS ── */
    Physics: makeConfig(
        [
            { name: "Mechanics", items: [
                { display: "\\vec{F}", insert: "\\vec{F}", tip: "Force vector" },
                { display: "\\vec{v}", insert: "\\vec{v}", tip: "Velocity vector" },
                { display: "\\vec{a}", insert: "\\vec{a}", tip: "Acceleration vector" },
                { display: "\\frac{a}{b}", insert: "\\frac{a}{b}", tip: "Fraction - replace a and b" },
                { display: "x^{2}", insert: "x^{n}", tip: "Power - replace x and n" },
                { display: "\\Delta x", insert: "\\Delta x", tip: "Δx Change in x" },
                { display: "\\mu", insert: "\\mu", tip: "μ Friction coefficient" },
                { display: "\\omega", insert: "\\omega", tip: "ω Angular velocity" },
            ]},
            { name: "Energy", items: [
                { display: "E = mc^2", insert: "E = mc^{2}", tip: "Mass-energy equivalence" },
                { display: "\\frac{1}{2}mv^2", insert: "\\frac{1}{2}mv^{2}", tip: "Kinetic energy" },
                { display: "mgh", insert: "mgh", tip: "Gravitational PE" },
                { display: "P = (W)/(t)", insert: "P = \\frac{W}{t}", tip: "Power = Work/time" },
                { display: "W = Fd\\cos\\theta", insert: "W = Fd\\cos\\theta", tip: "Work formula" },
            ]},
            { name: "Waves & EM", items: [
                { display: "\\lambda", insert: "\\lambda", tip: "λ Wavelength" },
                { display: "\\nu", insert: "\\nu", tip: "ν Frequency" },
                { display: "c = \\lambda\\nu", insert: "c = \\lambda\\nu", tip: "Speed of light" },
                { display: "\\varepsilon_0", insert: "\\varepsilon_0", tip: "ε₀ Permittivity" },
                { display: "\\mu_0", insert: "\\mu_0", tip: "μ₀ Permeability" },
                { display: "\\vec{E}", insert: "\\vec{E}", tip: "Electric field vector" },
                { display: "\\vec{B}", insert: "\\vec{B}", tip: "Magnetic field vector" },
            ]},
            { name: "Units", items: [
                { display: "\\text{m/s}", insert: "\\text{m/s}", tip: "Metres per second" },
                { display: "\\text{m/s}^2", insert: "\\text{m/s}^{2}", tip: "Acceleration unit" },
                { display: "\\text{kg}", insert: "\\text{kg}", tip: "Kilograms" },
                { display: "\\text{N}", insert: "\\text{N}", tip: "Newtons" },
                { display: "\\text{J}", insert: "\\text{J}", tip: "Joules" },
                { display: "\\text{W}", insert: "\\text{W}", tip: "Watts" },
                { display: "\\text{Pa}", insert: "\\text{Pa}", tip: "Pascals" },
            ]},
        ],
        [
            { display: "\\frac{a}{b}", insert: "\\frac{a}{b}", tip: "Fraction" },
            { display: "\\vec{F}", insert: "\\vec{F}", tip: "Vector" },
            { display: "x^{2}", insert: "x^{n}", tip: "Power" },
            { display: "\\Delta x", insert: "\\Delta x", tip: "Change in x" },
            { display: "\\mu", insert: "\\mu", tip: "μ" },
            { display: "\\omega", insert: "\\omega", tip: "ω" },
            { display: "\\lambda", insert: "\\lambda", tip: "λ" },
            { display: "\\text{m/s}", insert: "\\text{m/s}", tip: "m/s" },
            { display: "\\pm", insert: "\\pm", tip: "±" },
        ],
        [
            { title: "① Wrap quantities in $ signs", code: "Mass $m = 2$ kg, force $F = 10$ N", rendered: "F = 10", note: "Isolate the math - leave units outside or use \\text{}" },
            { title: "② Fractions for formulas", code: "$v = (d)/(t)$", rendered: "\\frac{d}{t}", note: "Type (numerator)/(denominator)" },
            { title: "③ Vectors: vec( )", code: "$\\vec{F} = m\\vec{a}$", rendered: "\\vec{F} = m\\vec{a}", note: "Use \\vec{} for vector notation" },
            { title: "④ Units: use \\text{}", code: "$a = 9.8\\,\\text{m/s}^2$", rendered: "9.8\\,\\text{m/s}^{2}", note: "\\text{} keeps units upright" },
        ],
        [
            { name: "(d)/(t)", input: "(d)/(t)", tex: "\\frac{d}{t}", note: "fraction / formula" },
            { name: "\\vec{F}", input: "\\vec{F}", tex: "\\vec{F}", note: "force vector" },
            { name: "\\Delta x", input: "\\Delta x", tex: "\\Delta x", note: "change" },
            { name: "x^{2}", input: "x^{2}", tex: "x^{2}", note: "squared" },
            { name: "\\text{m/s}^2", input: "\\text{m/s}^2", tex: "\\text{m/s}^{2}", note: "unit" },
            { name: "->", input: "->", tex: "\\rightarrow", note: "direction" },
            { name: ">=  <=", input: ">=", tex: "\\geq", note: "inequality" },
            { name: "+-", input: "+-", tex: "\\pm", note: "" },
        ],
        "Wrap quantities in $ signs $ · Type (a)/(b) for fractions, \\vec{F} for vectors, \\text{m/s} for units",
        "Type question here…\n\nExample: An object of mass $m = 2\\,\\text{kg}$ accelerates at $a = 5\\,\\text{m/s}^2$.\nFind the net force $F$.\n\nTip: use $F = ma$, type -> for arrows, >= for ≥",
        "⚡"
    ),

    /* ── CHEMISTRY ── */
    Chemistry: makeConfig(
        [
            { name: "Reactions", items: [
                { display: "\\rightarrow", insert: "\\rightarrow", tip: "→ Reaction arrow" },
                { display: "\\rightleftharpoons", insert: "\\rightleftharpoons", tip: "⇌ Equilibrium" },
                { display: "\\overset{\\Delta}{\\rightarrow}", insert: "\\overset{\\Delta}{\\rightarrow}", tip: "→ Heat above arrow" },
                { display: "\\uparrow", insert: "\\uparrow", tip: "↑ Gas produced" },
                { display: "\\downarrow", insert: "\\downarrow", tip: "↓ Precipitate" },
            ]},
            { name: "Compounds", items: [
                { display: "\\text{H}_2\\text{O}", insert: "\\text{H}_2\\text{O}", tip: "H₂O Water" },
                { display: "\\text{CO}_2", insert: "\\text{CO}_2", tip: "CO₂" },
                { display: "\\text{O}_2", insert: "\\text{O}_2", tip: "O₂ Oxygen" },
                { display: "\\text{H}_2", insert: "\\text{H}_2", tip: "H₂ Hydrogen" },
                { display: "\\text{NaCl}", insert: "\\text{NaCl}", tip: "NaCl Salt" },
                { display: "\\text{H}_2\\text{SO}_4", insert: "\\text{H}_2\\text{SO}_4", tip: "H₂SO₄ Sulfuric acid" },
                { display: "\\text{HCl}", insert: "\\text{HCl}", tip: "HCl Hydrochloric acid" },
                { display: "\\text{NH}_3", insert: "\\text{NH}_3", tip: "NH₃ Ammonia" },
            ]},
            { name: "Charges", items: [
                { display: "^{+}", insert: "^{+}", tip: "⁺ Positive charge" },
                { display: "^{-}", insert: "^{-}", tip: "⁻ Negative charge" },
                { display: "^{2+}", insert: "^{2+}", tip: "²⁺ 2+ charge" },
                { display: "^{2-}", insert: "^{2-}", tip: "²⁻ 2− charge" },
                { display: "\\text{Ca}^{2+}", insert: "\\text{Ca}^{2+}", tip: "Ca²⁺ Calcium ion" },
                { display: "\\text{Cl}^{-}", insert: "\\text{Cl}^{-}", tip: "Cl⁻ Chloride ion" },
            ]},
            { name: "Quantities", items: [
                { display: "\\text{mol}", insert: "\\text{mol}", tip: "mol - amount" },
                { display: "\\text{g/mol}", insert: "\\text{g/mol}", tip: "Molar mass unit" },
                { display: "\\text{mol/L}", insert: "\\text{mol/L}", tip: "Concentration" },
                { display: "K_{eq}", insert: "K_{eq}", tip: "Equilibrium constant" },
                { display: "\\Delta H", insert: "\\Delta H", tip: "ΔH Enthalpy" },
                { display: "\\Delta G", insert: "\\Delta G", tip: "ΔG Gibbs energy" },
                { display: "\\Delta S", insert: "\\Delta S", tip: "ΔS Entropy" },
            ]},
        ],
        [
            { display: "\\rightarrow", insert: "\\rightarrow", tip: "→ reaction" },
            { display: "\\rightleftharpoons", insert: "\\rightleftharpoons", tip: "⇌ equilibrium" },
            { display: "^{+}", insert: "^{+}", tip: "⁺ charge" },
            { display: "^{-}", insert: "^{-}", tip: "⁻ charge" },
            { display: "\\text{H}_2\\text{O}", insert: "\\text{H}_2\\text{O}", tip: "H₂O" },
            { display: "\\Delta H", insert: "\\Delta H", tip: "ΔH" },
            { display: "\\uparrow", insert: "\\uparrow", tip: "↑ gas" },
            { display: "\\downarrow", insert: "\\downarrow", tip: "↓ precipitate" },
            { display: "\\text{mol}", insert: "\\text{mol}", tip: "mol" },
        ],
        [
            { title: "① Write compounds in $ signs", code: "$\\text{H}_2\\text{O}$", rendered: "\\text{H}_2\\text{O}", note: "Use \\text{} for element symbols, _ for subscripts" },
            { title: "② Reaction arrow: ->", code: "$\\text{H}_2 + \\text{O}_2 -> \\text{H}_2\\text{O}$", rendered: "\\text{H}_2 + \\text{O}_2 \\rightarrow \\text{H}_2\\text{O}", note: "Type -> for →, use equilibrium button for ⇌" },
            { title: "③ Ions and charges: ^{+}", code: "$\\text{Ca}^{2+}$, $\\text{Cl}^{-}$", rendered: "\\text{Ca}^{2+}", note: "Use ^{2+} or ^{-} after the element symbol" },
            { title: "④ Thermodynamic symbols", code: "$\\Delta H = -286\\,\\text{kJ/mol}$", rendered: "\\Delta H = -286\\,\\text{kJ/mol}", note: "Delta H, Delta G, Delta S from the Quantities tab" },
        ],
        [
            { name: "->", input: "->", tex: "\\rightarrow", note: "reaction arrow" },
            { name: "subscript: _{2}", input: "\\text{H}_{2}", tex: "\\text{H}_{2}", note: "atoms" },
            { name: "charge: ^{+}", input: "^{+}", tex: "^{+}", note: "ion charge" },
            { name: "\\Delta H", input: "\\Delta H", tex: "\\Delta H", note: "enthalpy" },
            { name: "\\Delta G", input: "\\Delta G", tex: "\\Delta G", note: "Gibbs" },
            { name: "K_{eq}", input: "K_{eq}", tex: "K_{eq}", note: "equilibrium constant" },
            { name: "\\uparrow  \\downarrow", input: "\\uparrow", tex: "\\uparrow", note: "gas / precipitate" },
        ],
        "Write compounds in $ signs $ · Type -> for →, use element buttons in Compounds tab · ^{+} for charges",
        "Type question here…\n\nExample: Balance the equation:\n$\\text{C}_3\\text{H}_8 + \\text{O}_2 -> \\text{CO}_2 + \\text{H}_2\\text{O}$\n\nTip: type -> for reaction arrow, use _ for subscripts: $\\text{H}_2\\text{O}$",
        "⚗"
    ),

    /* ── BIOLOGY ── */
    Biology: makeConfig(
        [
            { name: "Notation", items: [
                { display: "\\text{ATP}", insert: "\\text{ATP}", tip: "ATP" },
                { display: "\\text{DNA}", insert: "\\text{DNA}", tip: "DNA" },
                { display: "\\text{RNA}", insert: "\\text{RNA}", tip: "RNA" },
                { display: "\\text{CO}_2", insert: "\\text{CO}_2", tip: "CO₂" },
                { display: "\\text{O}_2", insert: "\\text{O}_2", tip: "O₂" },
                { display: "\\text{H}_2\\text{O}", insert: "\\text{H}_2\\text{O}", tip: "H₂O" },
                { display: "\\text{C}_6\\text{H}_{12}\\text{O}_6", insert: "\\text{C}_6\\text{H}_{12}\\text{O}_6", tip: "Glucose" },
            ]},
            { name: "Genetics", items: [
                { display: "\\text{AA}", insert: "\\text{AA}", tip: "Homozygous dominant" },
                { display: "\\text{Aa}", insert: "\\text{Aa}", tip: "Heterozygous" },
                { display: "\\text{aa}", insert: "\\text{aa}", tip: "Homozygous recessive" },
                { display: "\\text{P}_1", insert: "\\text{P}_1", tip: "Parental generation" },
                { display: "\\text{F}_1", insert: "\\text{F}_1", tip: "First filial generation" },
                { display: "\\text{F}_2", insert: "\\text{F}_2", tip: "Second filial generation" },
                { display: "3:1", insert: "3:1", tip: "3:1 ratio" },
            ]},
            { name: "Process", items: [
                { display: "\\rightarrow", insert: "\\rightarrow", tip: "→ leads to" },
                { display: "\\uparrow", insert: "\\uparrow", tip: "↑ increases" },
                { display: "\\downarrow", insert: "\\downarrow", tip: "↓ decreases" },
                { display: "\\approx", insert: "\\approx", tip: "≈ approximately" },
                { display: "\\Delta", insert: "\\Delta", tip: "Δ change in" },
                { display: "\\%", insert: "\\%", tip: "% percent" },
            ]},
        ],
        [
            { display: "\\text{ATP}", insert: "\\text{ATP}", tip: "ATP" },
            { display: "\\text{DNA}", insert: "\\text{DNA}", tip: "DNA" },
            { display: "\\text{RNA}", insert: "\\text{RNA}", tip: "RNA" },
            { display: "\\text{CO}_2", insert: "\\text{CO}_2", tip: "CO₂" },
            { display: "\\text{O}_2", insert: "\\text{O}_2", tip: "O₂" },
            { display: "\\rightarrow", insert: "\\rightarrow", tip: "→" },
            { display: "\\uparrow", insert: "\\uparrow", tip: "↑" },
            { display: "\\downarrow", insert: "\\downarrow", tip: "↓" },
        ],
        [
            { title: "① Molecules in $ signs", code: "$\\text{ATP}$ is produced in mitochondria", rendered: "\\text{ATP}", note: "Use \\text{} for abbreviations like ATP, DNA, RNA" },
            { title: "② Chemical formulas", code: "$\\text{C}_6\\text{H}_{12}\\text{O}_6$", rendered: "\\text{C}_6\\text{H}_{12}\\text{O}_6", note: "Click the button in Notation tab" },
            { title: "③ Genetics notation", code: "$\\text{Aa} \\times \\text{Aa}$", rendered: "\\text{Aa} \\times \\text{Aa}", note: "Use the Genetics tab for genotype buttons" },
            { title: "④ Process arrows", code: "Light energy $\\rightarrow$ Glucose", rendered: "\\rightarrow", note: "Type -> for arrows, ↑ for increases, ↓ for decreases" },
        ],
        [
            { name: "->  sequence", input: "->", tex: "\\rightarrow", note: "process/leads to" },
            { name: "\\text{ATP}", input: "\\text{ATP}", tex: "\\text{ATP}", note: "molecule name" },
            { name: "\\text{DNA}", input: "\\text{DNA}", tex: "\\text{DNA}", note: "" },
            { name: "Aa genotype", input: "\\text{Aa}", tex: "\\text{Aa}", note: "genetics" },
            { name: "F_1 generation", input: "\\text{F}_1", tex: "\\text{F}_1", note: "" },
            { name: "↑ increases", input: "\\uparrow", tex: "\\uparrow", note: "" },
            { name: "↓ decreases", input: "\\downarrow", tex: "\\downarrow", note: "" },
        ],
        "Biology: use $ signs $ for molecules, genotypes, ratios · Type -> for arrows",
        "Type question here…\n\nExample: Describe the role of $\\text{ATP}$ in cellular respiration.\nWrite the overall equation:\n$\\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{O}_2 -> \\text{CO}_2 + \\text{H}_2\\text{O} + \\text{ATP}$\n\nTip: no special formatting needed for text-only answers.",
        "🧬"
    ),

    /* ── ENGLISH ── */
    English: makeConfig(
        [
            { name: "Quotes", items: [
                { display: "\\text{\"...\"}", insert: "\\text{\"\"}", tip: "Double quotation marks" },
                { display: "\\text{'...'}", insert: "\\text{''}", tip: "Single quotation / apostrophe" },
                { display: "\\ldots", insert: "\\ldots", tip: "… Ellipsis" },
                { display: "\\text{---}", insert: "\\text{---}", tip: "Em dash" },
                { display: "\\text{--}", insert: "\\text{--}", tip: "En dash" },
            ]},
            { name: "Phonetics", items: [
                { display: "\\text{/θ/}", insert: "\\text{/θ/}", tip: "/θ/ voiceless dental fricative (thin)" },
                { display: "\\text{/ð/}", insert: "\\text{/ð/}", tip: "/ð/ voiced dental fricative (this)" },
                { display: "\\text{/ʃ/}", insert: "\\text{/ʃ/}", tip: "/ʃ/ sh sound" },
                { display: "\\text{/ŋ/}", insert: "\\text{/ŋ/}", tip: "/ŋ/ ng sound (sing)" },
                { display: "\\text{/æ/}", insert: "\\text{/æ/}", tip: "/æ/ short a (cat)" },
                { display: "\\text{/ɪ/}", insert: "\\text{/ɪ/}", tip: "/ɪ/ short i (bit)" },
            ]},
            { name: "Misc", items: [
                { display: "\\underline{x}", insert: "\\underline{word}", tip: "Underline text" },
                { display: "\\textit{x}", insert: "\\textit{word}", tip: "Italic" },
                { display: "\\textbf{x}", insert: "\\textbf{word}", tip: "Bold" },
                { display: "\\neq", insert: "\\neq", tip: "≠ not equal / contrasting" },
                { display: "\\rightarrow", insert: "\\rightarrow", tip: "→ leads to / results in" },
            ]},
        ],
        [
            { display: "\\ldots", insert: "\\ldots", tip: "…" },
            { display: "\\underline{x}", insert: "\\underline{word}", tip: "Underline" },
            { display: "\\textit{x}", insert: "\\textit{word}", tip: "Italic" },
            { display: "\\textbf{x}", insert: "\\textbf{word}", tip: "Bold" },
            { display: "\\rightarrow", insert: "\\rightarrow", tip: "→" },
            { display: "\\text{/θ/}", insert: "\\text{/θ/}", tip: "/θ/" },
        ],
        [
            { title: "① Quoting text in $ signs", code: "\"$\\text{To be or not to be}$\"", rendered: "\\text{To be or not to be}", note: "Use \\text{} to keep words formatted correctly" },
            { title: "② Phonetic symbols", code: "The word \"thin\" uses $\\text{/θ/}$", rendered: "\\text{/θ/}", note: "Find phonetic buttons in the Phonetics tab" },
            { title: "③ Most of an English question needs no $", code: "Identify the literary device in the passage.", rendered: "", note: "Only use $ when you need special symbols" },
            { title: "④ Emphasis or structure", code: "$\\underline{\\text{Underline}}$ the correct word.", rendered: "\\underline{\\text{word}}", note: "Use underline, italic, or bold from the Misc tab" },
        ],
        [
            { name: "\\ldots", input: "\\ldots", tex: "\\ldots", note: "ellipsis" },
            { name: "\\underline{word}", input: "\\underline{word}", tex: "\\underline{\\text{word}}", note: "underline" },
            { name: "\\textit{word}", input: "\\textit{word}", tex: "\\textit{word}", note: "italic" },
            { name: "\\textbf{word}", input: "\\textbf{word}", tex: "\\textbf{word}", note: "bold" },
            { name: "->", input: "->", tex: "\\rightarrow", note: "leads to" },
            { name: "phonetic /θ/", input: "\\text{/θ/}", tex: "\\text{/θ/}", note: "IPA symbol" },
        ],
        "English: wrap special symbols in $ signs $ · Use \\text{} for words, \\underline{} to underline",
        "Type question here…\n\nExample: Identify the literary device used in the following passage, then explain its effect on the reader.\n\nTip: most English questions need no special formatting - just type normally.",
        "📝"
    ),
};

/* ─── Interfaces ─── */
interface Question {
    id: number;
    text: string;
    options: Record<"A" | "B" | "C" | "D", string>;
    correct: "A" | "B" | "C" | "D" | "";
    points: number;
    type: "mcq" | "truefalse" | "fillin";
    bankId?: string;
    edited?: boolean;
}
const blankQ = (): Question => ({ id: Date.now() + Math.random(), text: "", options: { A: "", B: "", C: "", D: "" }, correct: "", points: 1, type: "mcq", edited: false });

interface BankQ { id: string; q: string; subj: string; type: string; used: number; options?: Record<"A"|"B"|"C"|"D", string>; correct?: string; rawType?: string; }

type Assessment = { id: number; name: string; type: string; maxMark: number; result: number };
type ResultRow = { name: string; quiz: string; subject: string; score: number; grade: string; sent: boolean; comment: string; sentAt: string; assessments: Assessment[]; _attemptId?: string; _violationCount?: number };

const DEFAULT_ASSESSMENTS = (): Assessment[] => [
    { id: 1, name: "Quiz-1",               type: "continuous", maxMark: 5,  result: 0 },
    { id: 2, name: "Quiz-2",               type: "continuous", maxMark: 5,  result: 0 },
    { id: 3, name: "Mid-term Examination", type: "midterm",    maxMark: 20, result: 0 },
    { id: 4, name: "Assignment-1",         type: "continuous", maxMark: 10, result: 0 },
    { id: 5, name: "Assignment-2",         type: "continuous", maxMark: 10, result: 0 },
    { id: 6, name: "Final Exam",           type: "final",      maxMark: 50, result: 0 },
];

function calcScore(list: Assessment[]): number {
    const totalMax = list.reduce((s, a) => s + a.maxMark, 0);
    const totalResult = list.reduce((s, a) => s + a.result, 0);
    if (totalMax === 0) return 0;
    return Math.round((totalResult / totalMax) * 1000) / 10;
}

function autoGrade(score: number): string {
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    if (score >= 67) return "D+";
    if (score >= 63) return "D";
    if (score >= 60) return "D-";
    return "F";
}

/* ─── LatexField component ─── */
interface LatexFieldProps {
    label: string; value: string; onChange: (v: string) => void;
    rows?: number; placeholder?: string; mini?: boolean; subject?: string;
}

function LatexField({ label, value, onChange, rows = 3, placeholder, mini = false, subject = "Mathematics" }: LatexFieldProps) {
    const cfg = SUBJECT_CONFIG[subject] ?? SUBJECT_CONFIG["Mathematics"];
    const [activeCat, setActiveCat] = useState(0);
    const [showTips, setShowTips] = useState(false);
    const taRef = useCallback((node: HTMLTextAreaElement | null) => {
        if (node) (window as unknown as Record<string, HTMLTextAreaElement>)[`_lf_${label}`] = node;
    }, [label]);

    const insertSnippet = (item: Snippet) => {
        const ta = (window as unknown as Record<string, HTMLTextAreaElement>)[`_lf_${label}`];
        const ins = ` $${item.insert}$ `;
        if (ta) {
            const s = ta.selectionStart ?? value.length;
            const e = ta.selectionEnd ?? value.length;
            onChange(value.slice(0, s) + ins + value.slice(e));
            setTimeout(() => { ta.focus(); ta.setSelectionRange(s + ins.length, s + ins.length); }, 0);
        } else { onChange(value + ins); }
    };

    const snippetBtn = (item: Snippet & { html: string }, key: string) => (
        <button key={key} title={item.tip} onClick={() => insertSnippet(item)}
            dangerouslySetInnerHTML={{ __html: item.html }}
            style={{ padding: "0.1rem 0.4rem", minWidth: 30, height: 26, borderRadius: 4, border: "1.5px solid var(--gray-200)", background: "#fff", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-50)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary-300)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gray-200)"; }}
        />
    );

    return (
        <div style={{ marginBottom: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--gray-600)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</label>
                {!mini && (
                    <button onClick={() => setShowTips(t => !t)} style={{ fontSize: "0.68rem", fontWeight: 600, color: showTips ? "#b45309" : "var(--primary-600)", background: showTips ? "#fef3c7" : "var(--primary-50)", border: `1px solid ${showTips ? "#fde68a" : "var(--primary-200)"}`, borderRadius: 4, padding: "0.1rem 0.45rem", cursor: "pointer" }}>
                        {showTips ? "✕ Hide tips" : `? How to write ${subject ?? "math"}`}
                    </button>
                )}
            </div>

            {/* Teacher-friendly tips panel - subject-specific */}
            {!mini && showTips && (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 4, padding: "0.75rem 0.875rem", marginBottom: "0.5rem" }}>
                    <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.82rem", marginBottom: "0.6rem" }}>{cfg.icon} Writing {subject} - quick guide</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                        {cfg.tips.map(tip => {
                            let rendered = "";
                            if (tip.rendered) { try { rendered = katex.renderToString(tip.rendered, { throwOnError: false }); } catch {} }
                            return (
                                <div key={tip.title} style={{ background: "#fff", borderRadius: 4, padding: "0.5rem 0.65rem" }}>
                                    <div style={{ fontWeight: 700, color: "#78350f", fontSize: "0.75rem", marginBottom: "0.25rem" }}>{tip.title}</div>
                                    <code style={{ fontSize: "0.72rem", color: "#b45309", display: "block", marginBottom: "0.15rem" }}>{tip.code}</code>
                                    {rendered && <div style={{ fontSize: "0.7rem", color: "#78350f" }}>→&nbsp;<span dangerouslySetInnerHTML={{ __html: rendered }} /></div>}
                                    <div style={{ fontSize: "0.67rem", color: "#a16207", marginTop: "0.15rem" }}>{tip.note}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {mini ? (
                /* Compact subject-specific single-row toolbar for option fields */
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.2rem", marginBottom: "0.35rem" }}>
                    {cfg.mini.map(item => snippetBtn(item, item.insert))}
                </div>
            ) : (
                /* Full subject-specific categorized toolbar for question text */
                <div style={{ background: "var(--gray-50)", border: "1.5px solid var(--gray-200)", borderRadius: 4, padding: "0.4rem 0.5rem", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.4rem", flexWrap: "wrap" as const }}>
                        {cfg.cats.map((cat, i) => (
                            <button key={cat.name} onClick={() => setActiveCat(i)}
                                style={{ padding: "0.1rem 0.5rem", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, border: "1.5px solid", cursor: "pointer",
                                    borderColor: activeCat === i ? "var(--primary-500)" : "transparent",
                                    background: activeCat === i ? "var(--primary-50)" : "transparent",
                                    color: activeCat === i ? "var(--primary-600)" : "var(--gray-500)" }}>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.2rem" }}>
                        {cfg.cats[Math.min(activeCat, cfg.cats.length - 1)].items.map(item => snippetBtn(item, item.insert))}
                    </div>
                </div>
            )}

            <textarea ref={taRef} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
                style={{ width: "100%", padding: "0.65rem 0.9rem", background: "#fff", border: "1.5px solid var(--gray-200)", borderRadius: "4px", fontSize: "0.875rem", fontFamily: "monospace", resize: "vertical" as const, lineHeight: 1.6, boxSizing: "border-box" as const }}
                onFocus={e => { e.target.style.borderColor = "var(--primary-400)"; e.target.style.boxShadow = "0 0 0 3px var(--primary-50)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--gray-200)"; e.target.style.boxShadow = "none"; }} />

            {/* Always-visible live preview when there is content */}
            {!mini && value.trim() && (
                <div style={{ marginTop: "0.3rem", padding: "0.5rem 0.75rem", background: "var(--primary-50)", border: "1px solid var(--primary-100)", borderRadius: 4, fontSize: "0.9rem", lineHeight: 1.8 }}
                    dangerouslySetInnerHTML={{ __html: renderLatex(value) }} />
            )}
            {!mini && <p style={{ fontSize: "0.63rem", color: "var(--gray-400)", marginTop: "0.2rem" }}>{cfg.hintLine}</p>}
        </div>
    );
}

export default function TeacherExams() {
    const [isClient, setIsClient] = useState(false);
    const user = useCurrentUser("teacher");
    const { selectedTermId } = useTermStore();
    const [activeTab, setActiveTab] = useState<"create" | "bank" | "results">("create");

    // ── API-loaded data ──
    const [offerings, setOfferings] = useState<ClassOffering[]>([]);
    const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
    const [bankPage, setBankPage] = useState(1);
    const [bankRows, setBankRows] = useState(10);
    const [resultsPage, setResultsPage] = useState(1);
    const [resultsRows, setResultsRows] = useState(10);
    const [publishBusy, setPublishBusy] = useState(false);
    const [scheduleBusy, setScheduleBusy] = useState(false);
    const [saveBankBusy, setSaveBankBusy] = useState(false);
    const [sendAllBusy, setSendAllBusy] = useState(false);
    const [saveEvalBusy, setSaveEvalBusy] = useState(false);
    const [sendingGradeId, setSendingGradeId] = useState<string | null>(null);

    const subjectOptions = useMemo(() => {
        const seen = new Set<string>();
        return offerings
            .map((o) => subjectLabelFromOffering(o).trim())
            .filter(Boolean)
            .filter((name) => {
                const key = normSub(name);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => a.localeCompare(b));
    }, [offerings]);

    const [selectedSubject, setSelectedSubject] = useState("");

    /** Classes shown in the quiz dropdown: filtered by the currently selected subject. */
    const offeringsForClassSelect = useMemo(() => {
        if (!selectedSubject.trim()) return offerings;
        return offerings.filter((o) => subjectNameMatchesProfile(subjectLabelFromOffering(o), selectedSubject));
    }, [offerings, selectedSubject]);
    const [activeYearId, setActiveYearId] = useState("");
    const [publishedExams, setPublishedExams] = useState<ApiExam[]>([]);
    const [rosterByExam, setRosterByExam] = useState<Record<string, ExamRosterStudent[]>>({});
    const [violationsByAttempt, setViolationsByAttempt] = useState<Record<string, Violation[]>>({});
    const [apiLoading, setApiLoading] = useState(false);
    const [apiErr, setApiErr] = useState<string | null>(null);

    // Quiz meta
    const [quizTitle, setQuizTitle] = useState("");
    const classGroup = classOfferingLabel(offerings.find((o) => o.id === selectedOfferingIds[0])) || "Selected Class";
    const [subject, setSubject] = useState("");
    const [duration, setDuration] = useState("30");
    const [minStayMinutes, setMinStayMinutes] = useState("0");

    useEffect(() => {
        if (selectedSubject.trim()) return;
        const initial = subjectOptions.includes(user?.subject?.trim() ?? "")
            ? (user?.subject?.trim() ?? "")
            : subjectOptions[0] ?? user?.subject?.trim() ?? "";
        if (initial) {
            setSelectedSubject(initial);
            setSubject(initial);
        }
    }, [selectedSubject, subjectOptions, user?.subject]);

    useEffect(() => {
        if (selectedSubject.trim()) {
            setSubject(selectedSubject);
        }
    }, [selectedSubject]);

    // Questions
    const [questions, setQuestions] = useState<Question[]>([blankQ()]);
    const [activeQ, setActiveQ] = useState(0);
    const q = questions[activeQ];
    const updateQ = (patch: Partial<Question>) =>
        setQuestions(prev => prev.map((qq, i) => i === activeQ ? { ...qq, ...patch, edited: true } : qq));

    // Bank state
    const [bank, setBank] = useState<BankQ[]>([]);
    const [bankSearch, setBankSearch] = useState("");

    // Results - built from real API data
    const [results, setResults] = useState<ResultRow[]>([]);
    const [monitoringExam, setMonitoringExam] = useState<ApiExam | null>(null);

    // Toast
    const [toast, setToast] = useState<(ToastState & { ok?: boolean }) | null>(null);
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);
    const [scheduledOpenAt, setScheduledOpenAt] = useState("");
    const showToast = (msg: string, ok = true) => { setToast({ msg, ok, type: ok ? undefined : undefined }); setTimeout(() => setToast(null), 3500); };

    const addQuestion = () => {
        setQuestions((p) => {
            const next = [...p, blankQ()];
            setActiveQ(next.length - 1);
            return next;
        });
    };
    const removeQuestion = (idx: number) => { if (questions.length === 1) return; setQuestions(p => p.filter((_, i) => i !== idx)); setActiveQ(Math.min(idx, questions.length - 2)); };

    const getQuizValidationError = () => {
        if (!quizTitle.trim()) return "Enter a quiz title";
        if (offerings.length > 0 && subjectOptions.length > 0 && !selectedSubject.trim()) {
            return "Select a subject before creating or scheduling an exam.";
        }
        if (selectedSubject.trim() && offerings.length > 0 && offeringsForClassSelect.length === 0) {
            return "No class matches the selected subject. Try a different subject.";
        }
        if (offerings.length > 0 && selectedOfferingIds.length === 0) return "Select at least one class for this quiz";
        const withText = questions.filter((qq) => qq.text.trim());
        if (withText.length === 0) return "Add at least one question with text";
        for (const qq of questions) {
            if (qq.text.trim() && !qq.correct) return "Select the correct answer for each question that has text";
        }
        return null;
    };



    const publishQuiz = async (mode: "published" | "scheduled", opensAtIso: string) => {
        const parsedDuration = Number.parseInt(duration, 10);
        const safeDuration = Number.isNaN(parsedDuration) ? 30 : Math.max(5, parsedDuration);
        const parsedMinStay = Number.parseInt(minStayMinutes, 10);
        const safeMinStay = Number.isNaN(parsedMinStay) ? 0 : Math.max(0, Math.min(parsedMinStay, safeDuration));

        try {
            if (mode === "published") setPublishBusy(true);
            else setScheduleBusy(true);
            if (!activeYearId) {
                showToast("Academic year is still loading. Wait a moment and try again.", false);
                return;
            }

            if (selectedOfferingIds.length === 0) {
                showToast("Select at least one class before publishing or scheduling.", false);
                return;
            }

            // Using the first one's subjectId for assigning new questions
            const offering1 = offerings.find(o => o.id === selectedOfferingIds[0]);
            const subjectId = offering1?.subjectId ?? "";

            if (selectedSubject.trim()) {
                const invalid = selectedOfferingIds.some(id => {
                    const off = offerings.find(o => o.id === id);
                    const sn = subjectLabelFromOffering(off as ClassOffering);
                    return !subjectNameMatchesProfile(sn, selectedSubject || "");
                });
                if (invalid) {
                    showToast(`Select classes that match the selected subject (${selectedSubject}).`, false);
                    return;
                }
            }

            // Close time: open + duration + 1 hour buffer
            // Use a small buffer (2 mins in past) for immediate publish to avoid "Outside exam window" errors
            const baseDate = mode === "published" ? new Date(Date.now() - 120_000) : new Date(opensAtIso);
            const opensDate = baseDate;
            const closesDate = new Date(opensDate.getTime() + (safeDuration + 60) * 60_000);

            const items: { questionId: string; orderIndex: number; points: number }[] = [];
            let order = 0;
            for (let idx = 0; idx < questions.length; idx++) {
                const qq = questions[idx];
                if (!qq.text.trim()) continue;

                if (qq.bankId && !qq.edited) {
                    items.push({ questionId: qq.bankId, orderIndex: order, points: qq.points });
                    order += 1;
                    continue;
                }

                let optionsArr: string[] | undefined;
                let ans: string | undefined;

                if (qq.type === "mcq") {
                    optionsArr = [qq.options.A, qq.options.B, qq.options.C, qq.options.D];
                    ans = qq.correct ? qq.options[qq.correct] : undefined;
                } else if (qq.type === "truefalse") {
                    optionsArr = ["True", "False"];
                    ans = qq.correct === "A" ? "True" : qq.correct === "B" ? "False" : undefined;
                } else {
                    // fillin
                    optionsArr = undefined;
                    ans = qq.text.includes("____") ? qq.correct : qq.correct; // Usually answerKey is stored directly
                }

                const created = await apiCreateQuestion({
                    type: qq.type,
                    stem: qq.text,
                    optionsJson: optionsArr ? JSON.stringify(optionsArr) : undefined,
                    answerKey: ans || (qq.type === "fillin" ? qq.correct : undefined),
                    subjectId,
                });
                
                setQuestions(prev => prev.map((oldQ, index) => index === idx ? { ...oldQ, bankId: created.id, edited: false } : oldQ));

                items.push({ questionId: created.id, orderIndex: order, points: qq.points });
                order += 1;
            }

            if (items.length === 0) {
                showToast("Add at least one question with text before publishing.", false);
                return;
            }

            const totalPoints = items.reduce((s, it) => s + it.points, 0);

            // 1. Create exams in backend
            for (const offId of selectedOfferingIds) {
                const exam = await apiCreateExam({
                    title: quizTitle.trim(),
                    academicYearId: activeYearId,
                    classOfferingId: offId,
                    opensAt: opensDate.toISOString(),
                    closesAt: closesDate.toISOString(),
                    durationMinutes: safeDuration,
                    minStayMinutes: safeMinStay,
                    maxPoints: Math.max(1, totalPoints),
                    termId: selectedTermId ?? undefined,
                });
                
                await addQuestionsToExam(exam.id, items);
                await updateExamMaxPoints(exam.id, Math.max(1, totalPoints));
                await apiPublishExam(exam.id);
            }

            await loadBank();

            if (mode === "scheduled") {
                const scheduledLabel = new Date(opensAtIso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                showToast(`"${quizTitle}" scheduled for ${scheduledLabel} ✓`);
            } else {
                showToast(`"${quizTitle}" published ✓`);
            }

            setQuizTitle("");
            // Not clearing editor state so user doesn't lose work unintentionally
            // setQuestions([blankQ()]);
            // setActiveQ(0);
            setScheduledOpenAt("");
            setMinStayMinutes("0");

            // Refresh results data
            loadResultsData();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Publish failed", false);
        } finally {
            setPublishBusy(false);
            setScheduleBusy(false);
        }
    };

    const handlePublishConfirm = async () => {
        const error = getQuizValidationError();
        if (error) {
            showToast(error, false);
            setShowPublishConfirm(false);
            return;
        }
        setShowPublishConfirm(false);
        await publishQuiz("published", new Date().toISOString());
    };

    const handleScheduleConfirm = async () => {
        const error = getQuizValidationError();
        if (error) {
            showToast(error, false);
            setShowScheduleConfirm(false);
            return;
        }
        if (!scheduledOpenAt) {
            showToast("Choose date and time for schedule", false);
            return;
        }
        const opensAt = new Date(scheduledOpenAt);
        if (Number.isNaN(opensAt.getTime()) || opensAt.getTime() <= Date.now()) {
            showToast("Scheduled time must be in the future", false);
            return;
        }
        setShowScheduleConfirm(false);
        await publishQuiz("scheduled", opensAt.toISOString());
    };

    // Add a bank question into the current quiz
    const useFromBank = (item: BankQ) => {
        let qType: "mcq"|"truefalse"|"fillin" = "mcq";
        if (item.rawType === "truefalse") qType = "truefalse";
        else if (item.rawType === "fillin") qType = "fillin";

        const newQ: Question = { 
            ...blankQ(), 
            bankId: item.id,
            edited: false,
            text: item.q,
            type: qType,
            options: item.options ? { ...item.options } : { A: "", B: "", C: "", D: "" },
            correct: (item.correct as "" | "A" | "B" | "C" | "D") || ""
        };
        setQuestions(p => { const next = [...p, newQ]; setActiveQ(next.length - 1); return next; });
        setBank(p => p.map(b => b.id === item.id ? { ...b, used: b.used + 1 } : b));
        setActiveTab("create");
        showToast("Question added from bank ✓");
    };

    // Load a bank question directly into full quiz builder for detailed editing.
    const editFromBank = (item: BankQ) => {
        setActiveTab("create");
        const current = selectedSubject?.trim();
        const useSelected = current && SUBJECT_CONFIG[current];
        setSubject(useSelected ? current : item.subj);
        setQuestions([{ ...blankQ(), text: item.q }]);
        setActiveQ(0);
        if (!quizTitle.trim()) {
            setQuizTitle(`${item.subj} Quiz`);
        }
        showToast("Question loaded in quiz builder - you can add/remove/edit before publishing.");
    };

    const filteredBank = bankSearch.trim()
        ? bank.filter(b => b.q.toLowerCase().includes(bankSearch.toLowerCase()) || b.subj.toLowerCase().includes(bankSearch.toLowerCase()))
        : bank;

    // ── Evaluate modal state ─────────────────────────────────────────────────
    const [evaluating, setEvaluating] = useState<ResultRow | null>(null);
    const [evalAttemptDetails, setEvalAttemptDetails] = useState<any>(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalAssessments, setEvalAssessments] = useState<Assessment[]>([]);
    const [evalComment, setEvalComment] = useState("");
    const evalTotalMax    = evalAssessments.reduce((s, a) => s + a.maxMark, 0);
    const evalTotalResult = evalAssessments.reduce((s, a) => s + a.result, 0);
    const evalScore       = calcScore(evalAssessments);
    const evalGrade       = autoGrade(evalScore);

    // ── Load offerings + results from API ──
    const loadResultsData = useCallback(async () => {
        setApiLoading(true);
        setApiErr(null);
        try {
            const year = await getActiveAcademicYear();
            if (!year?.id) {
                setActiveYearId("");
                setOfferings([]);
                setPublishedExams([]);
                setResults([]);
                setRosterByExam({});
                setApiErr("No active academic year. Ask an admin to activate one.");
                return;
            }
            setActiveYearId(year.id);
            const mine = await listMyClassOfferings(year.id);
            setOfferings(mine);
            setSelectedOfferingIds((prev) => {
                if (prev && prev.length > 0 && mine.some((o) => prev.includes(o.id))) return prev;
                return mine[0]?.id ? [mine[0].id] : [];
            });

            const myOfferingIds = new Set(mine.map((o) => o.id));
            const exams = await apiListExams(year.id, selectedTermId ?? undefined);
            const filteredExams = exams.filter((ex) => !!ex.classOfferingId && myOfferingIds.has(ex.classOfferingId));
            setPublishedExams(filteredExams);

            const rosters: Record<string, ExamRosterStudent[]> = {};
            const rows: ResultRow[] = [];
            const activeExams = filteredExams.filter(e => e.published);

            await Promise.all(activeExams.map(async (ex) => {
                try {
                    const rosterData = await getExamStudentRoster(ex.id);
                    rosters[ex.id] = rosterData.students;
                    
                    const exOffering = mine.find(o => o.id === ex.classOfferingId);
                    const exSubject = (exOffering as any)?.subjectName || (exOffering as any)?.subject?.name || "Academic";

                    for (const s of rosterData.students) {
                        if (s.status === "submitted") {
                            rows.push({
                                name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email || s.studentId.slice(0, 8),
                                quiz: ex.title,
                                subject: exSubject,
                                score: s.score ?? 0,
                                grade: autoGrade(s.score ?? 0),
                                sent: !!s.releasedAt,
                                comment: "",
                                sentAt: s.releasedAt ? new Date(s.releasedAt).toISOString().slice(0, 10) : "",
                                assessments: [{
                                    id: 1,
                                    name: ex.title,
                                    type: "final",
                                    maxMark: ex.maxPoints,
                                    result: s.score ?? 0,
                                }],
                                _attemptId: s.attemptId ?? undefined,
                                _violationCount: s.violationCount,
                            });
                        }
                    }
                } catch { /* skip */ }
            }));

            setResults(rows);
            setResultsPage(1);
            setRosterByExam(rosters);
        } catch (e) {
            setApiErr(e instanceof Error ? e.message : "Failed to load exams");
        } finally {
            setApiLoading(false);
        }
    }, [selectedTermId]);

    const loadBank = useCallback(async () => {
        try {
            const rawqs = await listQuestions();
            const selectedClassOfferings = selectedOfferingIds.length > 0
                ? offerings.filter((o) => selectedOfferingIds.includes(o.id))
                : offeringsForClassSelect;
            const candidateOfferings = selectedClassOfferings.length > 0 ? selectedClassOfferings : offeringsForClassSelect;
            const allowedIds = new Set(candidateOfferings.map((o) => o.subjectId).filter(Boolean));
            const scoped = candidateOfferings;
            const subjectIdToLabel = new Map<string, string>();
            for (const o of scoped) {
                if (!o.subjectId) continue;
                const label = o.subjectName || (o as { subject?: { name?: string } }).subject?.name || "";
                if (label) subjectIdToLabel.set(o.subjectId, label);
            }
            const mapped: BankQ[] = rawqs
                .filter((q) =>
                    questionInTeacherSubjectBank(
                        {
                            subjectId: q.subjectId,
                            subject: (q as { subject?: { name?: string } }).subject,
                        },
                        allowedIds,
                        selectedSubject,
                    ),
                )
                .map((q) => {
                    let opts: Record<"A"|"B"|"C"|"D", string> = { A: "", B: "", C: "", D: "" };
                    if (q.optionsJson) {
                        try {
                            const arr = JSON.parse(q.optionsJson);
                            if (Array.isArray(arr)) {
                                opts = { A: arr[0] || "", B: arr[1] || "", C: arr[2] || "", D: arr[3] || "" };
                            }
                        } catch {}
                    }

                    // Map answerKey back to A/B/C/D if possible, otherwise it's a string
                    let corr = "";
                    if (q.type === "mcq") {
                        if (q.answerKey === opts.A) corr = "A";
                        else if (q.answerKey === opts.B) corr = "B";
                        else if (q.answerKey === opts.C) corr = "C";
                        else if (q.answerKey === opts.D) corr = "D";
                    } else if (q.type === "truefalse") {
                        corr = q.answerKey === "True" ? "A" : "B";
                    } else {
                        corr = q.answerKey || "";
                    }

                    return {
                        id: q.id,
                        q: q.stem,
                        subj:
                            (q as { subject?: { name?: string } }).subject?.name ||
                            subjectIdToLabel.get(q.subjectId) ||
                            q.subjectId ||
                            "Assorted",
                        type: q.type === "mcq" ? "Multiple Choice" : q.type === "truefalse" ? "True / False" : "Fill in Blank",
                        used: 0,
                        options: opts,
                        correct: corr,
                        rawType: q.type
                    };
                });
            setBank(mapped);
        } catch { /* keep prior bank on failure */ }
    }, [selectedSubject, offerings, offeringsForClassSelect, selectedOfferingIds]);

    const saveQuestionsToBank = useCallback(async () => {
        setSaveBankBusy(true);
        const offering = offerings.find((o) => o.id === selectedOfferingIds[0]);
        const subjectId = offering?.subjectId ?? "";
        if (!subjectId) {
            showToast("Select a class so questions are saved under the correct subject", false);
            setSaveBankBusy(false);
            return;
        }
        if (selectedSubject?.trim() && offering) {
            const sn = subjectLabelFromOffering(offering);
            if (!subjectNameMatchesProfile(sn, selectedSubject)) {
                showToast(`Select a class that matches the selected subject (${selectedSubject}) before saving to the bank.`, false);
                return;
            }
        }
        const toSave = questions.filter((qq) => qq.text.trim() && qq.correct && (!qq.bankId || qq.edited));
        if (toSave.length === 0) {
            showToast("Add question text and choose a correct answer for at least one question", false);
            setSaveBankBusy(false);
            return;
        }
        const subjLabel =
            subjectLabelFromOffering(offering as ClassOffering) ||
            selectedSubject ||
            "Assorted";
        try {
            const newRows: BankQ[] = [];
            for (const qq of toSave) {
                let optionsArr: string[] | undefined;
                let ans: string | undefined;

                if (qq.type === "mcq") {
                    optionsArr = [qq.options.A, qq.options.B, qq.options.C, qq.options.D];
                    ans = qq.correct ? qq.options[qq.correct as "A"|"B"|"C"|"D"] : undefined;
                } else if (qq.type === "truefalse") {
                    optionsArr = ["True", "False"];
                    ans = qq.correct === "A" ? "True" : qq.correct === "B" ? "False" : undefined;
                } else {
                    optionsArr = undefined;
                    ans = qq.correct;
                }

                const created = await apiCreateQuestion({
                    type: qq.type,
                    stem: qq.text,
                    optionsJson: optionsArr ? JSON.stringify(optionsArr) : undefined,
                    answerKey: ans || (qq.type === "fillin" ? qq.correct : undefined),
                    subjectId,
                });
                newRows.push({
                    id: created.id,
                    q: created.stem,
                    subj: subjLabel,
                    type: created.type === "mcq" ? "Multiple Choice" : created.type === "truefalse" ? "True / False" : "Fill in Blank",
                    used: 0,
                });
            }
            setBank((prev) => {
                const seen = new Set(prev.map((b) => b.id));
                const merged = [...prev];
                for (const row of newRows) {
                    if (!seen.has(row.id)) {
                        seen.add(row.id);
                        merged.unshift(row);
                    }
                }
                return merged;
            });
            await loadBank();
            // GET /questions can lag or omit nested fields; keep rows we just created in the list.
            setBank((prev) => {
                const ids = new Set(prev.map((b) => b.id));
                const missing = newRows.filter((r) => !ids.has(r.id));
                return missing.length ? [...missing, ...prev] : prev;
            });
            showToast(toSave.length === 1 ? "Saved to exam bank ✓" : `Saved ${toSave.length} questions to exam bank ✓`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Could not save to exam bank", false);
        } finally {
            setSaveBankBusy(false);
        }
    }, [offerings, selectedOfferingIds, questions, loadBank, selectedSubject]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;
        void refreshStoredProfile();
    }, [isClient]);

    useEffect(() => {
        if (isClient) loadResultsData();
    }, [isClient, loadResultsData]);

    useEffect(() => {
        if (!isClient) return;
        loadBank();
    }, [isClient, loadBank]);

    useEffect(() => {
        if (!isClient) return;
        if (offeringsForClassSelect.length === 0) {
            if (selectedSubject?.trim() && offerings.length > 0) setSelectedOfferingIds([]);
            return;
        }
        setSelectedOfferingIds((p) => {
            if (p && p.length > 0 && offeringsForClassSelect.some((o) => p.includes(o.id))) return p;
            return [offeringsForClassSelect[0].id];
        });
    }, [offeringsForClassSelect, selectedSubject, offerings.length, isClient]);
    // ── Grade sender / published exams via real API ───────────────────────────────

    const openEvaluate = async (res: ResultRow) => {
        setEvaluating(res);
        setEvalAssessments(res.assessments || []);
        setEvalAttemptDetails(null);
        if (res._attemptId) {
            setEvalLoading(true);
            try {
                const { getAttemptForGrader } = await import("@/lib/admin-api");
                const details = await getAttemptForGrader(res._attemptId);
                setEvalAttemptDetails(details);
            } catch (err) {
                console.error("Failed to load attempt details:", err);
            } finally {
                setEvalLoading(false);
            }
        }
        setEvalAssessments(res.assessments.length > 0 ? res.assessments.map(a => ({ ...a })) : DEFAULT_ASSESSMENTS());
        setEvalComment(res.comment);
    };

    const saveEval = async (sendNow: boolean) => {
        if (!evaluating) return;
        setSaveEvalBusy(true);
        try {
            const evalAttemptId = (evaluating as ResultRow & { _attemptId?: string })._attemptId;
            const score = calcScore(evalAssessments);
            const grade = autoGrade(score);
            const now = new Date().toISOString().slice(0, 10);
            const updated: ResultRow = {
                ...evaluating,
                score,
                grade,
                comment: evalComment,
                assessments: evalAssessments,
                sent: sendNow ? true : evaluating.sent,
                sentAt: sendNow && !evaluating.sentAt ? now : evaluating.sentAt,
            };
            setResults((prev) =>
                prev.map((r) => {
                    const rid = (r as ResultRow & { _attemptId?: string })._attemptId;
                    if (evalAttemptId && rid) return rid === evalAttemptId ? updated : r;
                    return r.name === evaluating.name && r.quiz === evaluating.quiz ? updated : r;
                }),
            );

            // Call real API for grading + releasing
            if (evalAttemptId) {
                try {
                    await apiGradeAttempt(evalAttemptId, score);
                    if (sendNow) {
                        await apiReleaseAttempt(evalAttemptId);
                    }
                } catch (e) {
                    showToast(e instanceof Error ? e.message : "Grading API failed", false);
                }
            }

            if (sendNow) {
                showToast(`Grade sent to ${updated.name} ✓`);
            } else {
                showToast("Evaluation saved ✓");
            }
            setEvaluating(null);
        } finally {
            setSaveEvalBusy(false);
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const BLUE   = [30,  58, 138] as [number,number,number];
        const DKGRAY = [30,  30,  30] as [number,number,number];
        const MDGRAY = [100,100,100] as [number,number,number];

        // ─── Institution header band ──────────────────────────────────
        doc.setFillColor(...BLUE);
        doc.rect(0, 0, pageW, 28, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("TRILINK SCHOOL", pageW / 2, 11, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Academic Assessment Transcript  \u2014  Teacher Copy", pageW / 2, 18, { align: "center" });
        doc.text(`Generated: ${now}`, pageW / 2, 24, { align: "center" });

        // ─── Meta info block ──────────────────────────────────────────
        doc.setTextColor(...DKGRAY);
        let yy = 35;
        const metaRows: [string, string][] = [
            ["Class Group", classGroup],
            ["Course / Quiz", results[0]?.quiz ?? ""],
            ["Subject",      results[0]?.subject ?? ""],
            ["Total Students", String(results.length)],
        ];
        const colW = (pageW - 28) / 2;
        metaRows.forEach(([k, v], idx) => {
            const x = idx % 2 === 0 ? 14 : 14 + colW + 4;
            if (idx % 2 === 0 && idx > 0) yy += 7;
            doc.setFont("helvetica", "bold");   doc.setFontSize(8);  doc.setTextColor(...MDGRAY);  doc.text(k.toUpperCase(), x, yy);
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...DKGRAY);  doc.text(v, x, yy + 4.5);
        });
        yy += 12;

        // ─── Divider ──────────────────────────────────────────────────
        doc.setDrawColor(...BLUE);
        doc.setLineWidth(0.5);
        doc.line(14, yy, pageW - 14, yy);
        yy += 5;

        // ─── Per-student assessment breakdown ─────────────────────────
        results.forEach((r, si) => {
            // Student name header row
            if (yy > 250) { doc.addPage(); yy = 15; }
            doc.setFillColor(239, 246, 255);
            doc.roundedRect(14, yy, pageW - 28, 8, 2, 2, "F");
            doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...BLUE);
            doc.text(`${si + 1}.  ${r.name}`, 18, yy + 5.5);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MDGRAY);
            doc.text(`Status: ${r.sent ? "Sent" : "Pending"}`, pageW - 14, yy + 5.5, { align: "right" });
            yy += 10;

            // Assessment breakdown table
            const assessRows = r.assessments.length > 0
                ? r.assessments.map((a, i) => [(i + 1).toString(), a.name, a.type, String(a.maxMark), String(a.result), ""])
                : [["--", "No breakdown available", "", "", "", ""]];

            const totalMax    = r.assessments.reduce((s, a) => s + a.maxMark, 0);
            const totalResult = r.assessments.reduce((s, a) => s + a.result, 0);

            autoTable(doc, {
                startY: yy,
                margin: { left: 14, right: 14 },
                head: [["SN", "Assessment Name", "Type", "Max Mark", "Result", "Grade"]],
                body: assessRows,
                foot: [[{ content: "Totals", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } }, String(totalMax), `${totalResult}/${totalMax}`, r.grade]],
                theme: "grid",
                styles: { fontSize: 8.5, cellPadding: 2.5, textColor: DKGRAY },
                headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: "bold", fontSize: 8 },
                footStyles: { fillColor: [240,253,244], textColor: [6,95,70], fontStyle: "bold" },
                alternateRowStyles: { fillColor: [248,250,252] },
                columnStyles: {
                    0: { cellWidth: 9 },
                    2: { cellWidth: 22 },
                    3: { cellWidth: 22, halign: "center" },
                    4: { cellWidth: 25, halign: "center" },
                    5: { cellWidth: 18, halign: "center" },
                },
                didParseCell: (data) => {
                    if (data.section === "foot" && data.column.index === 5) {
                        const g = data.cell.raw as string;
                        data.cell.styles.textColor = g.startsWith("A") ? [6,95,70] : g.startsWith("B") ? [30,58,138] : g.startsWith("F") ? [153,27,27] : [146,64,14];
                    }
                },
            });
            yy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

            // Score summary line
            doc.setFont("helvetica", "bold"); doc.setFontSize(9);
            doc.setTextColor(...BLUE);
            doc.text(`Final Score: ${r.score}%   ·   Grade: ${r.grade}`, 18, yy + 4);
            if (r.comment) {
                doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...MDGRAY);
                doc.text(`Feedback: ${r.comment}`, 18, yy + 9, { maxWidth: pageW - 36 });
                yy += 6;
            }
            yy += 10;
        });

        // ─── Summary roster table ──────────────────────────────────────
        if (yy > 220) { doc.addPage(); yy = 15; }
        doc.setDrawColor(...BLUE); doc.setLineWidth(0.5);
        doc.line(14, yy, pageW - 14, yy); yy += 5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...BLUE);
        doc.text("Class Summary Roster", 14, yy); yy += 6;

        autoTable(doc, {
            startY: yy,
            margin: { left: 14, right: 14 },
            head: [["#", "Student Name", "Quiz / Course", "Total Score", "Grade", "Status", "Date Sent"]],
            body: results.map((r, i) => [
                String(i + 1),
                r.name,
                r.quiz,
                `${r.score}%`,
                r.grade,
                r.sent ? "Sent" : "Pending",
                r.sentAt || "-",
            ]),
            theme: "striped",
            styles: { fontSize: 9, cellPadding: 3, textColor: DKGRAY },
            headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248,250,252] },
            columnStyles: {
                0: { cellWidth: 9 },
                3: { halign: "center" },
                4: { halign: "center", fontStyle: "bold" },
                5: { halign: "center" },
                6: { halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section === "body" && data.column.index === 4) {
                    const g = String(data.cell.raw);
                    data.cell.styles.textColor = g.startsWith("A") ? [6,95,70] : g.startsWith("B") ? [30,58,138] : g.startsWith("F") ? [153,27,27] : [146,64,14];
                }
                if (data.section === "body" && data.column.index === 5) {
                    data.cell.styles.textColor = data.cell.raw === "Sent" ? [6,95,70] : [146,64,14];
                }
            },
        });

        // ─── Footer on every page ─────────────────────────────────────
        const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
            doc.line(14, pageH - 12, pageW - 14, pageH - 12);
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(160,160,160);
            doc.text("Trilink School - Confidential Teacher Transcript", 14, pageH - 7);
            doc.text(`Page ${p} of ${totalPages}`, pageW - 14, pageH - 7, { align: "right" });
        }

        doc.save(`transcript_${classGroup.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!isClient || (apiLoading && offerings.length === 0 && !apiErr)) {
        return (
            <div className="page-wrapper">
                <TeacherExamsSkeleton />
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", borderRadius: 4, padding: "1rem 1.5rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `1.5px solid ${toast.ok ? "var(--success)" : "var(--danger)"}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: toast.ok ? "var(--success-light)" : "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center", color: toast.ok ? "var(--success)" : "var(--danger)" }}>
                        {toast.ok ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{toast.msg}</span>
                </div>
            )}

            {/* ── Evaluate Modal ── */}
            {isClient && evaluating && createPortal(
                <div className="modal-overlay" style={{ padding: "1rem", overflowY: "auto", alignItems: "center" }}>
                    <div style={{ background: "#fff", borderRadius: 4, width: "100%", maxWidth: 820, boxShadow: "0 28px 90px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", maxHeight: "95vh", overflow: "hidden", zIndex: "var(--z-modal)" }}>

                        {/* ── Modal Header ── */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.5rem", borderBottom: "1.5px solid var(--gray-100)", flexShrink: 0 }}>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", margin: 0 }}>Evaluate Student</h3>
                                <div style={{ fontSize: "0.76rem", color: "var(--gray-400)", marginTop: "0.15rem" }}>Score is calculated automatically from assessments below</div>
                            </div>
                            <button onClick={() => setEvaluating(null)} style={{ width: 32, height: 32, borderRadius: 4, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        {/* ── Course Info Strip ── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0", background: "var(--gray-50)", borderBottom: "1px solid var(--gray-100)", flexShrink: 0 }}>
                            {[
                                { label: "Course Title", value: evaluating.quiz },
                                { label: "Subject",      value: evaluating.subject },
                                { label: "Student",      value: evaluating.name },
                            ].map((item, i) => (
                                <div key={item.label} style={{ padding: "0.75rem 1.25rem", borderRight: i < 2 ? "1px solid var(--gray-200)" : "none" }}>
                                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.2rem" }}>{item.label}</div>
                                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--gray-800)" }}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* ── Scrollable body ── */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
                            {evalLoading ? (
                                <div style={{ padding: "3rem", textAlign: "center", color: "var(--gray-400)" }}>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Loading Submission...</div>
                                    <p style={{ fontSize: "0.85rem" }}>Fetching student answers and grading breakdown</p>
                                </div>
                            ) : evalAttemptDetails ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
                                    <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--gray-100)", paddingBottom: "0.5rem" }}>Exam Submission Details</h4>
                                    
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                        {Object.entries(evalAttemptDetails.answers || {}).map(([qId, answer]: [string, any], idx) => {
                                            const breakdown = evalAttemptDetails.breakdown?.perQuestion?.find((p: any) => p.questionId === qId);
                                            const isCorrect = breakdown ? breakdown.pointsEarned === breakdown.pointsMax : null;
                                            const qStem = (evalAttemptDetails.examQuestions || []).find((eq: any) => eq.questionId === qId)?.question?.stem || `Question ${idx + 1}`;

                                            return (
                                                <div key={qId} style={{ padding: "1.25rem", borderRadius: "12px", border: "1.5px solid var(--gray-100)", background: isCorrect === true ? "var(--success-50)" : isCorrect === false ? "var(--danger-50)" : "var(--gray-50)" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--gray-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-600)" }}>{idx + 1}</div>
                                                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-700)" }}>Question Item</span>
                                                        </div>
                                                        <div className={`badge ${isCorrect === true ? "badge-success" : isCorrect === false ? "badge-danger" : "badge-warning"}`}>
                                                            {breakdown?.pointsEarned ?? 0} / {breakdown?.pointsMax ?? 0} PTS
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: "1rem", color: "var(--gray-900)", fontWeight: 600, lineHeight: 1.5, marginBottom: "1rem" }}>{qStem}</div>
                                                    <div style={{ background: "#fff", padding: "0.85rem 1rem", borderRadius: "8px", border: "1.5px solid var(--gray-100)", fontSize: "0.9rem" }}>
                                                        <span style={{ color: "var(--gray-400)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Student Response</span>
                                                        <div style={{ color: "var(--gray-800)", fontWeight: 500 }}>{String(answer)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Manual Overrides / Grades</div>
                                <button className="btn btn-primary btn-sm" disabled={saveEvalBusy} onClick={() => setEvalAssessments(p => [...p, { id: Date.now(), name: "Assessment", type: "other", maxMark: 10, result: 0 }])}>
                                    + Add Item
                                </button>
                            </div>

                            {/* Assessment Table */}
                            <div style={{ overflowX: "auto", borderRadius: 4, border: "1.5px solid var(--gray-200)", marginBottom: "1rem" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                    <thead>
                                        <tr style={{ background: "var(--gray-50)" }}>
                                            <th style={{ padding: "0.65rem 0.75rem", textAlign: "left" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 36 }}>SN</th>
                                            <th style={{ padding: "0.65rem 0.75rem", textAlign: "left" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)" }}>Assessment Name</th>
                                            <th style={{ padding: "0.65rem 0.75rem", textAlign: "left" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 150 }}>Assessment Type</th>
                                            <th style={{ padding: "0.65rem 0.75rem", textAlign: "center" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 110 }}>Maximum Mark</th>
                                            <th style={{ padding: "0.65rem 0.75rem", textAlign: "center" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 110 }}>Result</th>
                                            <th style={{ padding: "0.65rem 0.5rem", textAlign: "center" as const, fontWeight: 700, fontSize: "0.75rem", color: "var(--gray-600)", borderBottom: "2px solid var(--gray-200)", width: 34 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {evalAssessments.map((a, i) => (
                                            <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid var(--gray-100)" }}>
                                                <td style={{ padding: "0.45rem 0.75rem", color: "var(--gray-400)", fontWeight: 600, fontSize: "0.8rem" }}>{i + 1}</td>
                                                <td style={{ padding: "0.45rem 0.5rem" }}>
                                                    <input value={a.name}
                                                        onChange={e => setEvalAssessments(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                                        style={{ width: "100%", padding: "0.3rem 0.55rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.83rem", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                                                </td>
                                                <td style={{ padding: "0.45rem 0.5rem" }}>
                                                    <Select value={a.type}
                                                        onChange={e => setEvalAssessments(p => p.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                                                        style={{ width: "100%", padding: "0.3rem 0.5rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.83rem", background: "#fff", fontFamily: "inherit" }}>
                                                        <option value="continuous">continuous</option>
                                                        <option value="midterm">midterm</option>
                                                        <option value="quiz">quiz</option>
                                                        <option value="assignment">assignment</option>
                                                        <option value="project">project</option>
                                                        <option value="final">final</option>
                                                        <option value="other">other</option>
                                                    </Select>
                                                </td>
                                                <td style={{ padding: "0.45rem 0.5rem" }}>
                                                    <input type="number" min={0} value={a.maxMark === 0 ? "" : a.maxMark}
                                                        onChange={e => {
                                                            const raw = e.target.value;
                                                            setEvalAssessments(p => p.map((x, j) => {
                                                                if (j !== i) return x;
                                                                if (raw === "") return { ...x, maxMark: 0 };
                                                                const parsed = parseFloat(raw);
                                                                return Number.isNaN(parsed) ? x : { ...x, maxMark: parsed };
                                                            }));
                                                        }}
                                                        onBlur={() => setEvalAssessments(p => p.map((x, j) => j === i ? { ...x, maxMark: Math.max(0, x.maxMark) } : x))}
                                                        style={{ width: "100%", padding: "0.3rem 0.5rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.83rem", textAlign: "center" as const, boxSizing: "border-box" as const }} />
                                                </td>
                                                <td style={{ padding: "0.45rem 0.5rem" }}>
                                                    <input type="number" min={0} max={a.maxMark} value={a.result === 0 ? "" : a.result}
                                                        onChange={e => {
                                                            const raw = e.target.value;
                                                            setEvalAssessments(p => p.map((x, j) => {
                                                                if (j !== i) return x;
                                                                if (raw === "") return { ...x, result: 0 };
                                                                const parsed = parseFloat(raw);
                                                                return Number.isNaN(parsed) ? x : { ...x, result: parsed };
                                                            }));
                                                        }}
                                                        onBlur={() => setEvalAssessments(p => p.map((x, j) => j === i ? { ...x, result: Math.max(0, Math.min(x.result, x.maxMark || 0)) } : x))}
                                                        style={{ width: "100%", padding: "0.3rem 0.5rem", border: `1.5px solid ${a.result > a.maxMark ? "var(--danger)" : "var(--gray-200)"}`, borderRadius: 4, fontSize: "0.83rem", textAlign: "center" as const, boxSizing: "border-box" as const, background: a.result > a.maxMark ? "var(--danger-light)" : "#fff" }} />
                                                </td>
                                                <td style={{ padding: "0.45rem 0.4rem", textAlign: "center" as const }}>
                                                    <button onClick={() => setEvalAssessments(p => p.filter((_, j) => j !== i))}
                                                        style={{ width: 24, height: 24, borderRadius: 4, border: "none", background: "var(--danger-light)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: "var(--gray-50)", borderTop: "2px solid var(--gray-200)" }}>
                                            <td colSpan={3} style={{ padding: "0.65rem 0.75rem", fontWeight: 700, fontSize: "0.85rem", textAlign: "right" as const, color: "var(--gray-700)" }}>Totals</td>
                                            <td style={{ padding: "0.65rem 0.75rem", textAlign: "center" as const, fontWeight: 800, fontSize: "0.9rem" }}>{evalTotalMax}</td>
                                            <td style={{ padding: "0.65rem 0.75rem", textAlign: "center" as const, fontWeight: 800, fontSize: "0.9rem", color: evalScore >= 90 ? "var(--success)" : evalScore >= 70 ? "var(--primary-600)" : "var(--warning)" }}>
                                                <strong>{evalTotalResult}</strong><span style={{ fontSize: "0.75rem", color: "var(--gray-400)", fontWeight: 400 }}>/{evalTotalMax}</span>
                                            </td>
                                            <td />
                                        </tr>
                                        <tr style={{ background: evalScore >= 90 ? "#f0fdf4" : evalScore >= 70 ? "var(--primary-50)" : "#fffbeb" }}>
                                            <td colSpan={6} style={{ padding: "0.6rem 0.75rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" as const }}>
                                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-600)" }}>
                                                        Final Score: <strong style={{ fontSize: "1rem", color: evalScore >= 90 ? "var(--success)" : evalScore >= 70 ? "var(--primary-600)" : "var(--warning)" }}>{evalScore}%</strong>
                                                    </span>
                                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-600)" }}>
                                                        Grade: <strong style={{ fontSize: "1.15rem", color: evalScore >= 90 ? "var(--success)" : evalScore >= 70 ? "var(--primary-600)" : "var(--warning)" }}>{evalGrade}</strong>
                                                    </span>
                                                    {evalTotalMax !== 100 && evalTotalMax > 0 && (
                                                        <span style={{ fontSize: "0.72rem", color: "#b45309", background: "#fef3c7", padding: "0.15rem 0.5rem", borderRadius: 4 }}>⚠ Total max marks = {evalTotalMax} (not 100)</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Add Row */}
                            <button disabled={saveEvalBusy} onClick={() => setEvalAssessments(p => [...p, { id: Date.now(), name: "New Assessment", type: "continuous", maxMark: 10, result: 0 }])}
                                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.875rem", borderRadius: 4, border: "1.5px dashed var(--primary-300)", background: "var(--primary-50)", color: "var(--primary-600)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", marginBottom: "1.25rem" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Add Assessment Row
                            </button>

                            {/* Feedback */}
                            <label style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--gray-600)", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: "0.4rem" }}>Feedback for Student (optional)</label>
                            <textarea disabled={saveEvalBusy} value={evalComment} onChange={e => setEvalComment(e.target.value)} rows={3}
                                placeholder="E.g. 'Great work on the mid-term. Focus on exam technique for the final.'"
                                style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" as const }} />
                        </div>

                        {/* ── Footer ── */}
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", padding: "1rem 1.5rem", borderTop: "1.5px solid var(--gray-100)", flexShrink: 0 }}>
                            <button className="btn btn-secondary" disabled={saveEvalBusy} onClick={() => setEvaluating(null)}>Cancel</button>
                            <button className="btn btn-outline" disabled={saveEvalBusy} onClick={() => saveEval(false)} style={{ display: "flex", alignItems: "center", gap: "0.35rem", opacity: saveEvalBusy ? 0.75 : 1 }}>
                                {saveEvalBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {saveEvalBusy ? "Saving..." : "Save Only"}
                            </button>
                            <button className="btn btn-primary" disabled={saveEvalBusy} onClick={() => saveEval(true)} style={{ display: "flex", alignItems: "center", gap: "0.35rem", opacity: saveEvalBusy ? 0.75 : 1 }}>
                                {saveEvalBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {saveEvalBusy ? "Sending..." : "Save & Send to Student"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showPublishConfirm && (
                <div className="modal-overlay" onClick={() => setShowPublishConfirm(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Publish</h3>
                            <button className="modal-close" onClick={() => setShowPublishConfirm(false)} aria-label="Close confirmation">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ fontSize: "0.9rem", color: "var(--gray-700)", lineHeight: 1.65 }}>
                            Publish <strong>{quizTitle || "this quiz"}</strong> now for <strong>{classGroup}</strong>? This will also add the questions to the exam bank.
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPublishConfirm(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" disabled={publishBusy} onClick={() => void handlePublishConfirm()} style={{ display: "flex", alignItems: "center", gap: "0.35rem", opacity: publishBusy ? 0.75 : 1 }}>
                                {publishBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {publishBusy ? "Publishing..." : "Confirm Publish"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showScheduleModal && (
                <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Schedule Quiz</h3>
                            <button className="modal-close" onClick={() => setShowScheduleModal(false)} aria-label="Close schedule">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                            <p style={{ fontSize: "0.88rem", color: "var(--gray-600)", lineHeight: 1.6 }}>
                                Choose when this quiz should open for students. It will appear in announcements as an upcoming quiz.
                            </p>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Open Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    value={scheduledOpenAt}
                                    onChange={(e) => setScheduledOpenAt(e.target.value)}
                                    style={{ padding: "0.75rem 1rem", background: "var(--gray-50)", border: "1.5px solid var(--gray-200)", borderRadius: "4px", fontSize: "0.9rem", fontFamily: "inherit", width: "100%" }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => {
                                if (!scheduledOpenAt) { showToast("Choose date and time for schedule", false); return; }
                                setShowScheduleModal(false);
                                setShowScheduleConfirm(true);
                            }}>Continue</button>
                        </div>
                    </div>
                </div>
            )}

            {showScheduleConfirm && (
                <div className="modal-overlay" onClick={() => setShowScheduleConfirm(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Schedule</h3>
                            <button className="modal-close" onClick={() => setShowScheduleConfirm(false)} aria-label="Close confirmation">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ fontSize: "0.9rem", color: "var(--gray-700)", lineHeight: 1.65 }}>
                            Schedule <strong>{quizTitle || "this quiz"}</strong> for <strong>{classGroup}</strong> to open at <strong>{scheduledOpenAt ? new Date(scheduledOpenAt).toLocaleString() : "-"}</strong>? This will add questions to the exam bank and create an upcoming announcement.
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowScheduleConfirm(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" disabled={scheduleBusy} onClick={() => void handleScheduleConfirm()} style={{ display: "flex", alignItems: "center", gap: "0.35rem", opacity: scheduleBusy ? 0.75 : 1 }}>
                                {scheduleBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {scheduleBusy ? "Scheduling..." : "Confirm Schedule"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CSV Column Picker Modal removed ── */}

            <PageHeader
                kicker="Assessment"
                title="Exams & Assessments"
                subtitle="Create quizzes, manage your exam bank, and review student grades."
                icon={<FileText size={22} />}
                variant="light"
                actions={<TermSelector academicYearId={activeYearId || null} readOnly={false} />}
            />

            {apiErr && (
                <div className="card" style={{ marginBottom: "1rem", padding: "0.85rem 1rem", color: "var(--danger)", border: "1.5px solid var(--danger-light)", background: "var(--danger-light)" }}>
                    {apiErr}
                </div>
            )}

            <div className="tabs" style={{ marginBottom: "1.5rem" }}>
                <button className={`tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>Create Quiz</button>
                <button className={`tab ${activeTab === "bank" ? "active" : ""}`} onClick={() => setActiveTab("bank")}>Exam Bank ({bank.length})</button>
                <button className={`tab ${activeTab === "results" ? "active" : ""}`} onClick={() => setActiveTab("results")}>Results &amp; Grades</button>
            </div>

            {/* ── CREATE ── */}
            {activeTab === "create" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* Meta */}
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: "1rem" }}>Quiz Details</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div className="input-group"><label>Quiz Title</label><div className="input-field"><input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder={`e.g., ${subject} Chapter Quiz`} /></div></div>
                                <div className="input-group"><label>Subject</label>
                                    <select
                                        value={selectedSubject}
                                        onChange={(e) => setSelectedSubject(e.target.value)}
                                        style={{ padding: "0.75rem 1rem", background: "#fff", border: "1.5px solid var(--gray-200)", borderRadius: "12px", fontSize: "0.9rem", color: "var(--gray-700)", fontWeight: 600, width: "100%" }}
                                    >
                                        <option value="" disabled>
                                            {subjectOptions.length > 0 ? "Select your subject" : "No assigned subjects available"}
                                        </option>
                                        {subjectOptions.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--gray-500)" }}>
                                        Assigned subjects from your class offerings
                                    </div>
                                </div>
                                <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                                    <label>Classes</label>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem", padding: "1rem", background: "var(--gray-50)", border: "1.5px solid var(--gray-200)", borderRadius: "12px" }}>
                                        {offeringsForClassSelect.map(o => (
                                            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOfferingIds.includes(o.id)}
                                                    onChange={e => {
                                                        const id = o.id;
                                                        if (e.target.checked) {
                                                            setSelectedOfferingIds(p => [...p, id]);
                                                            if (!subject) {
                                                                const sName = (o as any).subjectName || (o as any).subject?.name;
                                                                if (sName) setSubject(sName);
                                                                else if (user?.subject) setSubject(user.subject);
                                                            }
                                                        } else {
                                                            setSelectedOfferingIds(p => p.filter(x => x !== id));
                                                        }
                                                    }}
                                                />
                                                {offeringLabel(o)}
                                            </label>
                                        ))}
                                        {offerings.length === 0 && <span style={{ fontSize: "0.9rem", color: "var(--gray-500)" }}>No classes assigned for this year</span>}
                                        {offerings.length > 0 && offeringsForClassSelect.length === 0 && (
                                            <span style={{ fontSize: "0.9rem", color: "var(--gray-500)" }}>No class matches the selected subject ({selectedSubject || "—"})</span>
                                        )}
                                    </div>
                                </div>
                                <div className="input-group"><label>Duration (min)</label><div className="input-field"><input type="number" value={duration} min={5} max={180} onChange={e => setDuration(e.target.value)} /></div></div>
                                <div className="input-group"><label>Minimum Stay (min)</label><div className="input-field"><input type="number" value={minStayMinutes} min={0} max={Math.max(0, Number.parseInt(duration, 10) || 30)} onChange={e => setMinStayMinutes(e.target.value)} /></div><div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--gray-500)" }}>Students cannot submit before this time elapses.</div></div>
                            </div>
                        </div>

                        {/* Question editor */}
                        <div className="card">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                                <h3 className="card-title">Question {activeQ + 1} of {questions.length}</h3>
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                    <label style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>Points:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={q.points === 0 ? "" : q.points}
                                        onChange={e => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                                updateQ({ points: 0 });
                                                return;
                                            }
                                            const parsed = parseInt(raw, 10);
                                            if (!Number.isNaN(parsed)) updateQ({ points: parsed });
                                        }}
                                        onBlur={() => {
                                            if (!q.points || q.points < 1) updateQ({ points: 1 });
                                            if (q.points > 20) updateQ({ points: 20 });
                                        }}
                                        onFocus={(e) => e.currentTarget.select()}
                                        style={{ width: 52, padding: "0.3rem 0.5rem", border: "1.5px solid var(--gray-200)", borderRadius: 4, fontSize: "0.85rem", textAlign: "center" as const }}
                                    />
                                    {questions.length > 1 && (
                                        <button onClick={() => removeQuestion(activeQ)} style={{ padding: "0.3rem 0.65rem", borderRadius: 4, border: "1.5px solid var(--danger-light)", background: "var(--danger-light)", color: "var(--danger)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>Remove</button>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.875rem" }}>
                                <div className="input-group">
                                    <label>Question Type</label>
                                    <Select value={q.type} onChange={e => updateQ({ type: e.target.value as any, correct: "" })} style={{ padding: "0.6rem", borderRadius: 8, border: "1.5px solid var(--gray-200)", width: "100%", fontSize: "0.85rem" }}>
                                        <option value="mcq">Multiple Choice (Choose)</option>
                                        <option value="truefalse">True / False</option>
                                        <option value="fillin">Blank Space (Fill in)</option>
                                    </Select>
                                </div>
                            </div>

                            {/* Subject-aware field - snippets, tips, placeholder all derived from subject */}
                            <LatexField label="Question Text" value={q.text} onChange={v => updateQ({ text: v })} rows={4} placeholder={q.type === "fillin" ? "Type question, use ____ for blank" : (SUBJECT_CONFIG[subject]?.placeholder ?? "Type question here…")} subject={subject} />

                            {q.type === "mcq" && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
                                    {(["A", "B", "C", "D"] as const).map(opt => (
                                        <LatexField key={opt} label={`Option ${opt}`} value={q.options[opt]} onChange={v => updateQ({ options: { ...q.options, [opt]: v } })} rows={2} placeholder={`Option ${opt}`} mini subject={subject} />
                                    ))}
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--gray-600)", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>Correct Answer</label>
                                {q.type === "mcq" && (
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        {(["A", "B", "C", "D"] as const).map(o => (
                                            <button key={o} onClick={() => updateQ({ correct: o })} className={`btn ${q.correct === o ? "btn-primary" : "btn-secondary"}`} style={{ width: 48, position: "relative" as const }}>
                                                {o}
                                                {q.correct === o && (
                                                    <span style={{ position: "absolute", top: -6, right: -6, width: 14, height: 14, borderRadius: "50%", background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {q.type === "truefalse" && (
                                    <div style={{ display: "flex", gap: "0.75rem" }}>
                                        <button onClick={() => updateQ({ correct: "A" })} className={`btn ${q.correct === "A" ? "btn-success" : "btn-secondary"}`} style={{ flex: 1, height: 42, background: q.correct === "A" ? "var(--success)" : "transparent", color: q.correct === "A" ? "#fff" : "var(--gray-600)" }}>True</button>
                                        <button onClick={() => updateQ({ correct: "B" })} className={`btn ${q.correct === "B" ? "btn-danger" : "btn-secondary"}`} style={{ flex: 1, height: 42, background: q.correct === "B" ? "var(--danger)" : "transparent", color: q.correct === "B" ? "#fff" : "var(--gray-600)" }}>False</button>
                                    </div>
                                )}

                                {q.type === "fillin" && (
                                    <div className="input-field">
                                        <input value={q.correct} onChange={e => updateQ({ correct: e.target.value as any })} placeholder="Correct word(s)" style={{ background: "#fff" }} />
                                    </div>
                                )}

                                {q.correct && q.type === "mcq" && <p style={{ fontSize: "0.78rem", color: "var(--success)", marginTop: "0.4rem", fontWeight: 500 }}>✓ Option {q.correct} is correct</p>}
                                {q.correct && q.type !== "mcq" && <p style={{ fontSize: "0.78rem", color: "var(--success)", marginTop: "0.4rem", fontWeight: 500 }}>✓ Correct answer set</p>}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button type="button" className="btn btn-secondary" onClick={addQuestion} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Add Question
                            </button>
                            <button type="button" className="btn btn-outline" disabled={saveBankBusy} onClick={() => void saveQuestionsToBank()} style={{ display: "flex", alignItems: "center", gap: "0.4rem", opacity: saveBankBusy ? 0.75 : 1 }}>
                                {saveBankBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {saveBankBusy ? "Saving..." : "Save to Bank"}
                            </button>
                            <button type="button" className="btn btn-outline" disabled={scheduleBusy} onClick={() => {
                                const error = getQuizValidationError();
                                if (error) { showToast(error, false); return; }
                                setShowScheduleModal(true);
                            }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", opacity: scheduleBusy ? 0.75 : 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                {scheduleBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid var(--gray-300)", borderTopColor: "var(--primary-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {scheduleBusy ? "Preparing..." : "Schedule Quiz"}
                            </button>
                            <button type="button" className="btn btn-primary" disabled={publishBusy} onClick={() => {
                                const error = getQuizValidationError();
                                if (error) { showToast(error, false); return; }
                                setShowPublishConfirm(true);
                            }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", opacity: publishBusy ? 0.75 : 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" /></svg>
                                {publishBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                {publishBusy ? "Publishing..." : "Publish Quiz"}
                            </button>
                        </div>
                    </div>

                    {/* Right: navigator + rendered LaTeX ref */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "sticky" as const, top: "1rem" }}>
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: "0.875rem" }}>Questions</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 380, overflowY: "auto" as const }}>
                                {questions.map((qq, i) => (
                                    <button key={qq.id} onClick={() => setActiveQ(i)} style={{ padding: "0.6rem 0.75rem", borderRadius: 4, textAlign: "left" as const, border: `2px solid ${activeQ === i ? "var(--primary-400)" : "var(--gray-200)"}`, background: activeQ === i ? "var(--primary-50)" : "#fff", cursor: "pointer" }}>
                                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: activeQ === i ? "var(--primary-600)" : "var(--gray-600)" }}>Q{i + 1}</div>
                                        <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{qq.text ? qq.text.replace(/\$[^$]*\$/g, "[math]").slice(0, 45) : <em>No text yet</em>}</div>
                                        <div style={{ marginTop: 3, display: "flex", gap: "0.25rem" }}>
                                            {qq.correct && <span style={{ fontSize: "0.62rem", padding: "0.1rem 0.35rem", borderRadius: 4, background: "var(--success-light)", color: "#065f46", fontWeight: 600 }}>Ans: {qq.correct}</span>}
                                            <span style={{ fontSize: "0.62rem", padding: "0.1rem 0.35rem", borderRadius: 4, background: "var(--gray-100)", color: "var(--gray-500)" }}>{qq.points}pt</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div style={{ marginTop: "0.875rem", padding: "0.65rem", background: "var(--gray-50)", borderRadius: 4 }}>
                                <div style={{ fontSize: "0.76rem", color: "var(--gray-500)" }}>{questions.length} question(s) · {questions.reduce((s, qq) => s + qq.points, 0)} pts · {duration} min</div>
                            </div>
                        </div>

                        {/* Subject-specific reference card */}
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: "0.1rem", fontSize: "0.82rem" }}>{SUBJECT_CONFIG[subject]?.icon} {subject} Reference</h3>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.5rem" }}>What you type → how it looks</div>
                            {(SUBJECT_CONFIG[subject]?.ref ?? []).map(({ name, tex, note }) => {
                                let rendered = tex;
                                try { rendered = katex.renderToString(tex, { displayMode: false, throwOnError: false }); } catch {}
                                return (
                                    <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.73rem", padding: "0.3rem 0", borderBottom: "1px solid var(--gray-100)", gap: "0.4rem" }}>
                                        <code style={{ color: "var(--primary-700)", background: "var(--primary-50)", padding: "0.1rem 0.35rem", borderRadius: 4, fontSize: "0.68rem", flexShrink: 0, maxWidth: 90 }}>{name}</code>
                                        {note && <span style={{ color: "var(--gray-400)", fontSize: "0.65rem", flex: 1 }}>{note}</span>}
                                        <span dangerouslySetInnerHTML={{ __html: rendered }} />
                                    </div>
                                );
                            })}
                            <div style={{ marginTop: "0.6rem", padding: "0.5rem", background: "var(--primary-50)", borderRadius: 4, fontSize: "0.68rem", color: "var(--primary-700)" }}>
                                Wrap formulas/symbols in <strong>$ dollar signs $</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── BANK ── */}
            {activeTab === "bank" && (
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Exam Bank ({filteredBank.length})</h3>
                            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "var(--gray-500)", maxWidth: 520 }}>
                                {selectedSubject?.trim()
                                    ? `Filtered by selected subject (${selectedSubject}) and currently selected class set (${selectedOfferingIds.length || offeringsForClassSelect.length} class${(selectedOfferingIds.length || offeringsForClassSelect.length) === 1 ? "" : "es"}).`
                                    : "Questions are limited to your assigned classes."}
                            </p>
                        </div>
                        <div className="header-search" style={{ width: 240 }}>
                            <input value={bankSearch} onChange={e => { setBankSearch(e.target.value); setBankPage(1); }} placeholder="Search questions or subject…" />
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Question</th><th>Subject</th><th>Type</th><th>Used</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filteredBank.slice((bankPage - 1) * bankRows, bankPage * bankRows).map(item => (
                                    <tr key={item.id}>
                                        <td style={{ maxWidth: 320 }}><div dangerouslySetInnerHTML={{ __html: renderLatex(item.q) }} style={{ fontSize: "0.875rem", fontWeight: 500 }} /></td>
                                        <td><span className="badge badge-primary">{item.subj}</span></td>
                                        <td style={{ fontSize: "0.85rem" }}>{item.type}</td>
                                        <td style={{ fontSize: "0.85rem" }}>{item.used}×</td>
                                        <td>
                                            <div style={{ display: "flex", gap: "0.375rem" }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => editFromBank(item)}>Edit</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => useFromBank(item)}>Use</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredBank.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem", fontStyle: "italic" }}>
                                            {bank.length === 0
                                                ? "No questions in your subject bank yet. Save from the Create tab or publish a quiz."
                                                : "No questions match your search."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredBank.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                            <TablePagination
                                total={filteredBank.length}
                                page={bankPage}
                                rowsPerPage={bankRows}
                                onPageChange={setBankPage}
                                onRowsPerPageChange={(r) => {
                                    setBankRows(r);
                                    setBankPage(1);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── RESULTS ── */}
            {activeTab === "results" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {/* Live Proctoring Section */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Live Exam Monitoring
                            </h3>
                        </div>
                        <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                            {publishedExams.filter(ex => ex.published).map(ex => {
                                const isLive = new Date(ex.opensAt) <= new Date() && new Date(ex.closesAt) >= new Date();
                                const roster = rosterByExam[ex.id] || [];
                                const activeCount = roster.filter(s => s.status === 'in_progress').length;
                                
                                return (
                                    <div key={ex.id} style={{ 
                                        padding: "1.25rem", borderRadius: "16px", background: "var(--gray-50)", 
                                        border: "1.5px solid var(--gray-100)"
                                    }}>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.5rem" }}>{ex.title}</div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: isLive ? "var(--success)" : "var(--gray-400)" }}>
                                                {isLive ? "● LIVE NOW" : "○ INACTIVE"}
                                            </span>
                                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-500)" }}>{activeCount} active students</span>
                                        </div>
                                        <button 
                                            onClick={() => setMonitoringExam(ex)}
                                            className="btn btn-primary btn-sm" 
                                            style={{ width: "100%", justifyContent: "center" }}
                                        >
                                            Launch Monitor
                                        </button>
                                    </div>
                                );
                            })}
                            {publishedExams.filter(ex => ex.published).length === 0 && (
                                <div style={{ gridColumn: "1 / -1", padding: "2rem", textAlign: "center", color: "var(--gray-400)", border: "1.5px dashed var(--gray-200)", borderRadius: "16px", fontSize: "0.85rem" }}>
                                    No published exams found to monitor.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Student Results</h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-primary btn-sm" disabled={sendAllBusy} onClick={async () => {
                                    setSendAllBusy(true);
                                    try {
                                        const now = new Date().toISOString().slice(0, 10);
                                        const updated = results.map(r => r.sent ? r : { ...r, sent: true, sentAt: now });
                                        setResults(updated);
                                        for (const r of updated) {
                                            if (r._attemptId) {
                                                try { await apiReleaseAttempt(r._attemptId); } catch { /* best-effort */ }
                                            }
                                        }
                                        showToast("All grades sent ✓");
                                    } finally {
                                        setSendAllBusy(false);
                                    }
                                }} style={{ opacity: sendAllBusy ? 0.75 : 1, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    {sendAllBusy && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                    {sendAllBusy ? "Sending..." : "Send All Grades"}
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={downloadPDF} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    Download PDF
                                </button>
                            </div>
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Student</th><th>Quiz</th><th>Score</th><th>Grade</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {results.slice((resultsPage - 1) * resultsRows, resultsPage * resultsRows).map((s, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td style={{ fontSize: "0.85rem" }}>{s.quiz}</td>
                                            <td style={{ fontWeight: 700, color: s.score >= 90 ? "var(--success)" : s.score >= 80 ? "var(--primary-600)" : "var(--warning)" }}>{s.score}%</td>
                                            <td><span className={`badge ${s.score >= 90 ? "badge-success" : s.score >= 80 ? "badge-primary" : "badge-warning"}`}>{s.grade}</span></td>
                                            <td>{s.sent ? <span className="badge badge-success">Sent</span> : <span className="badge badge-warning">Pending</span>}</td>
                                            <td>
                                                <div style={{ display: "flex", gap: "0.375rem" }}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => openEvaluate(s)}>Evaluate</button>
                                                        {!s.sent && <button className="btn btn-primary btn-sm" disabled={sendingGradeId === s._attemptId} onClick={async () => {
                                                            const key = s._attemptId ?? `${i}`;
                                                            setSendingGradeId(key);
                                                            try {
                                                                const now = new Date().toISOString().slice(0, 10);
                                                                const updated = { ...s, sent: true, sentAt: now };
                                                                setResults(p => p.map((r, ri) => ri === i ? updated : r));
                                                                if (s._attemptId) {
                                                                    try { await apiReleaseAttempt(s._attemptId); } catch { /* best-effort */ }
                                                                }
                                                                showToast(`Grade sent to ${s.name} ✓`);
                                                            } finally {
                                                                setSendingGradeId(null);
                                                            }
                                                        }} style={{ opacity: sendingGradeId === s._attemptId ? 0.75 : 1, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                            {sendingGradeId === s._attemptId && <div className="spinner" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                                                            {sendingGradeId === s._attemptId ? "Sending..." : "Send Grade"}
                                                        </button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {results.length > 0 && (
                            <div style={{ marginTop: "1rem" }}>
                                <TablePagination
                                    total={results.length}
                                    page={resultsPage}
                                    rowsPerPage={resultsRows}
                                    onPageChange={setResultsPage}
                                    onRowsPerPageChange={(r) => {
                                        setResultsRows(r);
                                        setResultsPage(1);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isClient && monitoringExam && createPortal(
                <ExamMonitor exam={monitoringExam} onClose={() => setMonitoringExam(null)} />,
                document.body
            )}

            {toast && (
                <RealtimeToast 
                    toast={toast} 
                    onClose={() => setToast(null)} 
                />
            )}
        </div>
    );
}

