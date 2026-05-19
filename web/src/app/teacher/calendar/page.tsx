"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
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
      className="day-chip-button"
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
      <span className="day-chip-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</span>
    </button>
  );
}

export default function TeacherCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [calErr, setCalErr] = useState<string | null>(null);
  const { selectedTermId, selectedTermName } = useTermStore();
  const [fromNotifications, setFromNotifications] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("from") === "notifications") {
        setFromNotifications(true);
      }
    }
  }, []);

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

  const selectedDayISO = selDay !== null ? dayISO(selDay) : null;
  const selectedDayIsPast = selectedDayISO ? isPastDate(selectedDayISO) : false;

  const selectedDayEvents = useMemo(() => selDay !== null ? events.filter((event) => event.date === dayISO(selDay)) : [], [dayISO, events, selDay]);
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDayISO) return "";
    const dateObj = parseLocalISODate(selectedDayISO);
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", weekday: "short" });
  }, [selectedDayISO]);
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

      {fromNotifications && (
        <div style={{ marginBottom: "1rem" }}>
          <Link
            href="/teacher/notifications"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0.55rem 1.15rem",
              borderRadius: "12px",
              fontSize: "0.85rem",
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              background: "#fff",
              border: "1.5px solid var(--gray-100)",
              color: "var(--gray-700)",
              textDecoration: "none"
            }}
          >
            ← Back to Notifications
          </Link>
        </div>
      )}

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

      <div className="calendar-stats-grid">
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

      <div className="calendar-main-layout">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navMonth(-1)} style={{ display: "flex", alignItems: "center", gap: 4 }}><ChevronLeft size={15} strokeWidth={2.5} /> Prev</button>
            <h3 style={{ fontWeight: 800, fontSize: "1.05rem", margin: 0 }}>{MONTH_NAMES[viewMonth]} {viewYear}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navMonth(1)} style={{ display: "flex", alignItems: "center", gap: 4 }}>Next <ChevronRight size={15} strokeWidth={2.5} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {DAY_NAMES.map((day) => <div key={day} style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", padding: "0.25rem 0" }}>{day}</div>)}
            {Array.from({ length: firstDay }).map((_, index) => <div key={`b-${index}`} className="calendar-empty-cell calendar-day-cell" />)}
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
                  className="calendar-day-cell"
                  style={{
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
                  <div className="calendar-day-events-container">
                    {dayEvents.slice(0, 3).map((event) => <DayChip key={event.id} event={event} onEdit={openEdit} />)}
                    {dayEvents.length > 3 && <div className="calendar-more-badge">+{dayEvents.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: "1.5rem", borderRadius: "20px", border: "1.5px solid var(--gray-100)", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", fontWeight: 700 }}>Selected Date</span>
                <h3 style={{ margin: "4px 0 0", fontSize: "1.1rem", fontWeight: 800, color: "var(--gray-900)" }}>{formattedSelectedDate || (selectedDayISO ?? todayISO)}</h3>
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setSelDay(TODAY.getDate())}
                style={{ borderRadius: "10px", padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: 700 }}
              >
                Today
              </button>
            </div>

            <div style={{ height: "1px", background: "var(--gray-100)", margin: "0.75rem 0 1rem" }} />

            {selectedDayEvents.length === 0 ? (
              <div style={{ color: "var(--gray-400)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>No events scheduled for this day.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedDayEvents.map((event) => {
                  const cfg = TYPE_CFG[event.type];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEdit(event)}
                      style={{
                        position: "relative",
                        border: "1.5px solid var(--gray-100)",
                        borderLeft: `4px solid ${cfg.dot}`,
                        background: "#fff",
                        color: "var(--gray-800)",
                        borderRadius: "14px",
                        padding: "1rem 1.15rem",
                        textAlign: "left",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        transition: "all 0.2s ease-in-out",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = cfg.dot;
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--gray-100)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <EventIcon type={event.type} size={15} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--gray-900)" }}>{event.title}</span>
                        </div>
                        <span 
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "999px",
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1px solid rgba(${cfg.color === "var(--primary-600)" ? "37,99,235" : cfg.color === "#991b1b" ? "153,27,27" : cfg.color === "#92400e" ? "146,64,14" : "6,95,70"}, 0.12)`
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      
                      {event.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--gray-500)", fontWeight: 600, marginTop: 2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>{event.time}</span>
                        </div>
                      )}

                      {event.description && (
                        <div style={{ fontSize: "0.8rem", color: "var(--gray-600)", lineHeight: 1.5, background: "var(--gray-50)", padding: "0.5rem 0.75rem", borderRadius: "10px", marginTop: 4, width: "100%" }}>
                          {event.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {!selectedDayIsPast && (
              <button 
                className="btn btn-primary" 
                onClick={() => openCreate(selDay ?? undefined)} 
                style={{ 
                  marginTop: "1.25rem", 
                  width: "100%", 
                  display: "inline-flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: 6, 
                  borderRadius: 12, 
                  padding: "0.6rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 700
                }}
              >
                <Plus size={14} strokeWidth={2.5} /> Add Event
              </button>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              {/* Event Title */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)" }}>Event Title</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Enter event title"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "12px",
                    border: "1.5px solid var(--gray-200)",
                    background: "#fff",
                    fontSize: "0.9rem",
                    color: "var(--gray-800)",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--primary-400)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--gray-200)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Event Type */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)" }}>Category</label>
                <Select
                  value={form.type}
                  onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value as EventType }))}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "12px",
                    border: `1.5px solid ${TYPE_CFG[form.type].dot}`,
                    background: TYPE_CFG[form.type].bg,
                    color: TYPE_CFG[form.type].color,
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="class">Class</option>
                  <option value="exam">Exam</option>
                  <option value="meeting">Meeting</option>
                  <option value="reminder">Reminder</option>
                </Select>
              </div>

              {/* Date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)" }}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "12px",
                    border: "1.5px solid var(--gray-200)",
                    background: "#fff",
                    fontSize: "0.9rem",
                    color: "var(--gray-800)",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--primary-400)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--gray-200)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Time */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)" }}>Time (Optional)</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((previous) => ({ ...previous, time: event.target.value }))}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "12px",
                    border: "1.5px solid var(--gray-200)",
                    background: "#fff",
                    fontSize: "0.9rem",
                    color: "var(--gray-800)",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--primary-400)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--gray-200)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray-600)" }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  rows={4}
                  placeholder="Provide any description, notes, or instructions..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "12px",
                    border: "1.5px solid var(--gray-200)",
                    background: "#fff",
                    fontSize: "0.9rem",
                    color: "var(--gray-800)",
                    outline: "none",
                    transition: "all 0.2s",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--primary-400)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--gray-200)";
                    e.target.style.boxShadow = "none";
                  }}
                />
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