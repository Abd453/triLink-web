"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    announcementsForMe,
    studentDashboard,
    listStudentExams,
    listEnrollments,
    getActiveAcademicYear,
    type Announcement,
    type Exam as BackendExam,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";
import {
    PageHeader,
    PageHeaderSkeleton,
    StatGridSkeleton,
    CardSkeleton,
    EmptyState,
    Section,
} from "@/components/ui";
import {
    Calendar,
    Clock,
    PlayCircle,
    CheckCircle2,
    ChevronRight,
    GraduationCap,
    BookOpen,
    RefreshCcw,
    Megaphone,
    AlertCircle,
    Layout,
    Timer,
} from "lucide-react";

type ExamStatus = "available" | "completed" | "upcoming" | "missed";

interface Exam {
    id: string;
    attemptId?: string;
    course: string;
    type: string;
    title: string;
    date: string;
    time: string;
    duration: number;
    totalQuestions: number;
    status: ExamStatus;
    score?: number | null;
    maxPoints: number;
    room: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [filter, setFilter] = useState<"all" | "available" | "completed">("all");
    const [apiAnnouncements, setApiAnnouncements] = useState<Announcement[]>([]);
    const [apiDash, setApiDash] = useState<{ activeEnrollments: number; unreadNotifications: number } | null>(null);
    const [apiExams, setApiExams] = useState<BackendExam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [year, setYear] = useState<{ id: string; label: string } | null>(null);

    const [isClient, setIsClient] = useState(false);

