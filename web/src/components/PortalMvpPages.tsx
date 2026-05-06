"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  Library,
  ListChecks,
  Megaphone,
  MessageCircleHeart,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  announcementsForMe,
  createLearningMaterial,
  createMyGoal,
  deleteTextbook,
  getActiveAcademicYear,
  getChildUpcoming,
  getClassRoster,
  getStudentDetail,
  listCalendarEvents,
  listChildSubjects,
  listCurriculumSubjects,
  listCurriculumTopics,
  listMyBadges,
  listMyClassOfferings,
  listMyFeedback,
  listMyGoals,
  listMySubjects,
  listNotifications,
  listStudentMaterials,
  listTextbooks,
  markAllNotificationsRead,
  markNotificationRead,
  myBadgePoints,
  myGamificationProgress,
  myChildren,
  patchGoal,
  studentAttendanceReport,
  submitFeedback,
  uploadTextbook,
  type Announcement,
  type BackendNotification,
  type CalendarEventRecord,
  type ClassOffering,
  type CurriculumSubject,
  type EnrolledSubject,
  type LearningMaterialRecord,
  type StudentGoal,
  type TextbookRecord,
  type TopicRecord,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";
import { Badge, Button, Card, CardHeader, CardSection, EmptyState, PageHeader, Skeleton, StatTile } from "@/components/ui";

type LoadState = "loading" | "ready" | "error";
type ChildLink = Awaited<ReturnType<typeof myChildren>>[number];

function formatDate(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function offeringLabel(o: ClassOffering) {
  return o.displayName || o.name || [o.gradeName, o.sectionName, o.subjectName].filter(Boolean).join(" - ") || "Class offering";
}

function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ") || "Unknown";
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card padded>
      <Badge tone="danger">Error</Badge>
      <p style={{ margin: "0.75rem 0 0", color: "var(--gray-700)" }}>{message}</p>
      {onRetry ? <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={14} />} style={{ marginTop: "0.75rem" }}>Retry</Button> : null}
    </Card>
  );
}

function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="ui-grid ui-grid-2">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} height={136} radius={12} />)}
    </div>
  );
}

