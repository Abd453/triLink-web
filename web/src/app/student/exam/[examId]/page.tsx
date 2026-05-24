"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    getExamQuestions,
    startExamAttempt,
    saveAttemptAnswers,
    submitAttempt as apiSubmitAttempt,
    recordViolation,
    listStudentExams,
    listEnrollments,
    getActiveAcademicYear,
    type ExamQuestionForStudent,
    type Exam,
} from "@/lib/admin-api";
import { chatRealtime } from "@/lib/chat-realtime";
import { getStoredUser } from "@/lib/auth";

type QuestionType = "mcq" | "truefalse" | "fillin" | "long_answer";

interface Question {
    id: string;
    type: QuestionType;
    text: string;
    options?: string[];
    order: number;
    points: number;
}

interface ExamData {
    id: string;
    title: string;
    duration: number;
    minStayMinutes: number;
    totalQuestions: number;
    questions: Question[];
}

function normalizeQuestionType(rawType: string, options?: string[]): QuestionType {
    const t = rawType.trim().toLowerCase();
    if (
        t === "truefalse" ||
        t === "true_false" ||
        t === "true-false" ||
        t === "true/false" ||
        t === "boolean" ||
        t === "bool" ||
        (t.includes("true") && t.includes("false"))
    ) {
        return "truefalse";
    }
    if (t === "fillin" || t === "fill_in" || t === "fill-in" || t === "short_answer" || t === "shortanswer") {
        return "fillin";
    }
    if (t === "long_answer" || t === "longanswer" || t === "description" || t === "essay") {
        return "long_answer";
    }
    if (t === "mcq" || t === "choose" || t === "multiple_choice" || t === "multiple-choice") {
        return "mcq";
    }

    // If type is ambiguous but options look like true/false, classify it as true/false.
    if (options && options.length === 2) {
        const vals = options.map((o) => o.trim().toLowerCase());
        if (vals.includes("true") && vals.includes("false")) return "truefalse";
    }

    return "mcq";
}

function parseQuestionOptions(raw: unknown): string[] | undefined {
    if (!raw) return undefined;

    try {
        let parsed: unknown = raw;
        // Handles nested stringified JSON payloads like '"[\"A\",\"B\"]"'.
        if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
            if (typeof parsed === "string") parsed = JSON.parse(parsed);
        }
        if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v)).filter((v) => v.trim().length > 0);
        }
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            // Supports formats like { A: "...", B: "..." }.
            const ordered = [
                obj.A, obj.B, obj.C, obj.D,
                obj.a, obj.b, obj.c, obj.d,
                obj.optionA, obj.optionB, obj.optionC, obj.optionD,
                obj.option1, obj.option2, obj.option3, obj.option4,
            ]
                .filter((v) => typeof v === "string")
                .map((v) => String(v).trim())
                .filter((v) => v.length > 0);
            if (ordered.length > 0) return ordered;

            const values = Object.values(obj)
                .filter((v) => typeof v === "string")
                .map((v) => String(v).trim())
                .filter((v) => v.length > 0);
            if (values.length > 0) return values;
        }
    } catch {
        // Non-JSON string options fallback handled below.
    }

    if (typeof raw === "string" && raw.trim().length > 0) {
        return [raw.trim()];
    }

    return undefined;
}

function mapApiQuestions(raw: ExamQuestionForStudent[]): Question[] {
    const rows = [...raw].sort((a, b) => {
        const aIdx = typeof (a as any).orderIndex === "number" ? (a as any).orderIndex : Number.MAX_SAFE_INTEGER;
        const bIdx = typeof (b as any).orderIndex === "number" ? (b as any).orderIndex : Number.MAX_SAFE_INTEGER;
        return aIdx - bIdx;
    });

    return rows
        .map((item, i) => {
            const nested = (item as any).question ?? {};
            const stem = String(
                (item as any).stem ??
                nested.stem ??
                (item as any).text ??
                nested.text ??
                (item as any).questionText ??
                nested.questionText ??
                "",
            ).trim();
            const id = String((item as any).id ?? (item as any).questionId ?? nested.id ?? `q-${i}`);

            const rawOptions =
                (item as any).optionsJson ??
                nested.optionsJson ??
                (item as any).options ??
                nested.options ??
                (item as any).choices ??
                nested.choices;
            const options = parseQuestionOptions(rawOptions);
            const typeRaw = String(
                (item as any).type ??
                nested.type ??
                (item as any).questionType ??
                nested.questionType ??
                (item as any).kind ??
                nested.kind ??
                "mcq",
            );
            const qType = normalizeQuestionType(typeRaw, options);

            const safeOptions = qType === "truefalse"
                ? ["True", "False"]
                : options;

            return {
                id,
                type: qType,
                text: stem || `Question ${i + 1}`,
                options: safeOptions,
                order: i + 1,
                points: Number((item as any).points ?? 1),
            };
        })
        .filter((q) => q.text.trim().length > 0);
}

