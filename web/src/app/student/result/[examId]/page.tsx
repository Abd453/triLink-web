"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAttemptResult, type AttemptResult } from "@/lib/admin-api";
import { toLetterGrade } from "@/lib/grading";

type QuestionType = "mcq" | "truefalse" | "fillin";

export default function ExamResult() {
    const router = useRouter();
    const params = useParams<{ examId: string }>();
    const attemptId = params?.examId ?? "";

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [data, setData] = useState<AttemptResult | null>(null);

    useEffect(() => {
        if (!attemptId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                const result = await getAttemptResult(attemptId);
                if (!cancelled) setData(result);
            } catch (e) {
                if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Failed to load result");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [attemptId]);

    if (loading) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-500)" }}>
                Loading result…
            </div>
        );
    }

    if (loadErr || !data) {
        const pending = /release|released|not available|not found|pending/i.test(loadErr || "");
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
                <div style={{ maxWidth: 520, textAlign: "center", background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 18, padding: "2rem" }}>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--gray-900)" }}>{pending ? "Result pending release" : "Could not load result"}</h2>
                    <p style={{ color: pending ? "var(--gray-600)" : "var(--danger)", fontWeight: pending ? 500 : 600, lineHeight: 1.6 }}>
                        {pending
                            ? "Your attempt has been submitted, but the teacher has not released the result yet. Check back after grading is complete."
                            : loadErr || "Result not available yet."}
                    </p>
                </div>
                <button onClick={() => router.push("/student/dashboard")} style={{ padding: "0.6rem 1.5rem", borderRadius: 10, background: "var(--primary-500)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>Back to Dashboard</button>
            </div>
        );
    }

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

    // Build question review data
    const questions = (data.questions || []).map((q, i) => {
        let options: string[] | undefined;
        if (q.optionsJson) { try { options = JSON.parse(q.optionsJson); } catch { /* ignore */ } }
        let type: QuestionType = "fillin";
        if (q.type === "mcq" || q.type === "choose") type = "mcq";
        else if (q.type === "truefalse") type = "truefalse";
        else if (q.type === "fillin") type = "fillin";
        return {
            id: q.id,
            order: q.orderIndex + 1,
            type,
            text: q.stem,
            options,
            correctAnswer: q.answerKey ?? "",
            studentAnswer: q.studentAnswer ?? "",
            points: q.points,
        };
    });

    const scoreVal = data.score ?? 0;
    const maxPoints = data.maxPoints || 100;
    const scorePercent = Math.round((scoreVal / maxPoints) * 100);
    const correct = questions.filter(q => q.studentAnswer && q.correctAnswer && q.studentAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()).length;
    const unanswered = questions.filter(q => !q.studentAnswer).length;
    const wrong = questions.length - correct - unanswered;
    const submittedAtLabel = new Date(data.submittedAt).toLocaleString();
    const releasedAtLabel = data.releasedAt ? new Date(data.releasedAt).toLocaleString() : "Pending";
    const tabViolations = data.violations?.length ?? 0;

    const gradeLetter = toLetterGrade(scorePercent);
    const gradeColor = gradeLetter.startsWith("A")
        ? "var(--success)"
        : gradeLetter.startsWith("B")
            ? "var(--primary-600)"
            : gradeLetter.startsWith("C")
                ? "var(--warning)"
                : gradeLetter.startsWith("D")
                    ? "#f97316"
                    : "var(--danger)";

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <button onClick={() => router.push("/student/dashboard")} style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        background: "none", border: "none", color: "var(--primary-500)",
                        fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                    }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg> Back to Dashboard</button>
                    <button onClick={() => downloadResultCsv(data, questions, scorePercent, gradeLetter)} style={{ padding: "0.55rem 1rem", borderRadius: 10, background: "#fff", color: "var(--primary-600)", border: "1px solid var(--primary-200)", fontWeight: 700, cursor: "pointer" }}>Download CSV</button>
                </div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)", display: "flex", alignItems: "center", gap: "0.5rem" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg> Exam Result</h1>
                <p style={{ fontSize: "0.875rem", color: "var(--gray-500)", marginTop: "0.25rem" }}>{data.examTitle}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--gray-400)", marginTop: "0.4rem", lineHeight: 1.5 }}>
                    Submitted: {submittedAtLabel} · Released: {releasedAtLabel}
                </p>
            </div>

            {/* Score Overview */}
            <div className="result-overview">
                <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-100)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke={gradeColor} strokeWidth="8"
                            strokeDasharray={`${(scorePercent / 100) * 327} 327`}
                            strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray 1s ease" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "2rem", fontWeight: 900, color: gradeColor }}>{scorePercent}%</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)" }}>Grade {gradeLetter}</span>
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.75rem" }}>{data.examTitle}</h2>
                    <div className="result-stats-grid">
                        <div style={{ background: "var(--success-light)", borderRadius: 12, padding: "0.75rem 1rem" }}>
                            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--success)" }}>{correct}</div>
                            <div style={{ fontSize: "0.75rem", color: "#065f46" }}>Correct</div>
                        </div>
                        <div style={{ background: "var(--danger-light)", borderRadius: 12, padding: "0.75rem 1rem" }}>
                            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--danger)" }}>{wrong}</div>
                            <div style={{ fontSize: "0.75rem", color: "#991b1b" }}>Wrong</div>
                        </div>
                        <div style={{ background: "var(--gray-100)", borderRadius: 12, padding: "0.75rem 1rem" }}>
                            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-600)" }}>{unanswered}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>Unanswered</div>
                        </div>
                        <div style={{ background: "var(--primary-50)", borderRadius: 12, padding: "0.75rem 1rem" }}>
                            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary-600)" }}>{scoreVal}/{maxPoints}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--primary-500)" }}>Score</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Violation Warning */}
            {tabViolations > 0 && (
                <div style={{ background: "var(--danger-light)", border: "1.5px solid var(--danger)", borderRadius: 12, padding: "0.875rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <div>
                        <div style={{ fontWeight: 700, color: "#991b1b", fontSize: "0.9rem" }}>Integrity Violations Recorded</div>
                        <div style={{ fontSize: "0.8rem", color: "#991b1b" }}>{tabViolations} tab-switch or focus-loss event(s) were detected during the exam.</div>
                    </div>
                </div>
            )}

            {/* Question Review */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>Question Review</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
                {questions.map(q => {
                    const isCorrect = !!q.studentAnswer && !!q.correctAnswer && q.studentAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                    const isUnanswered = !q.studentAnswer;
                    return (
                        <div key={q.id} style={{
                            background: "#fff", borderRadius: 16, padding: "1.25rem",
                            border: `1.5px solid ${isCorrect ? "var(--success)" : isUnanswered ? "var(--gray-200)" : "var(--danger)"}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ width: 28, height: 28, borderRadius: 8, background: isCorrect ? "var(--success)" : isUnanswered ? "var(--gray-400)" : "var(--danger)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem" }}>{q.order}</span>
                                    <span style={{
                                        padding: "0.2rem 0.5rem", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600,
                                        background: q.type === "mcq" ? "var(--primary-50)" : q.type === "truefalse" ? "var(--purple-light)" : "var(--warning-light)",
                                        color: q.type === "mcq" ? "var(--primary-600)" : q.type === "truefalse" ? "#5b21b6" : "#92400e",
                                    }}>
                                        {q.type === "mcq" ? "MCQ" : q.type === "truefalse" ? "T/F" : "Fill"}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isCorrect ? "var(--success)" : isUnanswered ? "var(--gray-500)" : "var(--danger)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                    {isCorrect ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Correct</> : isUnanswered ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg> Skipped</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> Wrong</>}
                                </span>
                            </div>
                            <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.75rem", lineHeight: 1.5 }}>{q.text}</p>
                            <div className="result-answer-row">
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--gray-400)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Your Answer</div>
                                    <div style={{ padding: "0.5rem 0.75rem", borderRadius: 8,
                                        background: isCorrect ? "var(--success-light)" : isUnanswered ? "var(--gray-50)" : "var(--danger-light)",
                                        fontWeight: isUnanswered ? 400 : 600,
                                        color: isCorrect ? "#065f46" : isUnanswered ? "var(--gray-400)" : "#991b1b",
                                        fontStyle: isUnanswered ? "italic" : "normal",
                                    }}>
                                        {q.studentAnswer || (q.type === "fillin" ? "Left blank" : "Not answered")}
                                    </div>
                                </div>
                                {!isCorrect && q.correctAnswer && (
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--gray-400)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Correct Answer</div>
                                        <div style={{ padding: "0.5rem 0.75rem", borderRadius: 8, background: "var(--success-light)", fontWeight: 600, color: "#065f46" }}>{q.correctAnswer}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function csvCell(value: unknown) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadResultCsv(
    data: AttemptResult,
    questions: Array<{ order: number; text: string; studentAnswer: string; correctAnswer: string; points: number }>,
    scorePercent: number,
    gradeLetter: string,
) {
    const rows = [
        ["Exam", data.examTitle],
        ["Attempt ID", data.attemptId],
        ["Score", `${data.score ?? 0}/${data.maxPoints}`],
        ["Percent", `${scorePercent}%`],
        ["Grade", gradeLetter],
        ["Submitted", data.submittedAt],
        ["Released", data.releasedAt ?? ""],
        [],
        ["Question", "Prompt", "Student Answer", "Correct Answer", "Points"],
        ...questions.map((q) => [q.order, q.text, q.studentAnswer, q.correctAnswer, q.points]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.examTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "exam"}-result.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
