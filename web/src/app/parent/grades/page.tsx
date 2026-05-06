"use client";
/**
 * Parent → Grades
 *
 * Mock data is rendered today. To wire the real backend, replace
 * `MOCK_CHILD_GRADES` with `authFetch(`${getApiBase()}/api/parents/me/children/{id}/grades`)`.
 */
import { useMemo, useState } from "react";
import {
    BarChart3,
    GraduationCap,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import {
    Badge,
    Card,
    CardHeader,
    CardSection,
    PageHeader,
    StatTile,
    Tabs,
} from "@/components/ui";

interface ChildGrade {
    subject: string;
    teacher: string;
    finalMark: number;
    classAvg: number;
    trend: "up" | "down" | "flat";
}

const MOCK_CHILD_GRADES: ChildGrade[] = [
    { subject: "Mathematics", teacher: "Mr. Solomon", finalMark: 88, classAvg: 76, trend: "up" },
    { subject: "Biology", teacher: "Mrs. Almaz", finalMark: 92, classAvg: 80, trend: "up" },
    { subject: "English", teacher: "Ms. Sara", finalMark: 76, classAvg: 78, trend: "down" },
    { subject: "History", teacher: "Mr. Bekele", finalMark: 81, classAvg: 75, trend: "flat" },
    { subject: "Physics", teacher: "Mr. Daniel", finalMark: 85, classAvg: 71, trend: "up" },
];

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function ParentGradesPage() {
    const [term, setTerm] = useState("Term 2");

    const summary = useMemo(() => {
        const m = MOCK_CHILD_GRADES.map(g => g.finalMark);
        const avg = Math.round(m.reduce((a, b) => a + b, 0) / m.length);
        const aboveClass = MOCK_CHILD_GRADES.filter(g => g.finalMark > g.classAvg).length;
        return { avg, aboveClass, total: MOCK_CHILD_GRADES.length };
    }, []);

    return (
        <div className="ui-page">
            <PageHeader
                title="Grades"
                description="How your child is doing across each subject."
                icon={<BarChart3 size={22} />}
            />

            <div style={{ marginTop: "1rem" }}>
                <Tabs
                    value={term}
                    onChange={setTerm}
                    tabs={TERMS.map(t => ({ id: t, label: t }))}
                />
            </div>

            <div className="ui-grid ui-grid-3" style={{ marginTop: "1rem" }}>
                <StatTile label="Average" value={`${summary.avg}%`} icon={<GraduationCap size={16} />} tone="primary" />
                <StatTile label="Above class average" value={`${summary.aboveClass} / ${summary.total}`} icon={<TrendingUp size={16} />} tone="success" />
                <StatTile label="Subjects watched" value={summary.total} icon={<BarChart3 size={16} />} tone="info" />
            </div>

            <div style={{ marginTop: "1.25rem" }}>
                <Card>
                    <CardHeader title="Per subject" subtitle={`${term} · vs class average`} />
                    {MOCK_CHILD_GRADES.map(g => (
                        <CardSection key={g.subject}>
                            <SubjectRow g={g} />
                        </CardSection>
                    ))}
                </Card>
            </div>
        </div>
    );
}

function SubjectRow({ g }: { g: ChildGrade }) {
    const diff = g.finalMark - g.classAvg;
    const tone = g.finalMark >= 85 ? "success" : g.finalMark >= 70 ? "info" : "warning";
    const trendIcon =
        g.trend === "up" ? <TrendingUp size={14} /> :
        g.trend === "down" ? <TrendingDown size={14} /> :
        null;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600, color: "var(--gray-900)" }}>{g.subject}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--gray-500)" }}>{g.teacher}</div>
            </div>

            <div style={{ minWidth: 220, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--gray-500)", marginBottom: 4 }}>
                    <span>Class avg {g.classAvg}%</span>
                    <span>Your child {g.finalMark}%</span>
                </div>
                <div style={{ position: "relative", height: 8, background: "var(--gray-100)", borderRadius: 999 }}>
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${g.classAvg}%`,
                            background: "var(--gray-300, #d1d5db)",
                            borderRadius: 999,
                        }}
                    />
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${g.finalMark}%`,
                            background: "var(--role-accent-500)",
                            borderRadius: 999,
                            mixBlendMode: "multiply",
                        }}
                    />
                </div>
            </div>

            <Badge tone={tone}>
                {trendIcon ? <span aria-hidden>{trendIcon}</span> : null}
                {diff >= 0 ? `+${diff}` : diff} vs class
            </Badge>
        </div>
    );
}