    const loadDashboardData = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;
        if (!silent) setIsLoading(true);
        try {
            const activeYear = await getActiveAcademicYear();
            setYear(activeYear);

            // Fetch announcements and dashboard regardless of academic year
            const [ann, dash] = await Promise.all([
                announcementsForMe(),
                studentDashboard(),
            ]);

            let examsRes: BackendExam[] = [];
            if (activeYear) {
                examsRes = await listStudentExams(activeYear.id);
                const me = getStoredUser();
                if (me?.id) {
                    try {
                        const mine = await listEnrollments({ academicYearId: activeYear.id, studentId: me.id });
                        const allowedOfferingIds = new Set(mine.map((e) => e.classOfferingId));
                        examsRes = examsRes.filter((ex) => !ex.classOfferingId || allowedOfferingIds.has(ex.classOfferingId));
                    } catch (enrollErr) {
                        // Keep exam list fallback if enrollments endpoint is unavailable for this role.
                        console.warn("Enrollment filter unavailable for student exam dashboard:", enrollErr);
                    }
                }
            }

            setApiAnnouncements(ann);
            setApiDash(dash);
            setApiExams(examsRes);
        } catch (err) {
            console.error("Dashboard load failed:", err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsClient(true);
        void loadDashboardData();

        const onFocus = () => {
            void loadDashboardData({ silent: true });
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                void loadDashboardData({ silent: true });
            }
        };
        const intervalId = window.setInterval(() => {
            if (!document.hidden) {
                void loadDashboardData({ silent: true });
            }
        }, 30000);

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
            window.clearInterval(intervalId);
        };
    }, [loadDashboardData]);

    const processedExams: Exam[] = useMemo(() => {
        if (!isClient) return [];
        const meId = getStoredUser()?.id;

        const attemptSortTime = (a: NonNullable<BackendExam["attempts"]>[number]) => {
            const t = a.submittedAt ?? a.startedAt ?? a.releasedAt;
            return t ? new Date(t).getTime() : 0;
        };

        return apiExams.map((e: BackendExam) => {
            const mineAttempts = (e.attempts ?? []).filter((a) => !meId || a.studentId === meId);
            const attempt = mineAttempts.reduce<typeof mineAttempts[number] | undefined>((latest, cur) => {
                if (!latest) return cur;
                return attemptSortTime(cur) > attemptSortTime(latest) ? cur : latest;
            }, undefined);
            const now = new Date();
            const opensAt = new Date(e.opensAt);
            const closesAt = new Date(e.closesAt);
            
            let status: ExamStatus = "upcoming";
            if (attempt?.submittedAt) {
                status = "completed";
            } else if (now > closesAt && !attempt?.submittedAt) {
                status = "missed";
            } else if (now >= opensAt && now <= closesAt) {
                status = "available";
            }

            return {
                id: e.id,
                attemptId: attempt?.id,
                course: (e as any).subject?.name || (e as any).classOffering?.name || "General",
                type: (e as any).type || "Examination",
                title: e.title,
                date: opensAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                time: opensAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                duration: e.durationMinutes,
                totalQuestions: (e as any).questionCount || 0,
                status,
                score: attempt?.score,
                maxPoints: e.maxPoints,
                room: "Digital Hall"
            };
        });
    }, [apiExams, isClient]);

    const filtered = processedExams.filter(e => {
        if (filter === "all") return true;
        return e.status === filter;
    });

    if (isLoading) {
        return (
            <div className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
                <PageHeaderSkeleton />
                <StatGridSkeleton count={4} />
                <div className="student-dashboard-layout" style={{ gap: "2rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
                    </div>
                    <CardSkeleton lines={6} />
                </div>
            </div>
        );
    }

    const totalExams = processedExams.length;
    const availableCount = processedExams.filter((e) => e.status === "available").length;
    const completedCount = processedExams.filter((e) => e.status === "completed").length;
    const upcomingCount = processedExams.filter((e) => e.status === "upcoming").length;
    const stored = getStoredUser();
    const greetingName = stored?.firstName?.trim() || "there";

    return (
        <div className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
            <PageHeader
                kicker="Academic Dashboard"
                title={`Welcome back, ${greetingName}`}
                subtitle={year ? `Schedule and updates for ${year.label}` : "Configure an active year in school setup to view exams."}
                icon={<GraduationCap size={22} />}
                actions={(
                    <button
                        onClick={() => void loadDashboardData()}
                        className="btn btn-secondary"
                        style={{ padding: "0.55rem 1.1rem", borderRadius: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                        <RefreshCcw size={15} />
                        Sync
                    </button>
                )}
            />

            {/* Stat tiles */}
            <div className="exam-stats-grid">
                {[
                    { label: "Total Exams", value: totalExams, tone: "primary" as const, icon: <BookOpen size={16} /> },
                    { label: "Available", value: availableCount, tone: "success" as const, icon: <PlayCircle size={16} /> },
                    { label: "Completed", value: completedCount, tone: "info" as const, icon: <CheckCircle2 size={16} /> },
                    { label: "Upcoming", value: upcomingCount, tone: "warning" as const, icon: <Clock size={16} /> },
                ].map((s) => (
                    <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.15rem", border: "1.5px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", fontWeight: 700 }}>{s.label}</div>
                            <div style={{ width: 30, height: 30, borderRadius: 10, background: s.tone === "primary" ? "var(--primary-50)" : s.tone === "success" ? "rgba(16,185,129,0.10)" : s.tone === "info" ? "rgba(14,165,233,0.10)" : "rgba(245,158,11,0.12)", color: s.tone === "primary" ? "var(--primary-600)" : s.tone === "success" ? "#059669" : s.tone === "info" ? "#0284c7" : "#d97706", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 850, marginTop: 6, color: "var(--gray-900)" }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="student-dashboard-layout">
                {/* Main Content: Exams */}
                <div className="exams-column">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            {(["all", "available", "completed"] as const).map(f => (
                                <button 
                                    key={f} 
                                    onClick={() => setFilter(f)} 
                                    style={{
                                        padding: "0.6rem 1.25rem", 
                                        borderRadius: 12, 
                                        border: "1.5px solid",
                                        borderColor: filter === f ? "var(--primary-500)" : "transparent",
                                        background: filter === f ? "var(--primary-500)" : "#fff",
                                        color: filter === f ? "#fff" : "var(--gray-600)",
                                        fontWeight: 700, 
                                        fontSize: "0.85rem", 
                                        cursor: "pointer",
                                        boxShadow: filter === f ? "0 4px 12px var(--primary-100)" : "none",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)} Exams
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "1.25rem" }}>
                        {filtered.length === 0 ? (
                            <EmptyState
                                icon={<BookOpen size={26} />}
                                title={filter === "all" ? "No exams tracked yet" : `No ${filter} exams`}
                                description={filter === "all" ? "Once your teachers publish exams, they'll appear here." : "Try a different filter to see all exams."}
                                action={filter !== "all" ? <button className="btn btn-primary" onClick={() => setFilter("all")} style={{ borderRadius: 12 }}>Show all exams</button> : undefined}
                            />
                        ) : (
                            filtered.map(exam => (
                                <div key={exam.id} className="card exam-card-hover" style={{ 
                                    padding: "1.75rem", 
                                    borderRadius: 24, 
                                    border: "1.5px solid var(--gray-100)",
                                    background: "#fff",
                                    transition: "transform 0.2s, box-shadow 0.2s",
                                    cursor: "pointer"
                                }} onClick={() => exam.status === "available" && router.push(`/student/exam/${exam.id}`)}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                                                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--primary-600)", background: "var(--primary-50)", padding: "0.25rem 0.6rem", borderRadius: 6, textTransform: "uppercase" }}>{exam.course}</span>
                                                <span style={{ fontSize: "0.75rem", color: "var(--gray-400)" }}>•</span>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-400)" }}>{exam.type}</span>
                                            </div>
                                            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)" }}>{exam.title}</h3>
                                        </div>
                                        
                                        <div style={{ 
                                            padding: "0.4rem 0.8rem", 
                                            borderRadius: 10, 
                                            fontSize: "0.75rem", 
                                            fontWeight: 800,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            background: exam.status === "available" ? "#ecfdf5" : exam.status === "completed" ? "var(--primary-50)" : "var(--gray-50)",
                                            color: exam.status === "available" ? "#065f46" : exam.status === "completed" ? "var(--primary-700)" : "var(--gray-500)",
                                        }}>
                                            {exam.status === "available" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />}
                                            {exam.status.toUpperCase()}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: "1rem 2rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--gray-500)" }}>
                                            <Calendar size={16} />
                                            <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{exam.date}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--gray-500)" }}>
                                            <Timer size={16} />
                                            <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{exam.duration} mins</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--gray-500)" }}>
                                            <Layout size={16} />
                                            <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{exam.totalQuestions} Questions</span>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1.25rem", borderTop: "1px solid var(--gray-50)" }}>
                                        {exam.status === "completed" ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <CheckCircle2 size={20} className="text-primary-600" />
                                                <div>
                                                    <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", fontWeight: 600 }}>Achieved Score</div>
                                                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary-700)" }}>{exam.score != null ? `${exam.score}/${exam.maxPoints}` : "Evaluating..."}</div>
                                                </div>
                                                {exam.attemptId && (
                                                    <button
                                                        className="btn btn-outline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/student/result/${exam.attemptId}`);
                                                        }}
                                                        style={{ marginLeft: "0.5rem", borderRadius: 10, padding: "0.5rem 0.85rem", fontSize: "0.78rem" }}
                                                    >
                                                        View Result
                                                    </button>
                                                )}
                                            </div>
                                        ) : exam.status === "available" ? (
                                            <button 
                                                className="btn btn-primary"
                                                onClick={(e) => { e.stopPropagation(); router.push(`/student/exam/${exam.id}`); }}
                                                style={{ padding: "0.75rem 2rem", borderRadius: 14, fontWeight: 700, gap: "0.6rem" }}
                                            >
                                                <PlayCircle size={18} />
                                                Start Session
                                            </button>
                                        ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--gray-400)" }}>
                                                <Clock size={18} />
                                                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Available at {exam.time}</span>
                                            </div>
                                        )}
                                        <ChevronRight size={20} className="text-gray-300" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar: Announcements */}
                <div className="announcements-column">
                    <Section
                        title={(
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <Megaphone size={16} style={{ color: "var(--primary-600)" }} />
                                School Feed
                            </span>
                        )}
                        description="Institutional broadcasts"
                    >
                        <div style={{ display: "grid", gap: "0.85rem" }}>
                            {apiAnnouncements.length === 0 ? (
                                <EmptyState
                                    variant="inline"
                                    icon={<Megaphone size={22} />}
                                    title="No announcements"
                                    description="Stay tuned for updates from your school."
                                />
                            ) : (
                                apiAnnouncements.slice(0, 8).map(a => (
                                    <div key={a.id} style={{
                                        padding: "1rem 1.1rem",
                                        borderRadius: 14,
                                        background: "var(--gray-50)",
                                        border: "1px solid var(--gray-100)",
                                    }}>
                                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gray-400)", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                            {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                        <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--gray-900)", marginBottom: "0.35rem" }}>{a.title}</h4>
                                        <p style={{ fontSize: "0.82rem", color: "var(--gray-600)", lineHeight: 1.55 }}>{a.body}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </Section>

                    <div style={{ 
                        marginTop: "2rem",
                        padding: "1.75rem", 
                        borderRadius: 32, 
                        background: "linear-gradient(135deg, var(--primary-600), var(--primary-800))", 
                        color: "#fff",
                        position: "relative",
                        overflow: "hidden"
                    }}>
                        <div style={{ position: "relative", zIndex: 1 }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.5rem" }}>Need Assistance?</h3>
                            <p style={{ fontSize: "0.85rem", opacity: 0.9, lineHeight: 1.6, marginBottom: "1.25rem" }}>If you experience technical issues during an active exam window, reach out to support immediately.</p>
                            <button className="btn btn-secondary" style={{ width: "100%", borderRadius: 12, fontWeight: 700 }}>Contact Helpdesk</button>
                        </div>
                        <AlertCircle size={80} style={{ position: "absolute", bottom: -20, right: -20, opacity: 0.1 }} />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .exam-card-hover:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.04);
                    border-color: var(--primary-200) !important;
                }
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

