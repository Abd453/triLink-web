"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { BookOpen, ClipboardList, Users, Bell, ChevronLeft, ChevronRight, X, Plus, CalendarDays, Edit3, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import type { EventType, CalendarEvent } from "@/store/calendarStore";
import Select from "@/components/Select";
import TermSelector from "@/components/TermSelector";
import { useTermStore } from "@/store/termStore";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getActiveAcademicYear,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEventRecord,
} from "@/lib/admin-api";

const TODAY = new Date();
const toLocalISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseLocalISODate = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const todayISO = toLocalISODate(TODAY);

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LucideIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TYPE_CFG: Record<EventType, { label: string; color: string; bg: string; dot: string; Icon: LucideIcon }> = {
  class: { label: "Class", color: "var(--primary-600)", bg: "var(--primary-50)", dot: "var(--primary-500)", Icon: BookOpen },
  exam: { label: "Exam", color: "#991b1b", bg: "var(--danger-light)", dot: "var(--danger)", Icon: ClipboardList },
  meeting: { label: "Meeting", color: "#92400e", bg: "var(--warning-light)", dot: "var(--warning)", Icon: Users },
  reminder: { label: "Reminder", color: "#065f46", bg: "var(--success-light)", dot: "var(--success)", Icon: Bell },
};

function EventIcon({ type, size = 16 }: { type: EventType; size?: number }) {
  const Icon = TYPE_CFG[type].Icon;
  return <Icon size={size} color={TYPE_CFG[type].color} strokeWidth={2} />;
}

interface Toast {
  id: string;
  title: string;
  body: string;
  type: EventType;
}

const BLANK_FORM = (date: string) => ({ title: "", date, time: "", type: "class" as EventType, description: "", classOfferingId: "" });

function mapApiToEvent(record: CalendarEventRecord): CalendarEvent {
  const type: EventType = (["class", "exam", "meeting", "reminder"] as const).includes(record.type as EventType) ? (record.type as EventType) : "reminder";
  return {
    id: record.id,
    title: record.title,
    date: record.date,
    time: record.time ?? undefined,
    type,
    description: record.description ?? undefined,
  };
}

