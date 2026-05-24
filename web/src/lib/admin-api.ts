import { authFetch } from "./auth";
import { getApiBase } from "./api";

function url(path: string) {
  return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

function errMessage(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.map(String).join(", ");
    if (typeof m === "string") return m;
  }
  return "Request failed";
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return authFetch(url(path), { ...init, headers });
}

export async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await adminFetch(path, init);
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(errMessage(data));
  return data as T;
}

// --- Types (minimal; API returns camelCase from Nest/TypeORM) ---

export type PublicUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profileImageFileId?: string | null;
  grade?: string | null;
  section?: string | null;
  subject?: string | null;
  department?: string | null;
  childName?: string | null;
  relationship?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
};

export type AcademicYear = {
  id: string;
  label: string;
  isActive?: boolean;
  isArchived?: boolean;
  startDate?: string;
  endDate?: string;
  terms?: TermRow[];
};

export type TermRow = {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type Grade = { id: string; name: string; orderIndex?: number };
export type Section = { id: string; name: string };
export type Subject = { id: string; name: string; code?: string | null };

export type ClassOffering = {
  id: string;
  academicYearId: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  name?: string | null;
  /** Set by API list endpoints when grade/section/subject rows exist */
  gradeName?: string | null;
  sectionName?: string | null;
  subjectName?: string | null;
  displayName?: string;
  createdAt?: string;
};

export type Enrollment = {
  id: string;
  studentId: string;
  classOfferingId: string;
  academicYearId: string;
  status: string;
};

export type ParentLink = {
  id: string;
  parentId: string;
  studentId: string;
  relationship: string;
  isPrimary?: boolean;
};

export type Announcement = {
  id: string;
  academicYearId: string;
  title: string;
  body: string;
  audience: string;
  targetGrade?: string | null;
  targetSection?: string | null;
  classOfferingId?: string | null;
  classOffering?: {
    id: string;
    class?: { name: string };
    subject?: { name: string };
  };
  authorId: string;
  createdAt: string;
  termId?: string | null;
};

export type FeedbackTicket = {
  id: string;
  /** Null when ticket is anonymous (admin list hides real author id). */
  authorId: string | null;
  isAnonymous?: boolean;
  category: string;
  message: string;
  status: string;
  assigneeId?: string | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  classOfferingId?: string | null;
  parentVisible?: boolean;
  createdById: string;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  lastMessageSenderId?: string | null;
  blockedByMe?: boolean;
  blockedMe?: boolean;
  avatarFileId?: string | null;
  memberIds?: string[];
  members?: Array<{
    userId: string;
    displayName: string;
    role?: string | null;
    isOnline?: boolean;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string | null;
  replyToId?: string | null;
  mediaFileId?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: Record<string, string[]> | null;
  imageUrl?: string;
  type?: string;
  createdAt: string;
};

export type FileRecord = {
  id: string;
  filename: string;
  mime: string;
  path: string;
  storageProvider?: string;
  storageKey?: string | null;
  version?: string | null;
  etag?: string | null;
  sizeBytes?: string | null;
  uploadedById: string;
  createdAt?: string;
};

export type AttendanceSession = { id: string; classOfferingId: string; date: string; takenById: string; termId?: string | null };
export type AttendanceMark = { id: string; sessionId: string; studentId: string; status: string; note?: string | null };

export async function patchMe(body: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImageFileId?: string;
  subject?: string;
  experience?: string;
  officeRoom?: string;
  country?: string;
  cityState?: string;
  postalCode?: string;
  department?: string;
  homeroomClass?: string;
}): Promise<any> {
  return adminJson<any>("/api/users/me", { method: "PATCH", body: JSON.stringify(body) });
}

export type CalendarEventRecord = {
  id: string;
  academicYearId: string;
  title: string;
  date: string;
  time?: string | null;
  type: string;
  description?: string | null;
  classOfferingId?: string | null;
  createdById?: string;
  termId?: string | null;
};

// --- API ---

export async function getActiveAcademicYear(): Promise<AcademicYear | null> {
  const r = await adminJson<{ data: AcademicYear | null }>("/api/academic-years/active", { method: "GET" });
  return r.data ?? null;
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  return adminJson<AcademicYear[]>("/api/academic-years", { method: "GET" });
}

export async function getAcademicYear(id: string): Promise<AcademicYear> {
  return adminJson<AcademicYear>(`/api/academic-years/${id}`, { method: "GET" });
}

export async function createAcademicYear(body: {
  label: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}): Promise<AcademicYear> {
  return adminJson<AcademicYear>("/api/academic-years", { method: "POST", body: JSON.stringify(body) });
}

export async function patchAcademicYear(
  id: string,
  body: { label?: string; startDate?: string; endDate?: string; isArchived?: boolean },
): Promise<AcademicYear> {
  return adminJson<AcademicYear>(`/api/academic-years/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteAcademicYear(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/academic-years/${id}`, { method: "DELETE" });
}

export async function closeAcademicYear(id: string): Promise<unknown> {
  return adminJson(`/api/academic-years/${id}/close`, { method: "POST" });
}

export async function rolloverAcademicYear(
  id: string,
  newLabel: string,
  dryRun: boolean,
): Promise<{ createdYearId?: string; offeringsCopied: number }> {
  const q = new URLSearchParams({ newLabel, dryRun: String(dryRun) });
  return adminJson(`/api/academic-years/${id}/rollover?${q}`, { method: "POST" });
}

export async function listTerms(yearId: string): Promise<TermRow[]> {
  return adminJson<TermRow[]>(`/api/academic-years/${yearId}/terms`, { method: "GET" });
}

export async function addTerm(
  yearId: string,
  body: { name: string; startDate: string; endDate: string },
): Promise<TermRow> {
  return adminJson<TermRow>(`/api/academic-years/${yearId}/terms`, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteTerm(termId: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/academic-years/terms/${termId}`, { method: "DELETE" });
}

export async function createGrade(body: { name: string; orderIndex?: number; sectionIds?: string[] }): Promise<Grade> {
  return adminJson<Grade>("/api/grades", { method: "POST", body: JSON.stringify(body) });
}

export async function patchGrade(id: string, body: { name?: string; orderIndex?: number }): Promise<Grade> {
  return adminJson<Grade>(`/api/grades/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteGrade(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/grades/${id}`, { method: "DELETE" });
}

export async function createSection(body: { name: string }): Promise<Section> {
  return adminJson<Section>("/api/sections", { method: "POST", body: JSON.stringify(body) });
}

export async function patchSection(id: string, body: { name: string }): Promise<Section> {
  return adminJson<Section>(`/api/sections/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteSection(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/sections/${id}`, { method: "DELETE" });
}

export async function createSubject(body: { name: string; code?: string }): Promise<Subject> {
  return adminJson<Subject>("/api/subjects", { method: "POST", body: JSON.stringify(body) });
}

export async function patchSubject(id: string, body: { name?: string; code?: string | null }): Promise<Subject> {
  return adminJson<Subject>(`/api/subjects/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteSubject(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/subjects/${id}`, { method: "DELETE" });
}

export async function listGrades(): Promise<Grade[]> {
  return adminJson<Grade[]>("/api/grades", { method: "GET" });
}

export async function listSections(): Promise<Section[]> {
  return adminJson<Section[]>("/api/sections", { method: "GET" });
}

export async function getSectionsForGrade(gradeId: string): Promise<Section[]> {
  return adminJson<Section[]>(`/api/school-structure/grades/${gradeId}/sections`, { method: "GET" });
}

export async function assignSectionsToGrade(
  gradeId: string,
  sectionIds: string[]
): Promise<{ assigned: number; sections: Section[] }> {
  return adminJson<{ assigned: number; sections: Section[] }>(
    `/api/school-structure/grades/${gradeId}/sections`,
    {
      method: "POST",
      body: JSON.stringify({ sectionIds }),
    }
  );
}

export async function removeSectionFromGrade(
  gradeId: string,
  sectionId: string
): Promise<{ success: boolean }> {
  return adminJson<{ success: boolean }>(
    `/api/school-structure/grades/${gradeId}/sections/${sectionId}`,
    { method: "DELETE" }
  );
}

export async function getSubjectsForGrade(gradeId: string): Promise<Subject[]> {
  return adminJson<Subject[]>(`/api/school-structure/grades/${gradeId}/subjects`, { method: "GET" });
}

export async function assignSubjectsToGrade(
  gradeId: string,
  subjectIds: string[]
): Promise<void> {
  for (const subjectId of subjectIds) {
    await adminJson(`/api/school-structure/grades/${gradeId}/subjects`, {
      method: "POST",
      body: JSON.stringify({ subjectId }),
    });
  }
}

export async function removeSubjectFromGrade(
  gradeId: string,
  subjectId: string
): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(
    `/api/school-structure/grades/${gradeId}/subjects/${subjectId}`,
    { method: "DELETE" }
  );
}

export async function listSubjects(): Promise<Subject[]> {
  return adminJson<Subject[]>("/api/subjects", { method: "GET" });
}

export async function listClassOfferings(academicYearId: string): Promise<ClassOffering[]> {
  const q = new URLSearchParams({ academicYearId });
  return adminJson<ClassOffering[]>(`/api/class-offerings?${q}`, { method: "GET" });
}

export async function getClassOffering(id: string): Promise<ClassOffering> {
  return adminJson<ClassOffering>(`/api/class-offerings/${id}`, { method: "GET" });
}

export async function activateAcademicYear(id: string): Promise<unknown> {
  return adminJson(`/api/academic-years/${id}/activate`, { method: "POST" });
}

export async function createClassOffering(body: {
  academicYearId: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  name?: string;
}): Promise<ClassOffering> {
  return adminJson<ClassOffering>("/api/class-offerings", { method: "POST", body: JSON.stringify(body) });
}

/**
 * Bulk create class offerings for multiple section-subject combinations
 */
export async function bulkCreateClassOfferings(body: {
  academicYearId: string;
  gradeId: string;
  sectionIds: string[];
  subjectIds: string[];
  teacherId: string;
}): Promise<{
  created: number;
  skipped: number;
  errors: Array<{ sectionId: string; subjectId: string; reason: string }>;
  summary: string;
}> {
  return adminJson("/api/class-offerings/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchClassOffering(id: string, body: { teacherId?: string; name?: string | null }): Promise<ClassOffering> {
  return adminJson<ClassOffering>(`/api/class-offerings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteClassOffering(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/class-offerings/${id}`, { method: "DELETE" });
}

export async function searchUsers(role?: "student" | "teacher" | "parent" | "admin", q?: string): Promise<PublicUser[]> {
  const p = new URLSearchParams();
  if (role) p.set("role", role);
  if (q) p.set("q", q);
  const qs = p.toString();
  return adminJson<PublicUser[]>(`/api/users/search${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function listUsers(role?: "student" | "teacher" | "parent" | "admin", q?: string): Promise<PublicUser[]> {
  const p = new URLSearchParams();
  if (role) p.set("role", role);
  if (q) p.set("q", q);
  const qs = p.toString();
  return adminJson<PublicUser[]>(`/api/users${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function getUser(id: string): Promise<PublicUser> {
  return adminJson<PublicUser>(`/api/users/${id}`, { method: "GET" });
}

export async function patchUser(
  id: string,
  body: Partial<Pick<PublicUser, "firstName" | "lastName" | "phone" | "profileImageFileId" | "grade" | "section">>,
): Promise<PublicUser> {
  return adminJson<PublicUser>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function uploadProfileImage(file: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return adminJson<{ id: string }>("/api/files/upload", {
    method: "POST",
    body: fd,
  });
}

export async function listEnrollments(filters: { classOfferingId?: string; academicYearId?: string; studentId?: string }): Promise<Enrollment[]> {
  const p = new URLSearchParams();
  if (filters.classOfferingId) p.set("classOfferingId", filters.classOfferingId);
  if (filters.academicYearId) p.set("academicYearId", filters.academicYearId);
  if (filters.studentId) p.set("studentId", filters.studentId);
  return adminJson<Enrollment[]>(`/api/enrollments?${p}`, { method: "GET" });
}

export async function createEnrollment(body: { studentId: string; classOfferingId: string; academicYearId: string }): Promise<Enrollment> {
  return adminJson<Enrollment>("/api/enrollments", { method: "POST", body: JSON.stringify(body) });
}

export async function assignStudentsToSection(body: {
  academicYearId?: string;
  gradeId: string;
  sectionId: string;
  studentIds: string[];
}): Promise<{
  academicYearId: string;
  academicYearLabel: string;
  gradeId: string;
  gradeName: string;
  sectionId: string;
  sectionName: string;
  studentCount: number;
  classOfferingCount: number;
  enrollmentsCreated: number;
  enrollmentsSkipped: number;
  updatedStudents: Array<{ id: string; grade: string | null; section: string | null }>;
}> {
  return adminJson("/api/enrollments/assign-section", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteEnrollment(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/enrollments/${id}`, { method: "DELETE" });
}

export async function clearStudentsSection(body: { studentIds: string[] }) : Promise<{ studentsCleared: number; enrollmentsRemoved: number }> {
  return adminJson(`/api/enrollments/clear-section`, { method: "POST", body: JSON.stringify(body) });
}

export async function listParentLinks(filters?: { parentId?: string; studentId?: string }): Promise<ParentLink[]> {
  const p = new URLSearchParams();
  if (filters?.parentId) p.set("parentId", filters.parentId);
  if (filters?.studentId) p.set("studentId", filters.studentId);
  const qs = p.toString();
  return adminJson<ParentLink[]>(`/api/parent-students${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function listStudents(filters?: { grade?: string; section?: string; q?: string }): Promise<PublicUser[]> {
  const p = new URLSearchParams();
  if (filters?.grade) p.set("grade", filters.grade);
  if (filters?.section) p.set("section", filters.section);
  if (filters?.q) p.set("q", filters.q);
  const qs = p.toString();
  return adminJson<PublicUser[]>(`/api/users/students${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function createParentLink(body: {
  parentId: string;
  studentId: string;
  relationship: string;
  isPrimary?: boolean;
}): Promise<ParentLink> {
  return adminJson<ParentLink>("/api/parent-students", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteParentLink(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/parent-students/${id}`, { method: "DELETE" });
}

export async function listAnnouncements(academicYearId?: string, termId?: string): Promise<Announcement[]> {
  const p = new URLSearchParams();
  if (academicYearId) p.set("academicYearId", academicYearId);
  if (termId) p.set("termId", termId);
  const q = p.toString() ? `?${p.toString()}` : "";
  return adminJson<Announcement[]>(`/api/announcements${q}`, { method: "GET" });
}

/** Visible announcements for the current user (student/parent filtering applied server-side). */
export async function announcementsForMe(termId?: string): Promise<Announcement[]> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<Announcement[]>(`/api/announcements/for-me${q}`, { method: "GET" });
}

export async function teacherDashboard(termId?: string): Promise<{
  myClasses: number;
  totalStudents: number;
  pendingGradingApprox: number;
  unreadNotifications: number;
  attendanceRate: number | null;
  publishedExams: number;
  recentAnnouncements: number;
}> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<{
    myClasses: number;
    totalStudents: number;
    pendingGradingApprox: number;
    unreadNotifications: number;
    attendanceRate: number | null;
    publishedExams: number;
    recentAnnouncements: number;
  }>(`/api/dashboard/teacher${q}`, { method: "GET" });
}

export async function studentDashboard() {
  return adminJson<{
    activeEnrollments: number;
    unreadNotifications: number;
  }>("/api/dashboard/student", { method: "GET" });
}

export async function parentDashboard() {
  return adminJson<{
    linkedChildren: number;
    unreadNotifications: number;
  }>("/api/dashboard/parent", { method: "GET" });
}

export async function listMyClassOfferings(academicYearId: string): Promise<ClassOffering[]> {
  return adminJson<ClassOffering[]>(
    `/api/class-offerings/mine?academicYearId=${encodeURIComponent(academicYearId)}`,
    { method: "GET" },
  );
}

export async function listAllClassOfferings(academicYearId: string): Promise<ClassOffering[]> {
  return adminJson<ClassOffering[]>(`/api/class-offerings?academicYearId=${encodeURIComponent(academicYearId)}`, {
    method: "GET",
  });
}

export async function listCalendarEvents(filters: {
  from?: string;
  to?: string;
  academicYearId?: string;
  classOfferingId?: string;
  termId?: string;
}): Promise<CalendarEventRecord[]> {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  if (filters.academicYearId) p.set("academicYearId", filters.academicYearId);
  if (filters.classOfferingId) p.set("classOfferingId", filters.classOfferingId);
  if (filters.termId) p.set("termId", filters.termId);
  const qs = p.toString();
  return adminJson<CalendarEventRecord[]>(`/api/calendar-events${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function createCalendarEvent(body: {
  academicYearId: string;
  title: string;
  date: string;
  time?: string;
  type: string;
  description?: string;
  classOfferingId?: string;
  termId?: string;
}): Promise<CalendarEventRecord> {
  return adminJson<CalendarEventRecord>("/api/calendar-events", { method: "POST", body: JSON.stringify(body) });
}

export async function updateCalendarEvent(id: string, body: Partial<{
  academicYearId: string;
  title: string;
  date: string;
  time?: string;
  type: string;
  description?: string;
  classOfferingId?: string;
  termId?: string;
}>): Promise<CalendarEventRecord> {
  return adminJson<CalendarEventRecord>(`/api/calendar-events/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/calendar-events/${id}`, { method: "DELETE" });
}

export async function createAnnouncement(body: {
  academicYearId: string;
  title: string;
  body: string;
  audience: string;
  classOfferingId?: string;
  targetGrade?: string;
  targetSection?: string;
  termId?: string;
}): Promise<Announcement> {
  return adminJson<Announcement>("/api/announcements", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await adminJson<{ ok: boolean }>(`/api/announcements/${id}`, { method: "DELETE" });
}

export async function listFeedback(): Promise<FeedbackTicket[]> {
  return adminJson<FeedbackTicket[]>("/api/feedback", { method: "GET" });
}

export async function patchFeedback(id: string, body: { status?: string; assigneeId?: string | null }): Promise<FeedbackTicket> {
  return adminJson<FeedbackTicket>(`/api/feedback/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function adminDashboard() {
  return adminJson<{
    users: { admin: number; teacher: number; student: number; parent: number; total: number };
    classes: number;
    enrollments: number;
  }>("/api/dashboard/admin", { method: "GET" });
}

export async function adminAnalytics() {
  return adminJson<{
    generatedAt: string;
    users: { admin: number; teacher: number; student: number; parent: number; total: number };
    feedbackTicketsByStatus: { status: string; count: number }[];
    exams: { publishedCount: number };
    examAttempts: { submitted: number; released: number };
    attendance: {
      marksRecordedLast30Days: number;
      presentOrLateLast30Days: number;
      presentRateLast30DaysApprox: number | null;
    };
    announcementsTotal: number;
  }>("/api/analytics/admin/summary", { method: "GET" });
}

export async function listAuditLogs(limit = 100) {
  return adminJson<unknown[]>(`/api/audit-logs?limit=${limit}`, { method: "GET" });
}

export async function listAttendanceSessions(classOfferingId: string, termId?: string): Promise<AttendanceSession[]> {
  const p = new URLSearchParams({ classOfferingId });
  if (termId) p.set("termId", termId);
  return adminJson<AttendanceSession[]>(`/api/attendance-sessions?${p.toString()}`, {
    method: "GET",
  });
}

export async function createAttendanceSession(body: { classOfferingId: string; date: string; termId?: string }): Promise<AttendanceSession> {
  return adminJson<AttendanceSession>("/api/attendance-sessions", { method: "POST", body: JSON.stringify(body) });
}

export async function getSessionMarks(sessionId: string): Promise<AttendanceMark[]> {
  return adminJson<AttendanceMark[]>(`/api/attendance-sessions/${sessionId}/marks`, { method: "GET" });
}

export async function putSessionMarks(sessionId: string, marks: { studentId: string; status: string }[]): Promise<AttendanceMark[]> {
  return adminJson<AttendanceMark[]>(`/api/attendance-sessions/${sessionId}/marks`, {
    method: "PUT",
    body: JSON.stringify({ marks }),
  });
}

export async function classAttendanceReport(classOfferingId: string) {
  return adminJson<{
    classOfferingId: string;
    sessions: { sessionId: string; date: string; marks: AttendanceMark[] }[];
  }>(`/api/reports/attendance/class/${classOfferingId}`, { method: "GET" });
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await adminJson<Conversation[] | { data: Conversation[] } | { conversations: Conversation[] } | { items: Conversation[] }>(
    "/api/conversations",
    { method: "GET" }
  );
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object") {
    if ("data" in res && Array.isArray((res as any).data)) return (res as any).data;
    if ("conversations" in res && Array.isArray((res as any).conversations)) return (res as any).conversations;
    if ("items" in res && Array.isArray((res as any).items)) return (res as any).items;
  }
  return [];
}

export async function listMessages(conversationId: string, limit = 80): Promise<ChatMessage[]> {
  const res = await adminJson<ChatMessage[] | { data: ChatMessage[] } | { messages: ChatMessage[] } | { items: ChatMessage[] }>(
    `/api/conversations/${conversationId}/messages?limit=${limit}`,
    { method: "GET" }
  );
  // Handle wrapped responses from NestJS
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object") {
    if ("data" in res && Array.isArray((res as any).data)) return (res as any).data;
    if ("messages" in res && Array.isArray((res as any).messages)) return (res as any).messages;
    if ("items" in res && Array.isArray((res as any).items)) return (res as any).items;
  }
  return [];
}

export async function postMessage(conversationId: string, text: string): Promise<ChatMessage> {
  return adminJson<ChatMessage>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function uploadChatFile(file: File): Promise<FileRecord> {
  const form = new FormData();
  form.append("file", file);
  const r = await adminFetch("/api/chat/files/upload", {
    method: "POST",
    body: form,
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(errMessage(data));
  return data as FileRecord;
}

export async function postChatMessage(conversationId: string, body: { text?: string | null; mediaFileId?: string | null; replyToId?: string | null }): Promise<ChatMessage> {
  return adminJson<ChatMessage>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function editChatMessage(messageId: string, text: string): Promise<ChatMessage> {
  return adminJson<ChatMessage>(`/api/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export async function deleteChatMessage(messageId: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/api/messages/${messageId}`, { method: "DELETE" });
}

export async function forwardChatMessage(targetConversationId: string, body: { text?: string | null; mediaFileId?: string | null }): Promise<ChatMessage> {
  return adminJson<ChatMessage>(`/api/conversations/${targetConversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function toggleChatMessageReaction(messageId: string, emoji: string): Promise<ChatMessage> {
  return adminJson<ChatMessage>(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function blockConversation(conversationId: string): Promise<{ blockedByMe: boolean; blockedMe: boolean; peerUserId: string | null }> {
  return adminJson(`/api/conversations/${conversationId}/block`, { method: "POST" });
}

export async function unblockConversation(conversationId: string): Promise<{ blockedByMe: boolean; blockedMe: boolean; peerUserId: string | null }> {
  return adminJson(`/api/conversations/${conversationId}/block`, { method: "DELETE" });
}

export async function createConversation(body: {
  type: string;
  title: string;
  memberIds: string[];
  classOfferingId?: string;
  parentVisible?: boolean;
}): Promise<Conversation | null> {
  return adminJson<Conversation | null>("/api/conversations", { method: "POST", body: JSON.stringify(body) });
}

export async function initiateDirectChat(targetUserId: string): Promise<{ conversation: Conversation; isNew: boolean }> {
  return adminJson<{ conversation: Conversation; isNew: boolean }>("/api/conversations/initiate", {
    method: "POST",
    body: JSON.stringify({ targetUserId }),
  });
}

export async function getUserSettings(): Promise<{ settingsJson: string | null } | Record<string, unknown>> {
  return adminJson("/api/me/settings", { method: "GET" });
}

export async function patchUserSettings(settingsJson: string): Promise<unknown> {
  return adminJson("/api/me/settings", { method: "PATCH", body: JSON.stringify({ settingsJson }) });
}

export async function getSchoolSettings(): Promise<{ settingsJson: string | null } | Record<string, unknown>> {
  return adminJson("/api/school/settings", { method: "GET" });
}

export async function patchSchoolSettings(settingsJson: string): Promise<unknown> {
  return adminJson("/api/school/settings", { method: "PATCH", body: JSON.stringify({ settingsJson }) });
}

// ── Exam Types ─────────────────────────────────────────────────────────────────

export type Exam = {
  id: string;
  title: string;
  academicYearId: string;
  classOfferingId?: string | null;
  termId?: string | null;
  /** Enriched class offering details returned by GET /exams */
  classOffering?: {
    classOfferingId: string;
    displayName: string;
    gradeName: string | null;
    sectionName: string | null;
    subjectName: string | null;
    subjectId: string;
    gradeId: string;
    sectionId: string;
    teacherId: string;
  } | null;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  minStayMinutes?: number;
  maxPoints: number;
  published: boolean;
  questionCount?: number;
  createdById: string;
  createdAt: string;
  /** Joined for students: their specific attempt for this exam */
  attempts?: AttemptHandle[];
};

export type ExamQuestion = {
  id: string;
  examId: string;
  questionId: string;
  orderIndex: number;
  points: number;
};

export type Question = {
  id: string;
  type: string;
  stem: string;
  optionsJson?: string | null;
  answerKey?: string | null;
  subjectId: string;
  createdById: string;
  createdAt: string;
};

export type ExamAttemptSummary = {
  attemptId: string;
  studentId: string;
  studentEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  submittedAt: string | null;
  releasedAt: string | null;
  score: number | null;
  autoScore: number | null;
  needsManualGrading: boolean;
};

export type ExamRosterStudent = {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  status: "not_started" | "in_progress" | "submitted";
  score: number | null;
  releasedAt: string | null;
  attemptId: string | null;
  violationCount: number;
  isLocked?: boolean;
  lockReason?: string | null;
};

export type Violation = { reason: string; timestamp: string };

export type BackendNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payloadJson?: string | null;
  readAt?: string | null;
  createdAt: string;
};

// ── Exam API ────────────────────────────────────────────────────────────────────

export async function listExams(academicYearId?: string, termId?: string): Promise<Exam[]> {
  const p = new URLSearchParams();
  if (academicYearId) p.set("academicYearId", academicYearId);
  if (termId) p.set("termId", termId);
  const q = p.toString() ? `?${p.toString()}` : "";
  return adminJson<Exam[]>(`/api/exams${q}`, { method: "GET" });
}

export async function createExam(body: {
  title: string;
  academicYearId: string;
  classOfferingId?: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  minStayMinutes?: number;
  maxPoints?: number;
  termId?: string;
}): Promise<Exam> {
  return adminJson<Exam>("/api/exams", { method: "POST", body: JSON.stringify(body) });
}

export async function updateExamMaxPoints(examId: string, maxPoints: number): Promise<Exam> {
  return adminJson<Exam>(`/api/exams/${examId}`, {
    method: "PATCH",
    body: JSON.stringify({ maxPoints }),
  });
}

export async function publishExam(examId: string): Promise<Exam> {
  return adminJson<Exam>(`/api/exams/${examId}/publish`, { method: "POST" });
}

export async function listExamAttempts(
  examId: string,
): Promise<{ examId: string; attempts: ExamAttemptSummary[] }> {
  return adminJson(`/api/exams/${examId}/attempts`, { method: "GET" });
}

export async function getExamStudentRoster(
  examId: string,
): Promise<{ examId: string; classOfferingId: string | null; students: ExamRosterStudent[] }> {
  return adminJson(`/api/exams/${examId}/students`, { method: "GET" });
}

// ── Question Bank API ───────────────────────────────────────────────────────────

export async function createQuestion(body: {
  type: string;
  stem: string;
  optionsJson?: string;
  answerKey?: string;
  subjectId: string;
}): Promise<Question> {
  return adminJson<Question>("/api/questions", { method: "POST", body: JSON.stringify(body) });
}

export async function listQuestions(subjectId?: string): Promise<Question[]> {
  const q = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  // Legacy: returns flat array for backward compat. Use listQuestionsFiltered for pagination.
  const res = await adminJson<Question[] | { items: Question[]; total: number }>(`/api/questions${q}`, { method: "GET" });
  return Array.isArray(res) ? res : res.items;
}

export async function addQuestionsToExam(
  examId: string,
  items: { questionId: string; orderIndex: number; points: number }[],
): Promise<ExamQuestion[]> {
  return adminJson<ExamQuestion[]>(`/api/exams/${examId}/questions`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

// ── Attempt / Grading API ────────────────────────────────────────────────────────

export async function gradeAttempt(attemptId: string, score: number): Promise<unknown> {
  return adminJson(`/api/attempts/${attemptId}/grade`, {
    method: "POST",
    body: JSON.stringify({ score }),
  });
}

export async function releaseAttempt(attemptId: string): Promise<unknown> {
  return adminJson(`/api/attempts/${attemptId}/release`, { method: "POST" });
}

export async function getAttemptForGrader(attemptId: string): Promise<unknown> {
  return adminJson(`/api/attempts/${attemptId}/for-grader`, { method: "GET" });
}

// ── Violation API ─────────────────────────────────────────────────────────────────

export async function recordViolation(attemptId: string, reason: string): Promise<{ locked: boolean }> {
  return adminJson<{locked: boolean}>(`/api/exams/attempts/${attemptId}/violations`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Called by teacher when monitoring active exams or from grading modal */
export async function getViolations(attemptId: string): Promise<Violation[]> {
  return adminJson<Violation[]>(`/api/exams/attempts/${attemptId}/violations`, { method: "GET" });
}

export async function controlExamAttempt(
  attemptId: string,
  action: "force_submit" | "warn" | "allow_rejoin",
  message?: string,
): Promise<{ success: boolean }> {
  return adminJson<{ success: boolean }>(`/api/exams/attempts/${attemptId}/control`, {
    method: "POST",
    body: JSON.stringify({ action, message }),
  });
}

// ── Notifications API ─────────────────────────────────────────────────────────────

export async function listNotifications(unreadOnly = false): Promise<BackendNotification[]> {
  const q = unreadOnly ? "?unreadOnly=true" : "";
  return adminJson<BackendNotification[]>(`/api/notifications${q}`, { method: "GET" });
}

export async function markNotificationRead(id: string): Promise<unknown> {
  return adminJson(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<unknown> {
  return adminJson("/api/notifications/read-all", { method: "POST" });
}

// ── Student Exam Flow API ─────────────────────────────────────────────────────

/** Returned when a student starts or resumes an attempt */
export type AttemptHandle = {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  releasedAt?: string | null;
  answersJson: string | null;
  score: number | null;
};

/** Question as seen by a student (no answer key) */
export type ExamQuestionForStudent = {
  id: string;
  type: string;
  stem: string;
  optionsJson: string | null;
  orderIndex: number;
  points: number;
};

/** Result returned after release */
export type AttemptResult = {
  attemptId: string;
  examId: string;
  examTitle: string;
  score: number | null;
  maxPoints: number;
  submittedAt: string;
  releasedAt: string | null;
  violations: Violation[];
  questions: {
    id: string;
    stem: string;
    type: string;
    optionsJson: string | null;
    answerKey: string | null;
    studentAnswer: string | null;
    points: number;
    orderIndex: number;
  }[];
};

/** Start or resume an attempt for the current student */
export async function startExamAttempt(examId: string): Promise<AttemptHandle> {
  return adminJson<AttemptHandle>(`/api/exams/${examId}/attempts`, { method: "POST" });
}

/** Fetch questions for an exam (student view — no answer keys) */
export async function getExamQuestions(examId: string): Promise<ExamQuestionForStudent[]> {
  return adminJson<ExamQuestionForStudent[]>(`/api/exams/${examId}/questions`, { method: "GET" });
}

/** Auto-save answers JSON blob */
export async function saveAttemptAnswers(attemptId: string, answersJson: string): Promise<unknown> {
  return adminJson(`/api/attempts/${attemptId}/answers`, {
    method: "POST",
    body: JSON.stringify({ answersJson }),
  });
}

/** Submit the attempt (locks it) */
export async function submitAttempt(attemptId: string): Promise<unknown> {
  return adminJson(`/api/attempts/${attemptId}/submit`, { method: "POST" });
}

/** Get released result for the student */
export async function getAttemptResult(attemptId: string): Promise<AttemptResult> {
  return adminJson<AttemptResult>(`/api/attempts/${attemptId}/result`, { method: "GET" });
}

/** List exams visible to the current student for a given academic year */
export async function listStudentExams(academicYearId: string, termId?: string): Promise<Exam[]> {
  const p = new URLSearchParams({ academicYearId });
  if (termId) p.set("termId", termId);
  return adminJson<Exam[]>(`/api/exams?${p.toString()}`, { method: "GET" });
}

// ── Grades API ─────────────────────────────────────────────────────────────────

export type GradeEntryType = "exam" | "assignment" | "quiz" | "project" | "other";

export type GradeEntry = {
  id: string;
  classOfferingId: string;
  studentId: string;
  teacherId: string;
  title: string;
  type: GradeEntryType;
  score: number | null;
  maxScore: number;
  note: string | null;
  examAttemptId: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  termId?: string | null;
};

export type GradeGroup = {
  title: string;
  type: GradeEntryType;
  maxScore: number;
  releasedAt: string | null;
  studentCount: number;
  entries: Array<{
    id: string;
    studentId: string;
    firstName: string | null;
    lastName: string | null;
    studentEmail: string | null;
    score: number | null;
    maxScore: number;
    note: string | null;
    releasedAt: string | null;
    examAttemptId: string | null;
  }>;
};

export type ClassGradesResponse = {
  classOfferingId: string;
  groups: GradeGroup[];
};

export async function bulkUpsertGrades(body: {
  classOfferingId: string;
  title: string;
  type: GradeEntryType;
  maxScore: number;
  note?: string;
  termId?: string;
  entries: { studentId: string; score: number | null }[];
}): Promise<{ saved: number; entries: GradeEntry[] }> {
  return adminJson("/api/grade-entries/bulk", { method: "POST", body: JSON.stringify(body) });
}
/** Alias for bulkUpsertGrades */
export const bulkGradeEntries = bulkUpsertGrades;

export async function createGradeEntry(body: {
  classOfferingId: string;
  studentId: string;
  title: string;
  type: GradeEntryType;
  score?: number | null;
  maxScore?: number;
  note?: string | null;
}): Promise<GradeEntry> {
  return adminJson<GradeEntry>("/api/grade-entries", { method: "POST", body: JSON.stringify(body) });
}

export async function updateGradeEntry(
  id: string,
  body: { title?: string; type?: GradeEntryType; score?: number | null; maxScore?: number; note?: string | null },
): Promise<GradeEntry> {
  return adminJson<GradeEntry>(`/api/grade-entries/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function releaseGrades(classOfferingId: string, title: string): Promise<{ released: number }> {
  return adminJson("/api/grade-entries/release", {
    method: "POST",
    body: JSON.stringify({ classOfferingId, title }),
  });
}

export async function deleteGradeEntry(id: string): Promise<{ ok: boolean }> {
  return adminJson(`/api/grade-entries/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteGradeGroup(classOfferingId: string, title: string): Promise<{ ok: boolean; deleted: number }> {
  return adminJson("/api/grade-entries/group", {
    method: "DELETE",
    body: JSON.stringify({ classOfferingId, title }),
  });
}

export async function listGradesForClass(classOfferingId: string, termId?: string): Promise<ClassGradesResponse> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<ClassGradesResponse>(`/api/grade-entries/class/${encodeURIComponent(classOfferingId)}${q}`, { method: "GET" });
}

export async function listGradesForStudent(studentId: string, termId?: string): Promise<GradeEntry[]> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<GradeEntry[]>(`/api/grade-entries/student/${encodeURIComponent(studentId)}${q}`, { method: "GET" });
}

export type StudentTermGradesEntry = {
  id: string;
  title: string;
  type: GradeEntryType;
  score: number | null;
  maxScore: number;
  percent: number | null;
  note: string | null;
  releasedAt: string | null;
  createdAt: string;
};

export type StudentTermGradesSubject = {
  subjectId: string;
  subjectName: string;
  entries: StudentTermGradesEntry[];
};

export type StudentTermGradesResponse = {
  studentId: string;
  studentName: string | null;
  termId: string;
  subjects: StudentTermGradesSubject[];
};

/** Released grade entries for a student tagged with a specific term, grouped by subject. */
export async function getStudentGradesByTerm(
  studentId: string,
  termId: string,
): Promise<StudentTermGradesResponse> {
  return adminJson<StudentTermGradesResponse>(
    `/api/grade-entries/student/${encodeURIComponent(studentId)}/term/${encodeURIComponent(termId)}`,
    { method: "GET" },
  );
}

export async function listQuestionsFiltered(opts: {
  subjectId?: string;
  classOfferingId?: string;
  skip?: number;
  take?: number;
}): Promise<{ items: Question[]; total: number; skip: number; take: number }> {
  const params = new URLSearchParams();
  if (opts.subjectId) params.set("subjectId", opts.subjectId);
  if (opts.classOfferingId) params.set("classOfferingId", opts.classOfferingId);
  if (opts.skip != null) params.set("skip", String(opts.skip));
  if (opts.take != null) params.set("take", String(opts.take));
  const q = params.toString() ? `?${params.toString()}` : "";
  return adminJson(`/api/questions${q}`, { method: "GET" });
}

// ── Exam Summary API ────────────────────────────────────────────────────────────

export type ExamSummaryStudentResult = {
  attemptId: string;
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  studentEmail: string | null;
  submittedAt: string | null;
  score: number | null;
  autoScore: number | null;
  maxPoints: number;
  needsManualGrading: boolean;
  releasedAt: string | null;
  isLocked: boolean;
};

export type ExamSummary = {
  examId: string;
  title: string;
  maxPoints: number;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  published: boolean;
  classOffering: {
    classOfferingId: string;
    displayName: string;
    gradeName: string | null;
    sectionName: string | null;
    subjectName: string | null;
  } | null;
  questionsAsked: Array<{
    examQuestionId: string;
    questionId: string;
    orderIndex: number;
    points: number;
    type: string;
    stem: string;
    optionsJson: string | null;
    answerKey: string | null;
  }>;
  studentResults: ExamSummaryStudentResult[];
  totalStudents: number;
  submitted: number;
  released: number;
};

export async function getExamSummary(examId: string): Promise<ExamSummary> {
  return adminJson<ExamSummary>(`/api/exams/${examId}/summary`, { method: "GET" });
}

export async function listExamAttemptsPaginated(
  examId: string,
  skip = 0,
  take = 20,
): Promise<{ examId: string; total: number; skip: number; take: number; attempts: ExamAttemptSummary[] }> {
  return adminJson(`/api/exams/${examId}/attempts?skip=${skip}&take=${take}`, { method: "GET" });
}

// ── Assignments API ───────────────────────────────────────────────────────────

export type SubmissionType = "file" | "text" | "none";
export type SubmissionStatus = "pending" | "submitted" | "graded" | "returned";

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  fileId: string | null;
  textContent: string | null;
  submittedAt: string | null;
  score: number | null;
  feedback: string | null;
  releasedAt: string | null;
  gradedById: string | null;
  createdAt: string;
  // enriched
  student?: { id: string; firstName: string; lastName: string; email: string } | null;
  file?: { id: string; filename: string; mime: string; path: string } | null;
};

export type Assignment = {
  id: string;
  classOfferingId: string;
  teacherId: string;
  title: string;
  description: string | null;
  submissionType: SubmissionType;
  attachmentFileId: string | null;
  deadline: string;
  maxScore: number;
  published: boolean;
  createdAt: string;
  termId?: string | null;
  // enriched
  subject?: { id: string; name: string; code: string | null } | null;
  grade?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  teacher?: { id: string; firstName: string; lastName: string; email: string } | null;
  attachment?: { id: string; filename: string; mime: string; path: string } | null;
  isOverdue?: boolean;
  submission?: AssignmentSubmission | null;
};

export async function createAssignment(body: {
  classOfferingId: string;
  title: string;
  description?: string;
  submissionType: SubmissionType;
  attachmentFileId?: string;
  deadline: string;
  maxScore?: number;
  termId?: string;
}): Promise<Assignment> {
  return adminJson<Assignment>("/api/assignments", { method: "POST", body: JSON.stringify(body) });
}

export async function updateAssignment(id: string, body: Partial<{
  title: string; description: string; submissionType: SubmissionType;
  attachmentFileId: string | null; deadline: string; maxScore: number;
}>): Promise<Assignment> {
  return adminJson<Assignment>(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function publishAssignment(id: string): Promise<{ ok: boolean; notified: number }> {
  return adminJson(`/api/assignments/${id}/publish`, { method: "POST" });
}

export async function unpublishAssignment(id: string): Promise<Assignment> {
  return adminJson(`/api/assignments/${id}/unpublish`, { method: "POST" });
}

export async function deleteAssignment(id: string): Promise<{ ok: boolean }> {
  return adminJson(`/api/assignments/${id}`, { method: "DELETE" });
}

export async function listMyAssignments(classOfferingId?: string, termId?: string): Promise<Assignment[]> {
  const p = new URLSearchParams();
  if (classOfferingId) p.set("classOfferingId", classOfferingId);
  if (termId) p.set("termId", termId);
  const q = p.toString() ? `?${p.toString()}` : "";
  return adminJson<Assignment[]>(`/api/assignments/teacher/mine${q}`, { method: "GET" });
}

export async function listAssignmentsForStudent(studentId: string, termId?: string): Promise<Assignment[]> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<Assignment[]>(`/api/assignments/student/${encodeURIComponent(studentId)}${q}`, { method: "GET" });
}

export async function getAssignment(id: string): Promise<Assignment> {
  return adminJson<Assignment>(`/api/assignments/${id}`, { method: "GET" });
}

export async function listSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  return adminJson<AssignmentSubmission[]>(`/api/assignments/${assignmentId}/submissions`, { method: "GET" });
}

export async function submitAssignment(assignmentId: string, body: { fileId?: string; textContent?: string }): Promise<AssignmentSubmission> {
  return adminJson<AssignmentSubmission>(`/api/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify(body) });
}

export async function gradeSubmission(submissionId: string, body: { score: number; feedback?: string }): Promise<AssignmentSubmission> {
  return adminJson<AssignmentSubmission>(`/api/assignments/submissions/${submissionId}/grade`, { method: "POST", body: JSON.stringify(body) });
}

export async function releaseSubmissionGrade(submissionId: string): Promise<AssignmentSubmission> {
  return adminJson<AssignmentSubmission>(`/api/assignments/submissions/${submissionId}/release`, { method: "POST" });
}

export async function releaseAllGrades(assignmentId: string): Promise<{ released: number }> {
  return adminJson(`/api/assignments/${assignmentId}/release-all`, { method: "POST" });
}

// ── Teacher Feedback API ──────────────────────────────────────────────────────

export type TeacherFeedbackItem = {
  id: string;
  authorId: string | null;
  senderRole: string | null;
  category: string;
  message: string;
  status: string;
  subjectId: string | null;
  teacherId: string | null;
  isAnonymous: boolean;
  createdAt: string;
  /** Populated when isAnonymous = false */
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  /** Populated when sender is a parent — their linked children */
  children?: Array<{ studentId: string; firstName: string; lastName: string }> | null;
};

/** Feedback directed at the authenticated teacher (category = teacher) */
export async function listFeedbackForTeacher(): Promise<TeacherFeedbackItem[]> {
  return adminJson<TeacherFeedbackItem[]>("/api/feedback/for-teacher", { method: "GET" });
}

/** Feedback submitted by the authenticated user (non-anonymous only) */
export async function listMyFeedback(): Promise<TeacherFeedbackItem[]> {
  return adminJson<TeacherFeedbackItem[]>("/api/feedback/mine", { method: "GET" });
}

/** Submit feedback (teacher → school) */
export async function submitFeedback(body: {
  category: string;
  message: string;
  teacherId?: string;
  subjectId?: string;
  isAnonymous?: boolean;
}): Promise<TeacherFeedbackItem> {
  return adminJson<TeacherFeedbackItem>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Parent: child upcoming ────────────────────────────────────────────────────

export type ChildUpcomingExam = {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  maxPoints: number;
  status: "upcoming" | "available" | "submitted" | "graded" | "missed";
  score: number | null;
  releasedAt: string | null;
  attemptId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  gradeName: string | null;
  sectionName: string | null;
};

export type ChildUpcomingAssignment = {
  id: string;
  title: string;
  description: string | null;
  submissionType: string;
  deadline: string;
  maxScore: number;
  status: "pending" | "submitted" | "graded" | "overdue";
  score: number | null;
  releasedAt: string | null;
  submittedAt: string | null;
  submissionId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  gradeName: string | null;
  sectionName: string | null;
};

export type ChildUpcomingResponse = {
  student: { id: string; firstName: string; lastName: string; email: string };
  exams: ChildUpcomingExam[];
  assignments: ChildUpcomingAssignment[];
  summary: {
    examsTotal: number;
    examsUpcoming: number;
    examsMissed: number;
    assignmentsTotal: number;
    assignmentsPending: number;
    assignmentsOverdue: number;
  };
};

export async function getChildUpcoming(studentId: string, termId?: string): Promise<ChildUpcomingResponse> {
  const q = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return adminJson<ChildUpcomingResponse>(
    `/api/parent-students/children/${encodeURIComponent(studentId)}/upcoming${q}`,
    { method: "GET" },
  );
}

export async function myChildren(): Promise<Array<{
  id: string;
  parentId: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
  student: { id: string; firstName: string; lastName: string; email: string } | null;
}>> {
  return adminJson("/api/parent-students/mychildren", { method: "GET" });
}

export async function getDirectFileUrl(fileId: string): Promise<{ url: string; filename: string; mime: string }> {
  return adminJson<{ url: string; filename: string; mime: string }>(`/api/files/${encodeURIComponent(fileId)}/url`, { method: "GET" });
}

// ─── Homeroom ────────────────────────────────────────────────────────────────

export type HomeroomStudent = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  profileImageFileId?: string | null;
};

export type HomeroomMyClass = {
  assignment: {
    id: string;
    teacherId: string;
    academicYearId: string;
    gradeId: string;
    sectionId: string;
    createdAt: string;
    updatedAt: string;
  };
  students: HomeroomStudent[];
};

export async function getMyHomeroomClass(): Promise<HomeroomMyClass> {
  return adminJson<HomeroomMyClass>(`/api/homeroom/my-class`, { method: "GET" });
}

export type HomeroomAssignmentRow = {
  id: string;
  teacherId: string;
  academicYearId: string;
  gradeId: string;
  sectionId: string;
  teacherName?: string;
  gradeName?: string;
  sectionName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function listHomeroomAssignments(academicYearId?: string): Promise<HomeroomAssignmentRow[]> {
  const q = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : "";
  return adminJson<HomeroomAssignmentRow[]>(`/api/homeroom/assignments${q}`, { method: "GET" });
}

export async function assignHomeroom(body: {
  teacherId: string;
  academicYearId: string;
  gradeId: string;
  sectionId: string;
}): Promise<HomeroomAssignmentRow> {
  return adminJson<HomeroomAssignmentRow>(`/api/homeroom/assign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function removeHomeroomAssignment(id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/api/homeroom/assign/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ─── Report Cards ────────────────────────────────────────────────────────────

export type ReportCardEntry = {
  title: string;
  type: string;
  score: number | null;
  maxScore: number;
  percent: number | null;
  releasedAt?: string | null;
};

export type ReportCardSubject = {
  subjectId: string;
  subjectName: string;
  classOfferingId: string;
  teacherName: string;
  entries: ReportCardEntry[];
  summary: { totalEntries: number; averagePercent: number | null; letterGrade: string | null };
};

export type ReportCardAttendance = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  attendancePercent: number;
};

export type StudentTermReportCard = {
  student: { id: string; firstName: string; lastName: string; grade: string; section: string; profileImageFileId?: string | null };
  academicYear: { id: string; label: string };
  term: { id: string; name: string; startDate: string; endDate: string };
  subjects: ReportCardSubject[];
  attendance: ReportCardAttendance;
  overallGpa: number | null;
  overallPercent: number | null;
  overallLetterGrade: string | null;
  homeroomRemark: { remark: string; conductGrade?: string | null } | null;
  generatedAt: string;
};

export type ClassTermReportCardRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  overallPercent: number | null;
  overallLetterGrade: string | null;
  attendancePercent: number | null;
  rank: number;
};

export type ClassTermReportCard = {
  gradeId: string;
  sectionId: string;
  termId: string;
  students: ClassTermReportCardRow[];
};

export async function getStudentTermReportCard(studentId: string, termId: string): Promise<StudentTermReportCard> {
  return adminJson<StudentTermReportCard>(
    `/api/report-cards/student/${encodeURIComponent(studentId)}/term/${encodeURIComponent(termId)}`,
    { method: "GET" },
  );
}

export async function getClassTermReportCard(gradeId: string, sectionId: string, termId: string): Promise<ClassTermReportCard> {
  return adminJson<ClassTermReportCard>(
    `/api/report-cards/class/${encodeURIComponent(gradeId)}/${encodeURIComponent(sectionId)}/term/${encodeURIComponent(termId)}`,
    { method: "GET" },
  );
}

export async function getStudentYearReportCards(studentId: string, academicYearId: string): Promise<StudentTermReportCard[]> {
  return adminJson<StudentTermReportCard[]>(
    `/api/report-cards/student/${encodeURIComponent(studentId)}/academic-year/${encodeURIComponent(academicYearId)}`,
    { method: "GET" },
  );
}

export async function upsertReportCardRemark(body: {
  studentId: string;
  termId: string;
  remark: string;
  conductGrade?: string;
}): Promise<{ id: string; studentId: string; termId: string; remark: string; conductGrade?: string | null }> {
  return adminJson(`/api/report-cards/remarks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