function DataCard({ title, meta, body, href, action }: { title: string; meta?: string; body?: string | null; href?: string; action?: React.ReactNode }) {
  const content = (
    <Card padded interactive={Boolean(href)} style={{ height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--gray-900)" }}>{title}</h3>
          {meta ? <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--gray-500)" }}>{meta}</p> : null}
        </div>
        {action}
      </div>
      {body ? <p style={{ margin: "0.75rem 0 0", color: "var(--gray-700)", fontSize: "0.9rem", lineHeight: 1.5 }}>{body}</p> : null}
    </Card>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{content}</a> : content;
}

function useBasicLoad<T>(loader: () => Promise<T>, deps: React.DependencyList = []) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError(null);
    loader()
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setState("ready");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load data");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]);

  return { state, data, error, reload: () => setTick((v) => v + 1) };
}

export function AnnouncementsPage({ role }: { role: "student" | "parent" }) {
  const { state, data, error, reload } = useBasicLoad(() => announcementsForMe());
  const items = data ?? [];
  return (
    <div className="ui-page">
      <PageHeader title="Announcements" description="School-wide and class updates." icon={<Megaphone size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && items.length === 0 ? <Card padded><EmptyState icon={<Megaphone size={28} />} title="No announcements" description={`There are no ${role} announcements right now.`} /></Card> : null}
      {items.length > 0 ? (
        <div className="ui-grid ui-grid-2">
          {items.map((a: Announcement) => (
            <DataCard key={a.id} title={a.title} meta={`${a.audience} · ${formatDateTime(a.createdAt)}`} body={a.body} action={<Badge tone="info">{a.audience}</Badge>} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CalendarPage({ role }: { role: "student" | "parent" }) {
  const { state, data, error, reload } = useBasicLoad(async () => {
    const year = await getActiveAcademicYear();
    return listCalendarEvents({ academicYearId: year?.id });
  });
  const events = data ?? [];
  return (
    <div className="ui-page">
      <PageHeader title="Calendar" description={role === "parent" ? "School events and meetings for your child." : "Exams, deadlines, and school events."} icon={<CalendarDays size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && events.length === 0 ? <Card padded><EmptyState icon={<CalendarDays size={28} />} title="No calendar events" description="No events are scheduled for the current academic year." /></Card> : null}
      {events.length > 0 ? (
        <Card>
          <CardHeader title="Upcoming events" subtitle={`${events.length} event${events.length === 1 ? "" : "s"}`} />
          <CardSection>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {events.map((e: CalendarEventRecord) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--gray-100)", paddingBottom: "0.75rem" }}>
                  <div>
                    <strong>{e.title}</strong>
                    {e.description ? <p style={{ margin: "0.25rem 0 0", color: "var(--gray-600)" }}>{e.description}</p> : null}
                  </div>
                  <Badge tone={e.type === "exam" ? "warning" : e.type === "holiday" ? "success" : "info"}>{formatDate(e.date)}</Badge>
                </div>
              ))}
            </div>
          </CardSection>
        </Card>
      ) : null}
    </div>
  );
}

export function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  const { state, data, error, reload } = useBasicLoad(() => listNotifications(false));
  const items = data ?? [];
  async function markRead(id: string) {
    setBusy(true);
    try {
      await markNotificationRead(id);
      reload();
    } finally {
      setBusy(false);
    }
  }
  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ui-page">
      <PageHeader title="Notifications" description="Alerts and updates from the school." icon={<Bell size={22} />} action={<Button variant="outline" onClick={markAll} loading={busy}>Mark all read</Button>} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && items.length === 0 ? <Card padded><EmptyState icon={<Bell size={28} />} title="No notifications" description="You are all caught up." /></Card> : null}
      {items.length > 0 ? (
        <div className="ui-grid ui-grid-2">
          {items.map((n: BackendNotification) => (
            <DataCard
              key={n.id}
              title={n.title}
              meta={`${n.type} · ${formatDateTime(n.createdAt)}`}
              body={n.body}
              action={n.readAt ? <Badge tone="neutral">Read</Badge> : <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); void markRead(n.id); }}>Mark read</Button>}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StudentCoursesPage() {
  const { state, data, error, reload } = useBasicLoad(() => listMySubjects());
  const items = data ?? [];
  return (
    <div className="ui-page">
      <PageHeader title="My courses" description="Subjects you are enrolled in, with teacher and class details." icon={<BookOpen size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && items.length === 0 ? <Card padded><EmptyState icon={<BookOpen size={28} />} title="No courses" description="Your enrollments will appear here after the school assigns your classes." /></Card> : null}
      {items.length > 0 ? <SubjectGrid subjects={items} /> : null}
    </div>
  );
}

function SubjectGrid({ subjects }: { subjects: EnrolledSubject[] }) {
  return (
    <div className="ui-grid ui-grid-2">
      {subjects.map((s) => (
        <DataCard
          key={`${s.subjectId}-${s.classOfferingId}`}
          title={s.subjectName}
          meta={[s.gradeName, s.sectionName, s.subjectCode].filter(Boolean).join(" · ")}
          body={s.teacher ? `Teacher: ${fullName(s.teacher.firstName, s.teacher.lastName)} (${s.teacher.email})` : "Teacher not assigned"}
          action={<Badge tone="primary">{s.subjectCode || "Subject"}</Badge>}
        />
      ))}
    </div>
  );
}

export function StudentCurriculumPage() {
  const { state, data, error, reload } = useBasicLoad(async () => {
    const subjects = await listCurriculumSubjects();
    const topicPairs = await Promise.all(subjects.map(async (s) => [s.id, await listCurriculumTopics(s.id).catch(() => [] as TopicRecord[])] as const));
    return { subjects, topicMap: new Map(topicPairs) };
  });
  return (
    <div className="ui-page">
      <PageHeader title="Curriculum" description="Topics and units for your enrolled subjects." icon={<ListChecks size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && (data?.subjects.length ?? 0) === 0 ? <Card padded><EmptyState icon={<ListChecks size={28} />} title="No curriculum yet" description="Topics will appear after your subjects are configured." /></Card> : null}
      {data ? (
        <div className="ui-grid ui-grid-2">
          {data.subjects.map((s: CurriculumSubject) => {
            const topics = data.topicMap.get(s.id) ?? [];
            return (
              <Card key={s.id}>
                <CardHeader title={s.name} subtitle={[s.code, s.curriculumVersion].filter(Boolean).join(" · ")} action={<Badge tone="info">{topics.length} topics</Badge>} />
                <CardSection>
                  {topics.length === 0 ? <EmptyState compact title="No topics" description="No topics are attached to this subject yet." /> : (
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--gray-700)" }}>
                      {topics.slice(0, 8).map((t) => <li key={t.id}>{t.name || t.title || "Untitled topic"}</li>)}
                    </ul>
                  )}
                </CardSection>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function StudentMaterialsPage() {
  const { state, data, error, reload } = useBasicLoad(() => listStudentMaterials());
  return <MaterialsList title="Learning materials" description="Notes, links, and files shared by your teachers." state={state} error={error} reload={reload} materials={data ?? []} />;
}

function MaterialsList({ title, description, state, error, reload, materials }: { title: string; description: string; state: LoadState; error: string | null; reload: () => void; materials: LearningMaterialRecord[] }) {
  return (
    <div className="ui-page">
      <PageHeader title={title} description={description} icon={<FolderOpen size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && materials.length === 0 ? <Card padded><EmptyState icon={<FolderOpen size={28} />} title="No materials" description="Shared materials will appear here." /></Card> : null}
      {materials.length > 0 ? (
        <div className="ui-grid ui-grid-2">
          {materials.map((m) => (
            <DataCard key={m.id} title={m.title} meta={`${m.subject} · Grade ${m.grade} · ${m.type.toUpperCase()}`} body={m.description} href={m.url} action={<Download size={17} />} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TextbooksPage({ admin = false }: { admin?: boolean }) {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [uploading, setUploading] = useState(false);
  const { state, data, error, reload } = useBasicLoad(() => listTextbooks({ subject: subject || undefined, grade: grade ? Number(grade) : undefined }), [subject, grade]);
  const books = data ?? [];
  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return;
    setUploading(true);
    try {
      await uploadTextbook({
        title: String(form.get("title") || ""),
        subject: String(form.get("subject") || ""),
        grade: Number(form.get("grade") || 0),
        description: String(form.get("description") || ""),
        file,
      });
      e.currentTarget.reset();
      reload();
    } finally {
      setUploading(false);
    }
  }
  async function removeBook(id: string) {
    await deleteTextbook(id);
    reload();
  }
  return (
    <div className="ui-page">
      <PageHeader title="Textbooks" description={admin ? "Manage the school textbook library." : "Read and download books for your grade and subjects."} icon={<Library size={22} />} />
      <Card padded>
        <div className="ui-grid ui-grid-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter subject" className="input-field" style={{ padding: "0.65rem 0.8rem" }} />
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Filter grade" type="number" className="input-field" style={{ padding: "0.65rem 0.8rem" }} />
          <Button variant="outline" onClick={reload} leftIcon={<Search size={16} />}>Refresh</Button>
        </div>
      </Card>
      {admin ? (
        <Card style={{ marginTop: "1rem" }}>
          <CardHeader title="Upload textbook" subtitle="PDF uploads are available to admins." />
          <CardSection>
            <form onSubmit={onUpload} className="ui-grid ui-grid-3">
              <input name="title" required placeholder="Title" style={{ padding: "0.65rem 0.8rem" }} />
              <input name="subject" required placeholder="Subject" style={{ padding: "0.65rem 0.8rem" }} />
              <input name="grade" required placeholder="Grade" type="number" min={1} style={{ padding: "0.65rem 0.8rem" }} />
              <input name="description" placeholder="Description" style={{ padding: "0.65rem 0.8rem" }} />
              <input name="file" required type="file" accept="application/pdf" />
              <Button type="submit" loading={uploading} leftIcon={<Upload size={16} />}>Upload</Button>
            </form>
          </CardSection>
        </Card>
      ) : null}
      <div style={{ marginTop: "1rem" }}>
        {state === "loading" ? <LoadingGrid /> : null}
        {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
        {state === "ready" && books.length === 0 ? <Card padded><EmptyState icon={<Library size={28} />} title="No textbooks" description="No books match the current filters." /></Card> : null}
        {books.length > 0 ? (
          <div className="ui-grid ui-grid-2">
            {books.map((b: TextbookRecord) => (
              <DataCard
                key={b.id}
                title={b.title}
                meta={`${b.subject} · Grade ${b.grade} · ${b.pageCount ?? "—"} pages`}
                body={b.description}
                href={b.accessUrl}
                action={admin ? <Button size="sm" variant="danger" onClick={(e) => { e.preventDefault(); void removeBook(b.id); }} leftIcon={<Trash2 size={14} />}>Delete</Button> : <Download size={17} />}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StudentGoalsPage() {
  const [saving, setSaving] = useState(false);
  const { state, data, error, reload } = useBasicLoad(() => listMyGoals());
  const goals = data ?? [];
  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createMyGoal({ title: String(form.get("title") || ""), description: String(form.get("description") || ""), targetDate: String(form.get("targetDate") || "") || undefined });
      e.currentTarget.reset();
      reload();
    } finally {
      setSaving(false);
    }
  }
  async function bump(goal: StudentGoal, progressPercent: number) {
    await patchGoal(goal.id, { progressPercent, status: progressPercent >= 100 ? "completed" : goal.status });
    reload();
  }
  return (
    <div className="ui-page">
      <PageHeader title="Goals" description="Set and track your academic goals." icon={<CheckCircle2 size={22} />} />
      <Card>
        <CardHeader title="New goal" subtitle="Create a measurable target for this term." />
        <CardSection>
          <form onSubmit={onCreate} className="ui-grid ui-grid-3">
            <input name="title" required placeholder="Goal title" style={{ padding: "0.65rem 0.8rem" }} />
            <input name="description" placeholder="Description" style={{ padding: "0.65rem 0.8rem" }} />
            <input name="targetDate" type="date" style={{ padding: "0.65rem 0.8rem" }} />
            <Button type="submit" loading={saving} leftIcon={<Plus size={16} />}>Add goal</Button>
          </form>
        </CardSection>
      </Card>
      <div style={{ marginTop: "1rem" }}>
        {state === "loading" ? <LoadingGrid /> : null}
        {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
        {state === "ready" && goals.length === 0 ? <Card padded><EmptyState icon={<CheckCircle2 size={28} />} title="No goals yet" description="Add your first goal to start tracking progress." /></Card> : null}
        {goals.length > 0 ? (
          <div className="ui-grid ui-grid-2">
            {goals.map((g) => (
              <DataCard key={g.id} title={g.title} meta={`${g.status} · ${g.progressPercent}% · due ${formatDate(g.targetDate)}`} body={g.description} action={<Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); void bump(g, Math.min(100, (g.progressPercent || 0) + 10)); }}>+10%</Button>} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StudentFeedbackPage({ role = "student" }: { role?: "student" | "parent" }) {
  const [saving, setSaving] = useState(false);
  const { state, data, error, reload } = useBasicLoad(() => listMyFeedback());
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await submitFeedback({ category: "general", message: String(form.get("message") || ""), isAnonymous: form.get("anonymous") === "on" });
      e.currentTarget.reset();
      reload();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="ui-page">
      <PageHeader title="Feedback" description={role === "parent" ? "Share feedback with the school." : "Share feedback with teachers and the school."} icon={<MessageCircleHeart size={22} />} />
      <Card>
        <CardHeader title="Submit feedback" subtitle="Send a note to the school team." />
        <CardSection>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <textarea name="message" required rows={4} placeholder="Write your feedback..." style={{ padding: "0.75rem", border: "1px solid var(--gray-200)", borderRadius: 8, resize: "vertical" }} />
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--gray-600)" }}><input name="anonymous" type="checkbox" defaultChecked /> Send anonymously</label>
            <Button type="submit" loading={saving} leftIcon={<Send size={16} />}>Submit feedback</Button>
          </form>
        </CardSection>
      </Card>
      <div style={{ marginTop: "1rem" }}>
        {state === "loading" ? <LoadingGrid /> : null}
        {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
        {state === "ready" && (data?.length ?? 0) === 0 ? <Card padded><EmptyState title="No visible feedback history" description="Anonymous feedback is intentionally hidden from your personal history." /></Card> : null}
        {(data ?? []).length > 0 ? <div className="ui-grid ui-grid-2">{(data ?? []).map((f) => <DataCard key={f.id} title={f.category} meta={`${f.status} · ${formatDateTime(f.createdAt)}`} body={f.message} />)}</div> : null}
      </div>
    </div>
  );
}

export function StudentAchievementsPage() {
  const { state, data, error, reload } = useBasicLoad(async () => {
    const [badges, points, progress] = await Promise.all([listMyBadges(), myBadgePoints().catch(() => 0), myGamificationProgress().catch(() => ({}))]);
    return { badges, points, progress };
  });
  const pointValue = typeof data?.points === "number" ? data.points : data?.points.points ?? data?.points.total ?? 0;
  return (
    <div className="ui-page">
      <PageHeader title="Achievements" description="Badges, points, and progress milestones." icon={<Award size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="ui-grid ui-grid-3">
            <StatTile label="Badge points" value={pointValue} icon={<Award size={16} />} tone="warning" />
            <StatTile label="Badges earned" value={data.badges.length} icon={<CheckCircle2 size={16} />} tone="success" />
            <StatTile label="Progress signals" value={Object.keys(data.progress).length} icon={<ListChecks size={16} />} tone="info" />
          </div>
          <div style={{ marginTop: "1rem" }}>
            {data.badges.length === 0 ? <Card padded><EmptyState icon={<Award size={28} />} title="No badges yet" description="Badges will appear after achievements are awarded." /></Card> : (
              <div className="ui-grid ui-grid-2">{data.badges.map((b, i) => <DataCard key={b.id ?? i} title={b.badge?.name || b.name || "Badge"} meta={`${b.badge?.pointsValue ?? b.pointsValue ?? 0} points`} body={b.badge?.description || b.description} />)}</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function TeacherClassesPage() {
  const { state, data, error, reload } = useBasicLoad(async () => {
    const year = await getActiveAcademicYear();
    const classes = year?.id ? await listMyClassOfferings(year.id) : [];
    const rosters = await Promise.all(classes.map(async (c) => [c.id, await getClassRoster(c.id).catch(() => null)] as const));
    return { classes, rosterMap: new Map(rosters) };
  });
  return (
    <div className="ui-page">
      <PageHeader title="My classes" description="Sections you teach, rosters, and quick actions." icon={<GraduationCap size={22} />} />
      {state === "loading" ? <LoadingGrid /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      {state === "ready" && (data?.classes.length ?? 0) === 0 ? <Card padded><EmptyState icon={<GraduationCap size={28} />} title="No classes assigned" description="Your assigned class offerings will appear here." /></Card> : null}
      {data ? (
        <div className="ui-grid ui-grid-2">
          {data.classes.map((c) => {
            const roster = data.rosterMap.get(c.id);
            return (
              <Card key={c.id}>
                <CardHeader title={offeringLabel(c)} subtitle={[c.gradeName, c.sectionName, c.subjectName].filter(Boolean).join(" · ")} action={<Badge tone="primary">{roster?.studentCount ?? 0} students</Badge>} />
                <CardSection>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Link className="btn btn-outline btn-sm" href="/teacher/attendance">Attendance</Link>
                    <Link className="btn btn-outline btn-sm" href="/teacher/exams">Exams</Link>
                    <Link className="btn btn-outline btn-sm" href="/teacher/grades">Grades</Link>
                  </div>
                </CardSection>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function TeacherMaterialsPage() {
  const [saving, setSaving] = useState(false);
  const { state, data, error, reload } = useBasicLoad(async () => {
    const year = await getActiveAcademicYear();
    return year?.id ? listMyClassOfferings(year.id) : [];
  });
  const classes = data ?? [];
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const classId = String(form.get("classOfferingId") || "");
    const selected = classes.find((c) => c.id === classId);
    setSaving(true);
    try {
      await createLearningMaterial({
        title: String(form.get("title") || ""),
        type: "link",
        subject: selected?.subjectName || "General",
        grade: Number(String(selected?.gradeName || "").match(/\d+/)?.[0] ?? 0),
        classOfferingId: classId,
        description: String(form.get("description") || ""),
        link: String(form.get("link") || ""),
      });
      e.currentTarget.reset();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="ui-page">
      <PageHeader title="Learning materials" description="Share links and resources for your classes." icon={<FolderOpen size={22} />} />
      {state === "loading" ? <LoadingGrid count={2} /> : null}
      {state === "error" && error ? <ErrorCard message={error} onRetry={reload} /> : null}
      <Card>
        <CardHeader title="Create material" subtitle="MVP supports link materials; file upload can be added next." />
        <CardSection>
          <form onSubmit={onSubmit} className="ui-grid ui-grid-2">
            <select name="classOfferingId" required style={{ padding: "0.65rem 0.8rem" }}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{offeringLabel(c)}</option>)}
            </select>
            <input name="title" required placeholder="Title" style={{ padding: "0.65rem 0.8rem" }} />
            <input name="link" required type="url" placeholder="https://..." style={{ padding: "0.65rem 0.8rem" }} />
            <input name="description" placeholder="Description" style={{ padding: "0.65rem 0.8rem" }} />
            <Button type="submit" loading={saving} leftIcon={<Plus size={16} />}>Create material</Button>
          </form>
        </CardSection>
      </Card>
    </div>
  );
}

function useParentChildren() {
  return useBasicLoad(() => myChildren());
}

function ChildSelector({ childrenList, selectedId, onSelect }: { childrenList: ChildLink[]; selectedId: string; onSelect: (id: string) => void }) {
  if (childrenList.length <= 1) return null;
  return (
    <Card padded>
      <select value={selectedId} onChange={(e) => onSelect(e.target.value)} style={{ padding: "0.65rem 0.8rem", width: "100%" }}>
        {childrenList.map((c) => <option key={c.studentId} value={c.studentId}>{c.student ? fullName(c.student.firstName, c.student.lastName) : c.studentId}</option>)}
      </select>
    </Card>
  );
}

export function ParentAttendancePage() {
  const kids = useParentChildren();
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && kids.data?.[0]?.studentId) setSelectedId(kids.data[0].studentId);
  }, [kids.data, selectedId]);
  const report = useBasicLoad(() => selectedId ? studentAttendanceReport(selectedId) : Promise.resolve(null), [selectedId]);
  const records = report.data?.records ?? report.data?.sessions ?? [];
  return (
    <div className="ui-page">
      <PageHeader title="Attendance" description="Daily attendance and absence history for your child." icon={<ClipboardCheck size={22} />} />
      {kids.state === "loading" ? <LoadingGrid count={1} /> : null}
      {kids.data ? <ChildSelector childrenList={kids.data} selectedId={selectedId} onSelect={setSelectedId} /> : null}
      {report.state === "loading" ? <LoadingGrid /> : null}
      {report.error ? <ErrorCard message={report.error} onRetry={report.reload} /> : null}
      {records.length === 0 && report.state === "ready" ? <Card padded><EmptyState title="No attendance records" description="Attendance history will appear after teachers submit sessions." /></Card> : null}
      {records.length > 0 ? (
        <div className="ui-grid ui-grid-2">
          {records.map((r, i) => <DataCard key={(r as { markId?: string; sessionId?: string }).markId ?? (r as { sessionId?: string }).sessionId ?? i} title={(r as { status?: string }).status || "Attendance"} meta={formatDate((r as { date?: string; sessionDate?: string }).date || (r as { sessionDate?: string }).sessionDate)} body={(r as { note?: string | null }).note || ((r as { subject?: { name: string } | null }).subject?.name ?? null)} action={<Badge tone={(r as { status?: string }).status === "absent" ? "danger" : "success"}>{(r as { status?: string }).status || "record"}</Badge>} />)}
        </div>
      ) : null}
    </div>
  );
}

export function ParentSubjectsPage() {
  const kids = useParentChildren();
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && kids.data?.[0]?.studentId) setSelectedId(kids.data[0].studentId);
  }, [kids.data, selectedId]);
  const subjects = useBasicLoad(() => selectedId ? listChildSubjects(selectedId) : Promise.resolve([]), [selectedId]);
  return (
    <div className="ui-page">
      <PageHeader title="Subjects" description="Subjects your child is taking and who teaches them." icon={<BookOpen size={22} />} />
      {kids.data ? <ChildSelector childrenList={kids.data} selectedId={selectedId} onSelect={setSelectedId} /> : null}
      {subjects.state === "loading" ? <LoadingGrid /> : null}
      {subjects.error ? <ErrorCard message={subjects.error} onRetry={subjects.reload} /> : null}
      {subjects.data && subjects.data.length > 0 ? <SubjectGrid subjects={subjects.data} /> : null}
      {subjects.state === "ready" && (subjects.data?.length ?? 0) === 0 ? <Card padded><EmptyState title="No subjects" description="Subjects will appear once your child is enrolled." /></Card> : null}
    </div>
  );
}

export function ParentTeachersPage() {
  const kids = useParentChildren();
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && kids.data?.[0]?.studentId) setSelectedId(kids.data[0].studentId);
  }, [kids.data, selectedId]);
  const detail = useBasicLoad(() => selectedId ? getStudentDetail(selectedId) : Promise.resolve(null), [selectedId]);
  const teachers = detail.data?.teachers ?? [];
  return (
    <div className="ui-page">
      <PageHeader title="Teachers" description="Teachers assigned to your child." icon={<Users size={22} />} />
      {kids.data ? <ChildSelector childrenList={kids.data} selectedId={selectedId} onSelect={setSelectedId} /> : null}
      {detail.state === "loading" ? <LoadingGrid /> : null}
      {detail.error ? <ErrorCard message={detail.error} onRetry={detail.reload} /> : null}
      {teachers.length > 0 ? <div className="ui-grid ui-grid-2">{teachers.map((t) => <DataCard key={t.id} title={fullName(t.firstName, t.lastName)} meta={t.email} body={t.subjectName ? `Subject: ${t.subjectName}` : null} />)}</div> : null}
      {detail.state === "ready" && teachers.length === 0 ? <Card padded><EmptyState title="No teachers" description="Teacher assignments will appear after class setup." /></Card> : null}
    </div>
  );
}

export function ParentAnnouncementsPage() {
  return <AnnouncementsPage role="parent" />;
}

export function ParentFeedbackPage() {
  return <StudentFeedbackPage role="parent" />;
}

export function ParentNotificationsPage() {
  return <NotificationsPage />;
}

export function ParentCalendarPage() {
  return <CalendarPage role="parent" />;
}

export function ParentOverviewCards() {
  const kids = useParentChildren();
  const upcoming = useBasicLoad(async () => {
    const first = kids.data?.[0]?.studentId;
    return first ? getChildUpcoming(first) : null;
  }, [kids.data?.[0]?.studentId]);
  return null;
}

export function StudentAnnouncementsPage() {
  return <AnnouncementsPage role="student" />;
}

export function StudentCalendarPage() {
  return <CalendarPage role="student" />;
}

export function StudentNotificationsPage() {
  return <NotificationsPage />;
}

export function StudentTextbooksPage() {
  return <TextbooksPage />;
}

export function AdminTextbooksPage() {
  return <TextbooksPage admin />;
}