export default function ExamSession() {
    const router = useRouter();
    const params = useParams<{ examId: string }>();
    const examId = params?.examId ?? "";

    // ── Loading state ──
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [exam, setExam] = useState<ExamData | null>(null);
    const [attemptId, setAttemptId] = useState<string | null>(null);

    // ── Exam session state ──
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [flagged, setFlagged] = useState<Set<string>>(new Set());
    const [timeLeft, setTimeLeft] = useState(0);
    const [timeSpent, setTimeSpent] = useState(0);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showEarlyWarning, setShowEarlyWarning] = useState(false);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [tabViolations, setTabViolations] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [submittingNow, setSubmittingNow] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showTeacherWarning, setShowTeacherWarning] = useState(false);
    const [teacherWarningMsg, setTeacherWarningMsg] = useState("");
    const [sessionLocked, setSessionLocked] = useState(false);
    const tabViolationsRef = useRef(0);
    const submittedRef = useRef(false);
    const attemptIdRef = useRef<string | null>(null);
    const controlUnsubRef = useRef<null | (() => void)>(null);

    // ── Load exam from backend ──
    useEffect(() => {
        if (!examId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadErr(null);
            setAccessDenied(false);
            try {
                // Get exam metadata
                const year = await getActiveAcademicYear();
                if (!year) throw new Error("No active academic year");
                const exams = await listStudentExams(year.id);

                const me = getStoredUser();
                let visibleExams = exams;
                if (me?.id) {
                    try {
                        const mine = await listEnrollments({ academicYearId: year.id, studentId: me.id });
                        const allowedOfferingIds = new Set(mine.map((e) => e.classOfferingId));
                        visibleExams = exams.filter((ex) => !ex.classOfferingId || allowedOfferingIds.has(ex.classOfferingId));
                    } catch {
                        // Do not block the page if enrollment endpoint is not available for the role.
                    }
                }

                const examMeta = visibleExams.find(e => e.id === examId);
                if (!examMeta) throw new Error("This exam is not assigned to your class.");

                const opensAtMs = new Date(examMeta.opensAt).getTime();
                const strictEndsAtMs = opensAtMs + examMeta.durationMinutes * 60_000;
                const nowMs = Date.now();
                if (nowMs < opensAtMs) {
                    throw new Error("This exam has not started yet.");
                }
                if (nowMs >= strictEndsAtMs) {
                    throw new Error("This exam time window has ended.");
                }

                // Get questions
                const rawQuestions = await getExamQuestions(examId);
                const questions = mapApiQuestions(rawQuestions);
                if (questions.length === 0) {
                    throw new Error("No questions are available for this exam yet.");
                }

                // Start attempt
                const attempt = await startExamAttempt(examId);
                if (cancelled) return;

                attemptIdRef.current = attempt.id;
                setAttemptId(attempt.id);

                // Store attemptId globally for violation reporting
                (window as unknown as Record<string, string>).__currentAttemptId = attempt.id;

                // Restore previous answers if any
                if (attempt.answersJson) {
                    try {
                        const prev = JSON.parse(attempt.answersJson);
                        if (typeof prev === "object" && prev !== null) setAnswers(prev);
                    } catch { /* ignore */ }
                }

        setExam({
                    id: examMeta.id,
                    title: examMeta.title,
                    duration: examMeta.durationMinutes,
                    minStayMinutes: Math.max(0, Math.min(examMeta.durationMinutes, examMeta.minStayMinutes ?? 0)),
                    totalQuestions: questions.length,
                    questions,
                });
                setTimeLeft(Math.max(0, Math.floor((strictEndsAtMs - nowMs) / 1000)));

                // Setup realtime listener for teacher control
                const currentUser = getStoredUser();
                if (currentUser && currentUser.id) {
                    chatRealtime.connect({ id: currentUser.id, name: `${currentUser.firstName} ${currentUser.lastName}` });
                }
                controlUnsubRef.current?.();
                const unsubControl = chatRealtime.on("attempt:control", (payload) => {
                    if (payload.attemptId !== attempt.id) return;
                    if (payload.action === "force_submit") {
                        setSubmitted(true);
                    } else if (payload.action === "warn") {
                        setTeacherWarningMsg(payload.message || "A teacher has sent you a warning.");
                        setShowTeacherWarning(true);
                    } else if (payload.action === "allow_rejoin") {
                        setTeacherWarningMsg(payload.message || "Teacher approved your rejoin request.");
                        setShowTeacherWarning(true);
                    }
                });
                controlUnsubRef.current = unsubControl;
            } catch (e) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : "Failed to load exam";
                    setLoadErr(msg);
                    setAccessDenied(msg.toLowerCase().includes("not assigned to your class"));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            controlUnsubRef.current?.();
            controlUnsubRef.current = null;
        };
    }, [examId, router]);

    const question = exam?.questions[currentQ];
    const answeredCount = Object.keys(answers).length;
    const minimumTimeSeconds = exam ? exam.minStayMinutes * 60 : 0;

    // ── Timer ──
    useEffect(() => {
        if (submitted || !exam) return;
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(interval); setSubmitted(true); return 0; }
                return prev - 1;
            });
            setTimeSpent(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [submitted, exam]);

    // ── Auto-save answers every 15 seconds ──
    useEffect(() => {
        if (!attemptId || submitted) return;
        const interval = setInterval(() => {
            saveAttemptAnswers(attemptId, JSON.stringify(answers)).catch(() => {});
        }, 15000);
        return () => clearInterval(interval);
    }, [attemptId, answers, submitted]);

    // ── Tab switch / cheating prevention ──
    useEffect(() => {
        if (submitted) return;
        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabViolationsRef.current += 1;
                setTabViolations(tabViolationsRef.current);
                setShowTabWarning(true);
                const aid = attemptIdRef.current;
                if (aid) {
                    recordViolation(aid, "Tab switch detected")
                        .then((res) => {
                            if (res.locked) {
                                setSessionLocked(true);
                                setLoadErr("Your exam session was locked due to tab switch. Wait for teacher approval to rejoin.");
                                setTimeout(() => router.push("/student/dashboard"), 900);
                            }
                        })
                        .catch(() => {});
                }
            }
        };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "You are in an active exam session."; };
        const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "x"].includes(e.key.toLowerCase())) e.preventDefault();
            if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "i")) e.preventDefault();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("contextmenu", handleContextMenu);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("contextmenu", handleContextMenu);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [submitted, router]);

    // ── Fullscreen enforcement ──
    useEffect(() => {
        const enterFullscreen = () => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };
        enterFullscreen();
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && !submittedRef.current) {
                tabViolationsRef.current += 1;
                setTabViolations(tabViolationsRef.current);
                setShowTabWarning(true);
                const aid = attemptIdRef.current;
                if (aid) {
                    recordViolation(aid, "Fullscreen exit detected")
                        .then((res) => {
                            if (res.locked) {
                                setSessionLocked(true);
                                setLoadErr("Your exam session was locked after leaving fullscreen. Wait for teacher approval to rejoin.");
                                setTimeout(() => router.push("/student/dashboard"), 900);
                            }
                        })
                        .catch(() => {});
                }
                setTimeout(enterFullscreen, 500);
            }
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, []);

    // ── Submit ──
    useEffect(() => {
        if (!submitted || !attemptId) return;
        if (sessionLocked) return;
        submittedRef.current = true;
        setSubmittingNow(true);
        (async () => {
            let submittedOk = false;
            try {
                // Save final answers
                await saveAttemptAnswers(attemptId, JSON.stringify(answers));
                // Submit attempt
                await apiSubmitAttempt(attemptId);
                submittedOk = true;
            } catch (e) {
                setLoadErr(e instanceof Error ? e.message : "Failed to submit exam");
                submittedRef.current = false;
                setSubmitted(false);
                setSubmittingNow(false);
                return;
            }
            if (submittedOk) {
                router.push(`/student/result/${attemptId}`);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitted, attemptId, answers, router, sessionLocked]);

    const setAnswer = (qId: string, value: string) => setAnswers(prev => ({ ...prev, [qId]: value }));
    const toggleFlag = (qId: string) => { setFlagged(prev => { const next = new Set(prev); next.has(qId) ? next.delete(qId) : next.add(qId); return next; }); };

    const handleSubmitClick = () => {
        if (submittingNow) return;
        if (minimumTimeSeconds > 0 && timeSpent < minimumTimeSeconds) { setShowEarlyWarning(true); return; }
        setShowConfirm(true);
    };
    const confirmSubmit = () => {
        if (exam && timeSpent < (exam.duration * 60 * 0.2) && answeredCount === exam.totalQuestions) { setShowConfirm(false); setShowReport(true); return; }
        setSubmitted(true); setShowConfirm(false);
    };
    const forceSubmitAfterReport = () => { setSubmitted(true); setShowReport(false); };

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    const timePercent = exam ? (timeLeft / (exam.duration * 60)) * 100 : 100;
    const isLowTime = timeLeft < 300;

    // ── Loading state ──
    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <div className="spinner" style={{ width: 40, height: 40, border: "4px solid var(--primary-100)", borderTopColor: "var(--primary-600)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1.5rem" }} />
                    <p style={{ color: "var(--gray-500)", fontWeight: 600 }}>Initializing your exam session...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (loadErr || !exam || !question) {
        if (accessDenied) {
            return (
                <div style={{ minHeight: "100vh", background: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                    <div style={{ maxWidth: 520, width: "100%", borderRadius: 20, border: "1.5px solid var(--warning-light)", background: "#fff", padding: "2rem", boxShadow: "0 12px 28px rgba(0,0,0,0.08)", textAlign: "center" }}>
                        <div style={{ width: 58, height: 58, margin: "0 auto 1rem", borderRadius: "50%", background: "var(--warning-light)", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        </div>
                        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "0.65rem" }}>Not Assigned to Your Class</h2>
                        <p style={{ fontSize: "0.92rem", color: "var(--gray-600)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                            This exam is only available to students enrolled in its class.
                        </p>
                        <p style={{ fontSize: "0.82rem", color: "var(--gray-500)", marginBottom: "1.6rem" }}>
                            If you think this is a mistake, contact your teacher or school admin.
                        </p>
                        <button onClick={() => router.push("/student/dashboard")} style={{ padding: "0.75rem 1.4rem", borderRadius: 12, background: "var(--primary-500)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div style={{ minHeight: "100vh", background: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "var(--danger)", maxWidth: 400 }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Cannot Start Exam</div>
                    <p style={{ fontSize: "0.9rem", color: "var(--gray-600)" }}>{loadErr || "Exam data is unavailable."}</p>
                    <button onClick={() => router.push("/student/dashboard")} style={{ marginTop: "1rem", padding: "0.75rem 1.5rem", borderRadius: 12, background: "var(--primary-500)", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    /* ─── EXAM UI ─── */
    return (
        <div style={{ minHeight: "100vh", background: "var(--gray-50)", display: "flex", flexDirection: "column", userSelect: "none" }}>

            {/* Top Bar */}
            <div className="exam-topbar">
                <div className="exam-topbar-info">
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gray-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exam.title}</div>
                </div>
                <div style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.5rem 1.25rem", borderRadius: 12,
                    background: isLowTime ? "var(--danger-light)" : "var(--gray-50)",
                    border: `1.5px solid ${isLowTime ? "var(--danger)" : "var(--gray-200)"}`,
                    flexShrink: 0,
                }}>
                    <span style={{ color: isLowTime ? "#991b1b" : "var(--gray-500)", display: "flex" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
                    <span style={{
                        fontSize: "1.25rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
                        color: isLowTime ? "var(--danger)" : "var(--gray-900)",
                        animation: isLowTime ? "pulse 1s infinite" : "none",
                    }}>{formatTime(timeLeft)}</span>
                </div>
                <button onClick={handleSubmitClick} style={{
                    padding: "0.6rem 1.25rem", borderRadius: 10,
                    background: "linear-gradient(135deg, var(--success), #059669)",
                    color: "#fff", fontWeight: 700, fontSize: "0.85rem",
                    border: "none", cursor: submittingNow ? "not-allowed" : "pointer", flexShrink: 0,
                    opacity: submittingNow ? 0.7 : 1,
                    boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
                }} disabled={submittingNow}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg> {submittingNow ? "Submitting..." : "Submit"}</button>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 4, background: "var(--gray-100)" }}>
                <div style={{ height: "100%", background: isLowTime ? "var(--danger)" : "var(--primary-500)", width: `${timePercent}%`, transition: "width 1s linear" }} />
            </div>

            {/* Main Content */}
            <div className="exam-main-layout">

                {/* Question Panel */}
                <div className="exam-question-panel">
                    {/* Question Header */}
                    <div className="exam-question-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                            <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" }}>{question.order}</span>
                            <span style={{ fontSize: "0.85rem", color: "var(--gray-500)" }}>of {exam.totalQuestions}</span>
                            <span style={{
                                padding: "0.3rem 0.75rem", borderRadius: 8,
                                background: question.type === "mcq" ? "var(--primary-50)" : question.type === "truefalse" ? "var(--purple-light)" : "var(--warning-light)",
                                color: question.type === "mcq" ? "var(--primary-600)" : question.type === "truefalse" ? "#5b21b6" : "#92400e",
                                fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" as const,
                            }}>
                                {question.type === "mcq" ? "Multiple Choice" : question.type === "truefalse" ? "True / False" : "Fill in the Blank"}
                            </span>
                            <span style={{
                                padding: "0.3rem 0.75rem", borderRadius: 8,
                                background: "var(--gray-100)",
                                color: "var(--gray-600)",
                                fontWeight: 700, fontSize: "0.7rem",
                            }}>
                                {question.points} {question.points === 1 ? "Mark" : "Marks"}
                            </span>
                        </div>
                        <button onClick={() => toggleFlag(question.id)} style={{
                            display: "flex", alignItems: "center", gap: "0.4rem",
                            padding: "0.5rem 1rem", borderRadius: 10,
                            background: flagged.has(question.id) ? "var(--warning-light)" : "var(--gray-50)",
                            border: `1.5px solid ${flagged.has(question.id) ? "var(--warning)" : "var(--gray-200)"}`,
                            color: flagged.has(question.id) ? "#92400e" : "var(--gray-600)",
                            fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={flagged.has(question.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg> {flagged.has(question.id) ? "Flagged" : "Flag"}
                        </button>
                    </div>

                    {/* Question Text */}
                    <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", border: "1px solid var(--gray-100)", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <p style={{ fontSize: "1.1rem", lineHeight: 1.7, fontWeight: 500, color: "var(--gray-800)" }}>{question.text}</p>
                    </div>

                    {/* Answer Area */}
                    <div style={{ marginBottom: "2rem" }}>
                        {question.type === "mcq" && question.options?.map((opt, i) => {
                            const letter = String.fromCharCode(65 + i);
                            const isSelected = answers[question.id] === opt;
                            return (
                                <label key={i} onClick={() => setAnswer(question.id, opt)} style={{
                                    display: "flex", alignItems: "center", gap: "1rem",
                                    padding: "1rem 1.25rem", borderRadius: 14, marginBottom: "0.5rem",
                                    background: isSelected ? "var(--primary-50)" : "#fff",
                                    border: `2px solid ${isSelected ? "var(--primary-500)" : "var(--gray-200)"}`,
                                    cursor: "pointer", transition: "all 150ms ease",
                                }}>
                                    <span style={{ width: 34, height: 34, borderRadius: 10, background: isSelected ? "var(--primary-500)" : "var(--gray-100)", color: isSelected ? "#fff" : "var(--gray-600)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>{letter}</span>
                                    <span style={{ fontSize: "0.95rem", fontWeight: isSelected ? 600 : 400, color: "var(--gray-800)" }}>{opt}</span>
                                    {isSelected && <span style={{ marginLeft: "auto", color: "var(--primary-500)", display: "flex" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>}
                                </label>
                            );
                        })}
                        {question.type === "mcq" && (!question.options || question.options.length === 0) && (
                            <div style={{ borderRadius: 12, border: "1.5px solid var(--warning-light)", background: "var(--warning-light)", padding: "0.9rem 1rem", color: "#92400e", fontSize: "0.85rem", fontWeight: 600 }}>
                                Options are missing for this question. Please notify your teacher to republish the exam question options.
                            </div>
                        )}
                        {question.type === "truefalse" && (
                            <div style={{ display: "flex", gap: "1rem" }}>
                                {["True", "False"].map(opt => {
                                    const isSelected = answers[question.id] === opt;
                                    return (
                                        <button key={opt} onClick={() => setAnswer(question.id, opt)} style={{
                                            flex: 1, padding: "1.25rem", borderRadius: 14,
                                            background: isSelected ? (opt === "True" ? "var(--success-light)" : "var(--danger-light)") : "#fff",
                                            border: `2px solid ${isSelected ? (opt === "True" ? "var(--success)" : "var(--danger)") : "var(--gray-200)"}`,
                                            cursor: "pointer", fontSize: "1rem", fontWeight: 700,
                                            color: isSelected ? (opt === "True" ? "#065f46" : "#991b1b") : "var(--gray-700)",
                                        }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>{opt === "True" ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> True</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> False</>}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {question.type === "fillin" && (
                            <input type="text" value={answers[question.id] || ""} onChange={(e) => setAnswer(question.id, e.target.value)}
                                placeholder="Type your answer here..."
                                style={{ width: "100%", padding: "1rem 1.25rem", borderRadius: 14, border: "2px solid var(--gray-200)", fontSize: "1rem", background: "#fff", outline: "none" }}
                                onFocus={(e) => e.target.style.borderColor = "var(--primary-500)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--gray-200)"} />
                        )}
                        {question.type === "long_answer" && (
                            <textarea value={answers[question.id] || ""} onChange={(e) => setAnswer(question.id, e.target.value)}
                                placeholder="Write your detailed answer here..."
                                style={{ width: "100%", minHeight: "150px", padding: "1rem 1.25rem", borderRadius: 14, border: "2px solid var(--gray-200)", fontSize: "1rem", background: "#fff", outline: "none", resize: "vertical" }}
                                onFocus={(e) => e.target.style.borderColor = "var(--primary-500)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--gray-200)"} />
                        )}
                    </div>

                    {/* Nav Buttons */}
                    <div className="exam-nav-buttons">
                        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} style={{
                            padding: "0.65rem 1.5rem", borderRadius: 10, background: currentQ === 0 ? "var(--gray-100)" : "#fff",
                            border: "1.5px solid var(--gray-200)", color: currentQ === 0 ? "var(--gray-300)" : "var(--gray-700)",
                            fontWeight: 600, fontSize: "0.85rem", cursor: currentQ === 0 ? "not-allowed" : "pointer",
                        }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Prev</button>
                        <span style={{ fontSize: "0.85rem", color: "var(--gray-400)" }}>Q {currentQ + 1} of {exam.totalQuestions}</span>
                        <button onClick={() => setCurrentQ(Math.min(exam.totalQuestions - 1, currentQ + 1))} disabled={currentQ === exam.totalQuestions - 1} style={{
                            padding: "0.65rem 1.5rem", borderRadius: 10,
                            background: currentQ === exam.totalQuestions - 1 ? "var(--gray-100)" : "var(--primary-500)",
                            border: "none", color: currentQ === exam.totalQuestions - 1 ? "var(--gray-300)" : "#fff",
                            fontWeight: 600, fontSize: "0.85rem", cursor: currentQ === exam.totalQuestions - 1 ? "not-allowed" : "pointer",
                        }}>Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>
                    </div>
                </div>

                {/* Navigator Sidebar */}
                <div className="exam-navigator-sidebar">
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--gray-700)", marginBottom: "1rem" }}>Question Navigator</div>
                    <div className="nav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: "1.5rem" }}>
                        {exam.questions.map((q, i) => {
                            const isAnswered = answers[q.id] !== undefined;
                            const isFlagged = flagged.has(q.id);
                            const isCurrent = i === currentQ;
                            return (
                                <button key={q.id} onClick={() => setCurrentQ(i)} style={{
                                    width: 38, height: 38, borderRadius: 10, border: "none",
                                    background: isCurrent ? "var(--primary-500)" : isFlagged ? "var(--warning-light)" : isAnswered ? "var(--success-light)" : "var(--gray-100)",
                                    color: isCurrent ? "#fff" : isFlagged ? "#92400e" : isAnswered ? "#065f46" : "var(--gray-500)",
                                    fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", position: "relative" as const,
                                    boxShadow: isCurrent ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
                                }}>
                                    {q.order}
                                    {isFlagged && <span style={{ position: "absolute" as const, top: -4, right: -4, color: "#92400e" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg></span>}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", display: "flex", flexDirection: "column" as const, gap: "0.5rem", marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--success-light)", border: "1px solid #d1fae5", display: "inline-block" }} /> Answered ({answeredCount})</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--gray-100)", display: "inline-block" }} /> Unanswered ({exam.totalQuestions - answeredCount})</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--warning-light)", border: "1px solid #fef3c7", display: "inline-block" }} /> Flagged ({flagged.size})</div>
                    </div>
                    <div style={{ padding: "1rem", borderRadius: 12, background: "var(--gray-50)", border: "1px solid var(--gray-200)", fontSize: "0.8rem" }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Progress</div>
                        <div style={{ height: 6, background: "var(--gray-200)", borderRadius: 3, marginBottom: "0.5rem" }}>
                            <div style={{ height: "100%", background: "var(--success)", borderRadius: 3, width: `${(answeredCount / exam.totalQuestions) * 100}%`, transition: "width 200ms ease" }} />
                        </div>
                        <div style={{ color: "var(--gray-500)" }}>{answeredCount} of {exam.totalQuestions} answered</div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {showConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
                    <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", maxWidth: 420, width: "100%", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--primary-500)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /></svg></div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>Submit Exam?</h2>
                        <p style={{ color: "var(--gray-500)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>Are you sure you want to submit?</p>
                        <div style={{ background: "var(--gray-50)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                            <div>Answered: <strong>{answeredCount}/{exam.totalQuestions}</strong></div>
                            <div>Unanswered: <strong style={{ color: "var(--danger)" }}>{exam.totalQuestions - answeredCount}</strong></div>
                            <div>Flagged: <strong style={{ color: "var(--warning)" }}>{flagged.size}</strong></div>
                        </div>
                        {exam.totalQuestions - answeredCount > 0 && (
                            <div style={{ background: "var(--warning-light)", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", color: "#92400e", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> You have {exam.totalQuestions - answeredCount} unanswered question(s)!
                            </div>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button disabled={submittingNow} onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, background: "var(--gray-100)", border: "none", fontWeight: 600, cursor: submittingNow ? "not-allowed" : "pointer", color: "var(--gray-700)", opacity: submittingNow ? 0.6 : 1 }}>Go Back</button>
                            <button disabled={submittingNow} onClick={confirmSubmit} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, background: "var(--success)", border: "none", fontWeight: 700, cursor: submittingNow ? "not-allowed" : "pointer", color: "#fff", opacity: submittingNow ? 0.75 : 1 }}>{submittingNow ? "Submitting..." : "Yes, Submit"}</button>
                        </div>
                    </div>
                </div>
            )}
            {showEarlyWarning && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
                    <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", maxWidth: 420, width: "100%", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--danger)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" /></svg></div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--danger)" }}>Cannot Submit Yet</h2>
                        <p style={{ color: "var(--gray-600)", marginBottom: "1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            You must remain for at least <strong>{formatTime(minimumTimeSeconds)}</strong>.
                        </p>
                        <div style={{ background: "var(--danger-light)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem", color: "#991b1b", fontSize: "0.85rem" }}>
                            <div>Time spent: <strong>{formatTime(timeSpent)}</strong></div>
                            <div>Minimum: <strong>{formatTime(minimumTimeSeconds)}</strong></div>
                            <div>Remaining: <strong>{formatTime(Math.max(0, minimumTimeSeconds - timeSpent))}</strong></div>
                        </div>
                        <button onClick={() => setShowEarlyWarning(false)} style={{ padding: "0.75rem 2rem", borderRadius: 12, background: "var(--primary-500)", border: "none", fontWeight: 700, cursor: "pointer", color: "#fff" }}>OK, Continue Exam</button>
                    </div>
                </div>
            )}
            {showTabWarning && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
                    <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", maxWidth: 420, width: "100%", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--danger)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--danger)" }}>Tab Switch Detected!</h2>
                        <p style={{ color: "var(--gray-600)", marginBottom: "1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            You left the exam tab. This has been recorded. Excessive tab switching may result in disqualification.
                        </p>
                        <div style={{ background: "var(--danger-light)", borderRadius: 12, padding: "0.75rem", marginBottom: "1.5rem", color: "#991b1b", fontWeight: 700, fontSize: "0.9rem" }}>
                            Total violations: {tabViolations} / 3
                        </div>
                        {tabViolations >= 3 ? (
                            <button onClick={() => { setShowTabWarning(false); setSubmitted(true); }} style={{ padding: "0.75rem 2rem", borderRadius: 12, background: "var(--danger)", border: "none", fontWeight: 700, cursor: "pointer", color: "#fff", width: "100%" }}>Exam Auto-Submitted</button>
                        ) : (
                            <button onClick={() => setShowTabWarning(false)} style={{ padding: "0.75rem 2rem", borderRadius: 12, background: "var(--primary-500)", border: "none", fontWeight: 700, cursor: "pointer", color: "#fff", width: "100%" }}>Return to Exam</button>
                        )}
                    </div>
                </div>
            )}
            {showReport && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
                    <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", maxWidth: 420, width: "100%", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--warning-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--warning)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--warning)" }}>Suspiciously Fast</h2>
                        <p style={{ color: "var(--gray-600)", marginBottom: "1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            Completed in <strong>{formatTime(timeSpent)}</strong>. This has been flagged for review.
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button onClick={() => setShowReport(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, background: "var(--primary-500)", border: "none", fontWeight: 700, cursor: "pointer", color: "#fff" }}>Go Back & Review</button>
                            <button disabled={submittingNow} onClick={forceSubmitAfterReport} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, background: "var(--gray-100)", border: "none", fontWeight: 600, cursor: submittingNow ? "not-allowed" : "pointer", color: "var(--gray-700)", opacity: submittingNow ? 0.6 : 1 }}>{submittingNow ? "Submitting..." : "Submit Anyway"}</button>
                        </div>
                    </div>
                </div>
            )}

            {showTeacherWarning && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1rem" }}>
                    <div style={{ background: "#fff", borderRadius: 24, padding: "2.5rem", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", color: "var(--danger)" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        </div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.75rem", color: "var(--danger)" }}>Teacher Warning</h2>
                        <div style={{ background: "var(--gray-50)", borderRadius: 16, padding: "1.5rem", marginBottom: "2rem", border: "1px solid var(--gray-200)" }}>
                            <p style={{ color: "var(--gray-800)", fontSize: "1rem", fontWeight: 600, lineHeight: 1.6 }}>
                                "{teacherWarningMsg}"
                            </p>
                        </div>
                        <button onClick={() => setShowTeacherWarning(false)} style={{ 
                            padding: "1rem 2.5rem", borderRadius: 14, background: "var(--primary-500)", 
                            border: "none", fontWeight: 800, cursor: "pointer", color: "#fff", width: "100%",
                            fontSize: "1rem", boxShadow: "0 4px 12px rgba(37,99,235,0.3)"
                        }}>
                            I Understand, Return to Exam
                        </button>
                    </div>
                </div>
            )}

            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
    );
}