function DayChip({ event, onEdit }: { event: CalendarEvent; onEdit: (event: CalendarEvent) => void }) {
  const cfg = TYPE_CFG[event.type];
  return (
    <button
      type="button"
      onClick={() => onEdit(event)}
      style={{
        width: "100%",
        border: "1px solid rgba(0,0,0,0.05)",
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 10,
        padding: "0.35rem 0.45rem",
        textAlign: "left",
        fontSize: "0.72rem",
        lineHeight: 1.2,
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
      title={event.title}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</span>
    </button>
  );
}

export default function TeacherCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [calErr, setCalErr] = useState<string | null>(null);
  const { selectedTermId, selectedTermName } = useTermStore();

  const [viewYear, setViewYear] = useState(TODAY.getFullYear());
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth());
  const [selDay, setSelDay] = useState<number | null>(TODAY.getDate());
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM(todayISO));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pastDatePopup, setPastDatePopup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const monthRange = useCallback(() => {
    const from = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const last = new Date(viewYear, viewMonth + 1, 0).getDate();
    const to = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    return { from, to };
  }, [viewYear, viewMonth]);

  const reloadEvents = useCallback(async () => {
    setCalErr(null);
    try {
      const year = await getActiveAcademicYear();
      if (!year?.id) {
        setAcademicYearId(null);
        setEvents([]);
        setCalErr("No active academic year. Ask an admin to activate one.");
        return;
      }
      setAcademicYearId(year.id);
      const { from, to } = monthRange();
      const raw = await listCalendarEvents({ academicYearId: year.id, from, to, termId: selectedTermId ?? undefined });
      setEvents(raw.map(mapApiToEvent));
    } catch (error) {
      setCalErr(error instanceof Error ? error.message : "Could not load calendar");
      setEvents([]);
    }
  }, [monthRange, selectedTermId]);

  useEffect(() => { void reloadEvents(); }, [reloadEvents]);

  const dayISO = (day: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isPastDate = (date: string) => parseLocalISODate(date).getTime() < parseLocalISODate(todayISO).getTime();

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const selectedDayEvents = useMemo(() => selDay !== null ? events.filter((event) => event.date === dayISO(selDay)) : [], [dayISO, events, selDay]);
  const upcomingEvents = useMemo(() => [...events].filter((event) => event.date >= todayISO).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")), [events]);
  const totalCounts = useMemo(() => ({
    total: events.length,
    exams: events.filter((event) => event.type === "exam").length,
    classes: events.filter((event) => event.type === "class").length,
    reminders: events.filter((event) => event.type === "reminder").length,
  }), [events]);

  function navMonth(dir: -1 | 1) {
    let month = viewMonth + dir;
    let year = viewYear;
    if (month < 0) { month = 11; year -= 1; }
    if (month > 11) { month = 0; year += 1; }
    setViewMonth(month);
    setViewYear(year);
    setSelDay(null);
  }

  function openCreate(day?: number) {
    const targetDay = day ?? TODAY.getDate();
    const date = day ? dayISO(targetDay) : todayISO;
    if (isPastDate(date)) {
      setPastDatePopup("You cannot add an event to a past date.");
      return;
    }
    setEditingEventId(null);
    setForm(BLANK_FORM(date));
    setShowModal(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      date: event.date,
      time: event.time ?? "",
      type: event.type,
      description: event.description ?? "",
      classOfferingId: "",
    });
    setShowModal(true);
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.date) return;
    if (isPastDate(form.date)) {
      setPastDatePopup("You cannot add an event to a past date.");
      return;
    }
    if (!academicYearId) {
      setPastDatePopup("No active academic year. Ask an admin to activate one.");
      return;
    }

    setSaving(true);
    try {
      if (editingEventId) {
        await updateCalendarEvent(editingEventId, {
          title: form.title.trim(),
          date: form.date,
          time: form.time || undefined,
          type: form.type,
          description: form.description?.trim() || undefined,
          termId: selectedTermId ?? undefined,
        });
      } else {
        await createCalendarEvent({
          academicYearId,
          title: form.title.trim(),
          date: form.date,
          time: form.time || undefined,
          type: form.type,
          description: form.description?.trim() || undefined,
          termId: selectedTermId ?? undefined,
        });
      }
      await reloadEvents();
      const [monthName, day] = [MONTH_NAMES[parseInt(form.date.split("-")[1], 10) - 1], parseInt(form.date.split("-")[2], 10)];
      const toast: Toast = {
        id: `t-${Date.now()}`,
        type: form.type,
        title: editingEventId ? `Event updated: ${form.title.trim()}` : `Event added: ${form.title.trim()}`,
        body: `${monthName} ${day}${form.time ? ` at ${form.time}` : ""}`,
      };
      setToasts((previous) => [...previous, toast]);
      setTimeout(() => setToasts((previous) => previous.filter((item) => item.id !== toast.id)), 4000);
      setShowModal(false);
    } catch (error) {
      setPastDatePopup(error instanceof Error ? error.message : "Could not save event");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent() {
    if (!editingEventId) return;
    if (!window.confirm("Delete this event?")) return;
    setSaving(true);
    try {
      await deleteCalendarEvent(editingEventId);
      await reloadEvents();
      setShowModal(false);
    } catch (error) {
      setPastDatePopup(error instanceof Error ? error.message : "Could not delete event");
    } finally {
      setSaving(false);
    }
  }

  const isToday = (day: number) => viewYear === TODAY.getFullYear() && viewMonth === TODAY.getMonth() && day === TODAY.getDate();
  const selectedDayISO = selDay !== null ? dayISO(selDay) : null;
  const selectedDayIsPast = selectedDayISO ? isPastDate(selectedDayISO) : false;

  return (
    <div className="page-wrapper">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" style={{ borderLeftColor: TYPE_CFG[toast.type].dot }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: TYPE_CFG[toast.type].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <EventIcon type={toast.type} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{toast.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: 2 }}>{toast.body}</div>
            </div>
            <button onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))} style={{ color: "var(--gray-400)", padding: 4, flexShrink: 0, display: "flex" }}>
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>

      <PageHeader
        kicker="Planning Board"
        title="Calendar"
        subtitle="Create, edit, and track class events, exams, meetings, and reminders with term-aware scheduling."
        icon={<CalendarDays size={22} />}
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <TermSelector academicYearId={academicYearId} onTermChange={() => undefined} />
            <button type="button" className="btn btn-primary" onClick={() => openCreate()} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 12 }}>
              <Plus size={14} strokeWidth={2.5} /> Add Event
            </button>
          </div>
        )}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Events", value: totalCounts.total },
          { label: "Classes", value: totalCounts.classes },
          { label: "Exams", value: totalCounts.exams },
          { label: "Term", value: selectedTermName ?? "All Terms" },
        ].map((item) => (
          <div key={item.label} style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.15rem", border: "1px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: 6, color: "var(--gray-900)" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {calErr && <div className="card" style={{ marginBottom: 16, color: "var(--danger)", fontSize: "0.9rem" }}>{calErr}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navMonth(-1)} style={{ display: "flex", alignItems: "center", gap: 4 }}><ChevronLeft size={15} strokeWidth={2.5} /> Prev</button>
            <h3 style={{ fontWeight: 800, fontSize: "1.05rem", margin: 0 }}>{MONTH_NAMES[viewMonth]} {viewYear}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navMonth(1)} style={{ display: "flex", alignItems: "center", gap: 4 }}>Next <ChevronRight size={15} strokeWidth={2.5} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {DAY_NAMES.map((day) => <div key={day} style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", padding: "0.25rem 0" }}>{day}</div>)}
            {Array.from({ length: firstDay }).map((_, index) => <div key={`b-${index}`} style={{ minHeight: 110 }} />)}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayEvents = events.filter((event) => event.date === dayISO(day));
              const isTodayCell = isToday(day);
              const selected = selDay === day;
              const past = dayISO(day) < todayISO;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelDay(selected ? null : day)}
                  onDoubleClick={() => !past && openCreate(day)}
                  style={{
                    minHeight: 110,
                    borderRadius: 16,
                    border: selected ? "1.5px solid var(--primary-400)" : "1px solid var(--gray-100)",
                    background: isTodayCell ? "linear-gradient(180deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))" : selected ? "var(--primary-50)" : "#fff",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    textAlign: "left",
                    opacity: past && !isTodayCell ? 0.72 : 1,
                    cursor: "pointer",
                    boxShadow: selected ? "0 10px 26px rgba(37,99,235,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                  title={dayEvents.length > 0 ? `${dayEvents.length} event(s)` : "Double click to add an event"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: isTodayCell ? 800 : 600, color: isTodayCell ? "var(--primary-700)" : "var(--gray-700)" }}>{day}</span>
                    {dayEvents.length > 0 && <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray-500)" }}>{dayEvents.length}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayEvents.slice(0, 3).map((event) => <DayChip key={event.id} event={event} onEdit={openEdit} />)}
                    {dayEvents.length > 3 && <div style={{ fontSize: "0.72rem", color: "var(--gray-500)", paddingLeft: 2 }}>+{dayEvents.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Selected Day</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelDay(TODAY.getDate())}>Today</button>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: 10 }}>{selectedDayISO ?? todayISO}</div>
            {selectedDayEvents.length === 0 ? (
              <div style={{ color: "var(--gray-400)", fontSize: "0.85rem" }}>No events on this day.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedDayEvents.map((event) => (
                  <button key={event.id} type="button" onClick={() => openEdit(event)} style={{ border: "1px solid var(--gray-100)", background: TYPE_CFG[event.type].bg, color: TYPE_CFG[event.type].color, borderRadius: 14, padding: 12, textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{event.title}</div>
                      <Edit3 size={14} />
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.88, marginTop: 4 }}>{TYPE_CFG[event.type].label}{event.time ? ` · ${event.time}` : ""}</div>
                    {event.description && <div style={{ fontSize: "0.78rem", opacity: 0.78, marginTop: 4 }}>{event.description}</div>}
                  </button>
                ))}
              </div>
            )}
            {!selectedDayIsPast && (
              <button className="btn btn-primary btn-sm" onClick={() => openCreate(selDay ?? undefined)} style={{ marginTop: 12 }}>Add event on this day</button>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Upcoming</h3>
              <CalendarDays size={16} color="var(--gray-500)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflow: "auto" }}>
              {upcomingEvents.slice(0, 8).map((event) => (
                <button key={event.id} type="button" onClick={() => openEdit(event)} style={{ border: "1px solid var(--gray-100)", borderRadius: 14, padding: 12, background: "#fff", textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{event.title}</div>
                    <span style={{ fontSize: "0.75rem", color: TYPE_CFG[event.type].color, fontWeight: 700 }}>{TYPE_CFG[event.type].label}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gray-500)", marginTop: 4 }}>{event.date}{event.time ? ` · ${event.time}` : ""}</div>
                </button>
              ))}
              {upcomingEvents.length === 0 && <div style={{ color: "var(--gray-400)", fontSize: "0.85rem" }}>No upcoming events.</div>}
            </div>
          </div>
        </aside>
      </div>

      {showModal && (
        <div className="chat-compose-overlay" onClick={() => setShowModal(false)}>
          <div className="chat-compose-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="chat-compose-head">
              <div>
                <div className="chat-compose-title">{editingEventId ? "Edit event" : "New event"}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 2 }}>{selectedTermName ?? "All Terms"}</div>
              </div>
              <button className="chat-stage-icon-btn" type="button" onClick={() => setShowModal(false)} aria-label="Close"><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div className="chat-compose-input" style={{ padding: 0, background: "transparent" }}>
                <input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Event title" style={{ width: "100%", padding: "0.75rem 0.9rem", borderRadius: 12, border: "1px solid var(--gray-200)" }} />
              </div>
              <Select value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value as EventType }))} style={{ padding: "0.75rem 0.9rem", borderRadius: 12, border: "1px solid var(--gray-200)", background: "#fff" }}>
                <option value="class">Class</option>
                <option value="exam">Exam</option>
                <option value="meeting">Meeting</option>
                <option value="reminder">Reminder</option>
              </Select>
              <div className="chat-compose-input" style={{ padding: 0, background: "transparent" }}>
                <input type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} style={{ width: "100%", padding: "0.75rem 0.9rem", borderRadius: 12, border: "1px solid var(--gray-200)" }} />
              </div>
              <div className="chat-compose-input" style={{ padding: 0, background: "transparent" }}>
                <input type="time" value={form.time} onChange={(event) => setForm((previous) => ({ ...previous, time: event.target.value }))} style={{ width: "100%", padding: "0.75rem 0.9rem", borderRadius: 12, border: "1px solid var(--gray-200)" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={4} placeholder="Description or instructions" style={{ width: "100%", padding: "0.75rem 0.9rem", borderRadius: 12, border: "1px solid var(--gray-200)", resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {editingEventId && <button className="btn btn-secondary" type="button" onClick={() => void removeEvent()} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8 }}><Trash2 size={14} /> Delete</button>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" type="button" onClick={() => void saveEvent()} disabled={saving}>
                  {saving ? "Saving…" : editingEventId ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pastDatePopup && (
        <div className="chat-compose-overlay" onClick={() => setPastDatePopup(null)}>
          <div className="chat-compose-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="chat-compose-title">Calendar notice</div>
            <p style={{ margin: "0.75rem 0 0", color: "var(--gray-600)" }}>{pastDatePopup}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-primary" type="button" onClick={() => setPastDatePopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}