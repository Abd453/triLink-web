"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
    getExamStudentRoster, 
    controlExamAttempt, 
    type ExamRosterStudent,
    type Exam
} from "@/lib/admin-api";
import { chatRealtime } from "@/lib/chat-realtime";

interface ExamMonitorProps {
    exam: Exam;
    onClose: () => void;
}

export default function ExamMonitor({ exam, onClose }: ExamMonitorProps) {
    const [students, setStudents] = useState<ExamRosterStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showWarnModal, setShowWarnModal] = useState<{ attemptId: string; studentName: string } | null>(null);
    const [warnMsg, setWarnMsg] = useState("Please focus on your exam and avoid switching tabs.");
    const [actionError, setActionError] = useState<string | null>(null);
    const [activity, setActivity] = useState<Array<{ id: string; text: string; at: string }>>([]);
    const [rtStatus, setRtStatus] = useState<string>("idle");
    const studentsRef = useRef<ExamRosterStudent[]>([]);

    const resolveStudentName = (student: Partial<ExamRosterStudent> | null | undefined) => {
        const full = `${student?.firstName || ""} ${student?.lastName || ""}`.trim();
        return full || student?.email || "Unknown student";
    };

    const setStudentsWithRef = (next: ExamRosterStudent[] | ((prev: ExamRosterStudent[]) => ExamRosterStudent[])) => {
        setStudents((prev) => {
            const resolved = typeof next === "function" ? (next as (p: ExamRosterStudent[]) => ExamRosterStudent[])(prev) : next;
            studentsRef.current = resolved;
            return resolved;
        });
    };

    const pushActivity = (text: string) => {
        setActivity((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
    };

    const fetchRoster = async () => {
        try {
            const data = await getExamStudentRoster(exam.id);
            setStudentsWithRef(data.students);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load roster");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoster();
        const interval = setInterval(fetchRoster, 10000); // Polling fallback if realtime lags

        const unsubStatus = chatRealtime.on("status", (status) => {
            setRtStatus(status);
        });

        const unsubViolation = chatRealtime.on("attempt:violation", (payload) => {
            if (payload.examId !== exam.id) return;
            setStudentsWithRef(prev => prev.map(s => {
                if (s.studentId === payload.studentId) {
                    return { ...s, violationCount: payload.violationCount, status: "in_progress" };
                }
                return s;
            }));
            const who = studentsRef.current.find((s) => s.studentId === payload.studentId);
            const name = resolveStudentName(who);
            const reason = payload.reason ? ` - ${payload.reason}` : "";
            pushActivity(`Violation: ${name} (${payload.violationCount})${reason}`);
        });

        const unsubActivity = chatRealtime.on("attempt:activity", (payload) => {
            if (payload.examId !== exam.id) return;
            setStudentsWithRef((prev) => prev.map((s) => {
                if (s.studentId !== payload.studentId) return s;
                if (payload.kind === "submit" || payload.kind === "force_submit") {
                    return { ...s, status: "submitted", isLocked: false } as ExamRosterStudent;
                }
                if (payload.kind === "locked") {
                    return { ...s, status: "in_progress", isLocked: true, lockReason: payload.reason ?? "Locked by policy" } as ExamRosterStudent;
                }
                if (payload.kind === "allow_rejoin") {
                    return { ...s, isLocked: false, reentryAllowed: true } as ExamRosterStudent;
                }
                if (payload.kind === "start" || payload.kind === "resume") {
                    return { ...s, status: "in_progress" } as ExamRosterStudent;
                }
                return s;
            }));
            const label = payload.kind.replace(/_/g, " ");
            const who = studentsRef.current.find((s) => s.studentId === payload.studentId);
            const name = resolveStudentName(who);
            const reason = payload.reason ? ` - ${payload.reason}` : "";
            pushActivity(`${label.toUpperCase()}: ${name}${reason}`);
        });

        const unsubMessage = chatRealtime.on("message:new", () => {
            // New chat messages might mean students are talking, but we focus on proctoring here.
        });

        return () => {
            clearInterval(interval);
            unsubStatus();
            unsubViolation();
            unsubActivity();
            unsubMessage();
        };
    }, [exam.id]);

    const handleControl = async (attemptId: string, action: "force_submit" | "warn" | "allow_rejoin") => {
        if (!attemptId) return;
        setActionError(null);
        try {
            await controlExamAttempt(attemptId, action, action === "warn" ? warnMsg : undefined);
            if (action === "warn") {
                setShowWarnModal(null);
            }
            if (action === "allow_rejoin") {
                pushActivity("Teacher allowed student rejoin.");
            }
            fetchRoster(); // Refresh status
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Control action failed");
        }
    };

    const inProgressCount = students.filter(s => s.status === "in_progress").length;
    const submittedCount = students.filter(s => s.status === "submitted").length;
    const activeStudents = students.filter((s) => s.status === "in_progress");

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", 
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center", 
            justifyContent: "center", zIndex: 1000, padding: "2rem"
        }}>
            {actionError && (
                <div role="alert" style={{
                    position: "fixed",
                    top: "1.25rem",
                    right: "1.25rem",
                    zIndex: 1200,
                    maxWidth: 360,
                    borderRadius: 16,
                    background: "#fff",
                    color: "var(--danger)",
                    border: "1px solid var(--danger-light)",
                    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
                    padding: "0.85rem 1rem",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                }}>
                    {actionError}
                </div>
            )}
            <div style={{
                background: "#fff", borderRadius: "24px", width: "100%", 
                maxWidth: "1000px", height: "85vh", display: "flex", 
                flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{
                    padding: "1.5rem 2rem", borderBottom: "1px solid var(--gray-100)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "linear-gradient(to right, #fff, var(--gray-50))"
                }}>
                    <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Live Proctoring</div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gray-900)" }}>{exam.title}</h2>
                    </div>
                    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: rtStatus === "open" ? "var(--success)" : "var(--warning)", textTransform: "uppercase" }}>
                            {rtStatus === "open" ? "Realtime Connected" : `Realtime ${rtStatus}`}
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase" }}>Active Students</div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--success)" }}>{inProgressCount} <span style={{ fontSize: "0.85rem", color: "var(--gray-300)" }}>/ {students.length}</span></div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 40, height: 40, borderRadius: "12px", border: "1px solid var(--gray-200)",
                            background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
                    {loading ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-400)" }}>Loading proctoring data...</div>
                    ) : error ? (
                        <div style={{ color: "var(--danger)", textAlign: "center", padding: "2rem" }}>{error}</div>
                    ) : (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            <div style={{ border: "1.5px solid var(--gray-100)", borderRadius: 14, background: "#fff", padding: "0.85rem 1rem" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", marginBottom: "0.45rem" }}>Active Students</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                                    {activeStudents.length === 0 ? (
                                        <span style={{ fontSize: "0.8rem", color: "var(--gray-400)" }}>No active students yet.</span>
                                    ) : (
                                        activeStudents.map((s) => (
                                            <span key={s.studentId} style={{ padding: "0.35rem 0.65rem", borderRadius: 999, background: "var(--success-50)", color: "var(--success-600)", fontSize: "0.76rem", fontWeight: 700 }}>
                                                {resolveStudentName(s)}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", alignItems: "start" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                            {students.map(s => (
                                <div key={s.studentId} style={{
                                    border: "1.5px solid var(--gray-100)", borderRadius: "20px", 
                                    padding: "1.25rem", background: s.status === 'in_progress' ? "#fff" : "var(--gray-50)",
                                    transition: "all 0.2s ease",
                                    boxShadow: s.status === 'in_progress' ? "0 4px 6px -1px rgba(0,0,0,0.05)" : "none",
                                    opacity: s.status === 'not_started' ? 0.6 : 1
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", alignItems: "flex-start" }}>
                                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                            <div style={{ 
                                                width: 44, height: 44, borderRadius: "12px", 
                                                background: s.status === 'submitted' ? "var(--success-50)" : "var(--primary-50)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.9rem", fontWeight: 700, color: s.status === 'submitted' ? "var(--success-600)" : "var(--primary-600)"
                                            }}>
                                                {(s.firstName?.[0] || "") + (s.lastName?.[0] || "")}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--gray-900)" }}>{s.firstName} {s.lastName}</div>
                                                <div style={{ 
                                                    fontSize: "0.75rem", fontWeight: 600, 
                                                    color: s.status === 'in_progress' ? "var(--primary-600)" : s.status === 'submitted' ? "var(--success-600)" : "var(--gray-400)"
                                                }}>
                                                    {s.status === 'in_progress' ? "● Live / Working" : s.status === 'submitted' ? "✓ Complete" : "○ Idle"}
                                                </div>
                                            </div>
                                        </div>
                                        {(s.violationCount > 0 || s.isLocked) && (
                                            <div style={{ 
                                                background: "var(--danger-light)", color: "var(--danger)", 
                                                padding: "0.25rem 0.6rem", borderRadius: "8px", 
                                                fontSize: "0.7rem", fontWeight: 800, animation: "pulse 2s infinite"
                                            }}>
                                                {s.isLocked ? "Locked" : `${s.violationCount} ${s.violationCount === 1 ? 'Violation' : 'Violations'}`}
                                            </div>
                                        )}
                                    </div>

                                    {s.isLocked && (
                                        <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", color: "var(--danger)", fontWeight: 600 }}>
                                            Locked: {s.lockReason || "Student left protected mode"}
                                        </div>
                                    )}

                                    {s.status === "in_progress" && s.attemptId && (
                                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                            <button 
                                                onClick={() => setShowWarnModal({ attemptId: s.attemptId!, studentName: `${s.firstName} ${s.lastName}` })}
                                                style={{ 
                                                    flex: 1, padding: "0.6rem", borderRadius: "10px", 
                                                    background: "var(--warning-light)", color: "#b45309",
                                                    border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer"
                                                }}
                                            >
                                                Warn
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (confirm(`Force submit exam for ${s.firstName} ${s.lastName}?`)) {
                                                        handleControl(s.attemptId!, "force_submit");
                                                    }
                                                }}
                                                style={{ 
                                                    flex: 1, padding: "0.6rem", borderRadius: "10px", 
                                                    background: "var(--danger-light)", color: "var(--danger)",
                                                    border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer"
                                                }}
                                            >
                                                Force Submit
                                            </button>
                                        </div>
                                    )}

                                    {s.attemptId && s.isLocked && (
                                        <button
                                            onClick={() => handleControl(s.attemptId!, "allow_rejoin")}
                                            style={{
                                                width: "100%", marginTop: "0.6rem", padding: "0.6rem", borderRadius: "10px",
                                                background: "var(--primary-500)", color: "#fff", border: "none", cursor: "pointer",
                                                fontSize: "0.8rem", fontWeight: 700
                                            }}
                                        >
                                            Allow Rejoin
                                        </button>
                                    )}

                                    {s.status === "submitted" && (
                                        <div style={{ 
                                            background: "var(--gray-100)", borderRadius: "10px", 
                                            padding: "0.6rem", textAlign: "center", fontSize: "0.8rem", 
                                            color: "var(--gray-500)", fontWeight: 600, marginTop: "1rem"
                                        }}>
                                            Score: {s.score != null ? `${s.score} / ${exam.maxPoints}` : "Pending"}
                                        </div>
                                    )}
                                </div>
                            ))}
                            </div>

                            <div style={{ border: "1.5px solid var(--gray-100)", borderRadius: 16, background: "#fff", padding: "1rem" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gray-800)", marginBottom: "0.75rem" }}>Live Activity</div>
                                <div style={{ display: "grid", gap: "0.55rem", maxHeight: "58vh", overflowY: "auto" }}>
                                    {activity.length === 0 ? (
                                        <div style={{ fontSize: "0.8rem", color: "var(--gray-400)" }}>Waiting for activity...</div>
                                    ) : (
                                        activity.map((a) => (
                                            <div key={a.id} style={{ border: "1px solid var(--gray-100)", borderRadius: 10, padding: "0.55rem 0.6rem" }}>
                                                <div style={{ fontSize: "0.78rem", color: "var(--gray-700)", fontWeight: 600 }}>{a.text}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--gray-400)", marginTop: 2 }}>{a.at}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                <div style={{ 
                    padding: "1rem 2rem", background: "var(--gray-50)", 
                    borderTop: "1px solid var(--gray-100)", display: "flex", gap: "2rem"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)" }} />
                        <span style={{ color: "var(--gray-500)" }}>Submitted: <strong>{submittedCount}</strong></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary-500)" }} />
                        <span style={{ color: "var(--gray-500)" }}>In Progress: <strong>{inProgressCount}</strong></span>
                    </div>
                </div>
            </div>

            {/* Warning Modal */}
            {showWarnModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
                    <div style={{ background: "#fff", borderRadius: "20px", padding: "2rem", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>Warn student</h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "1.5rem" }}>Sending a warning to <strong>{showWarnModal.studentName}</strong></p>
                        <textarea 
                            value={warnMsg}
                            onChange={(e) => setWarnMsg(e.target.value)}
                            style={{ 
                                width: "100%", height: "100px", borderRadius: "12px", 
                                border: "1.5px solid var(--gray-200)", padding: "1rem",
                                fontSize: "0.9rem", outline: "none", marginBottom: "1.5rem",
                                resize: "none"
                            }}
                        />
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button onClick={() => setShowWarnModal(null)} style={{ flex: 1, padding: "0.75rem", borderRadius: "12px", border: "none", background: "var(--gray-100)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => handleControl(showWarnModal.attemptId, "warn")} style={{ flex: 1, padding: "0.75rem", borderRadius: "12px", border: "none", background: "var(--warning)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Send Warning</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.02); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
