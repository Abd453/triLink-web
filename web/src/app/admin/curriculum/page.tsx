"use client";
/**
 * Admin → Curriculum
 *
 * Mock data is rendered today. To wire the real backend, replace the
 * `MOCK_SUBJECTS` constant with `authFetch(`${getApiBase()}/api/curriculum/subjects?gradeId=...`)`.
 */
import { useMemo, useState } from "react";
import {
    BookOpen,
    ChevronRight,
    Plus,
    Search,
} from "lucide-react";
import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardSection,
    EmptyState,
    Input,
    PageHeader,
    StatTile,
    Tabs,
} from "@/components/ui";

interface Topic {
    id: string;
    title: string;
    weeks: number;
    status: "ready" | "draft";
}

interface Subject {
    id: string;
    name: string;
    code: string;
    grade: string;
    department: string;
    topics: Topic[];
}

const MOCK_SUBJECTS: Subject[] = [
    {
        id: "s1",
        name: "Mathematics",
        code: "MATH",
        grade: "Grade 11",
        department: "Mathematics",
        topics: [
            { id: "t1", title: "Quadratic equations", weeks: 3, status: "ready" },
            { id: "t2", title: "Functions & graphs", weeks: 4, status: "ready" },
            { id: "t3", title: "Trigonometry — basics", weeks: 5, status: "ready" },
            { id: "t4", title: "Trigonometry — applications", weeks: 4, status: "draft" },
        ],
    },
    {
        id: "s2",
        name: "Biology",
        code: "BIO",
        grade: "Grade 11",
        department: "Science",
        topics: [
            { id: "t5", title: "Cell biology", weeks: 4, status: "ready" },
            { id: "t6", title: "Genetics intro", weeks: 5, status: "ready" },
            { id: "t7", title: "Photosynthesis", weeks: 3, status: "draft" },
        ],
    },
    {
        id: "s3",
        name: "English",
        code: "ENG",
        grade: "Grade 11",
        department: "Languages",
        topics: [
            { id: "t8", title: "Essay structure", weeks: 2, status: "ready" },
            { id: "t9", title: "World literature survey", weeks: 6, status: "ready" },
        ],
    },
];

const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];

export default function AdminCurriculumPage() {
    const [grade, setGrade] = useState("Grade 11");
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(MOCK_SUBJECTS[0]?.id ?? null);

    const subjectsForGrade = useMemo(
        () => MOCK_SUBJECTS.filter(s => s.grade === grade),
        [grade],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return subjectsForGrade;
        return subjectsForGrade.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            s.department.toLowerCase().includes(q),
        );
    }, [subjectsForGrade, query]);

    const selected = useMemo(
        () => filtered.find(s => s.id === selectedId) ?? filtered[0] ?? null,
        [filtered, selectedId],
    );

    const totals = useMemo(() => {
        const subjects = subjectsForGrade.length;
        const topics = subjectsForGrade.reduce((acc, s) => acc + s.topics.length, 0);
        const ready = subjectsForGrade.reduce((acc, s) => acc + s.topics.filter(t => t.status === "ready").length, 0);
        return { subjects, topics, ready };
    }, [subjectsForGrade]);

    return (
        <div className="ui-page">
            <PageHeader
                title="Curriculum"
                description="Subjects and topics taught at the school, organised by grade."
                icon={<BookOpen size={22} />}
                action={<Button leftIcon={<Plus size={16} />}>Add subject</Button>}
            />

            <div style={{ marginTop: "1rem" }}>
                <Tabs
                    value={grade}
                    onChange={setGrade}
                    tabs={GRADES.map(g => ({ id: g, label: g }))}
                />
            </div>

            <div className="ui-grid ui-grid-3" style={{ marginTop: "1rem" }}>
                <StatTile label="Subjects" value={totals.subjects} icon={<BookOpen size={16} />} tone="primary" />
                <StatTile label="Topics" value={totals.topics} icon={<BookOpen size={16} />} tone="info" />
                <StatTile label="Ready to teach" value={`${totals.ready}/${totals.topics}`} icon={<BookOpen size={16} />} tone="success" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: "1rem", marginTop: "1.25rem" }}>
                <Card>
                    <CardHeader title="Subjects" subtitle={grade} />
                    <CardSection>
                        <Input
                            placeholder="Search subjects…"
                            leftIcon={<Search size={16} />}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </CardSection>
                    {filtered.length === 0 ? (
                        <CardSection>
                            <EmptyState
                                icon={<BookOpen size={28} />}
                                title="No subjects"
                                description={query ? `Nothing matches "${query}".` : `${grade} has no subjects defined yet.`}
                                compact
                            />
                        </CardSection>
                    ) : filtered.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedId(s.id)}
                            className="ui-card-section"
                            style={{
                                width: "100%",
                                textAlign: "left",
                                background: s.id === selected?.id ? "var(--role-accent-50)" : "transparent",
                                border: "0",
                                borderTop: "1px solid var(--gray-100)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: "var(--gray-900)" }}>{s.name}</div>
                                <div style={{ fontSize: "0.8125rem", color: "var(--gray-500)" }}>{s.code} · {s.department}</div>
                            </div>
                            <Badge tone="neutral">{s.topics.length} topics</Badge>
                            <ChevronRight size={16} style={{ color: "var(--gray-400)" }} />
                        </button>
                    ))}
                </Card>

                {selected ? <SubjectDetail subject={selected} /> : (
                    <Card padded>
                        <EmptyState
                            icon={<BookOpen size={28} />}
                            title="Pick a subject"
                            description="Select a subject from the list to see its topics."
                        />
                    </Card>
                )}
            </div>
        </div>
    );
}

function SubjectDetail({ subject }: { subject: Subject }) {
    return (
        <Card>
            <CardHeader
                title={subject.name}
                subtitle={`${subject.code} · ${subject.grade} · ${subject.department}`}
                action={<Button size="sm" variant="outline" leftIcon={<Plus size={14} />}>Topic</Button>}
            />
            {subject.topics.length === 0 ? (
                <CardSection>
                    <EmptyState
                        icon={<BookOpen size={28} />}
                        title="No topics yet"
                        description="Add the first topic to start mapping this subject."
                        compact
                    />
                </CardSection>
            ) : subject.topics.map(t => (
                <CardSection key={t.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontWeight: 600, color: "var(--gray-900)" }}>{t.title}</div>
                            <div style={{ fontSize: "0.8125rem", color: "var(--gray-500)" }}>{t.weeks} weeks</div>
                        </div>
                        <Badge tone={t.status === "ready" ? "success" : "warning"}>{t.status}</Badge>
                        <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                </CardSection>
            ))}
        </Card>
    );
}
