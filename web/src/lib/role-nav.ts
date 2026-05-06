import { ReactNode, createElement } from "react";
import {
    LayoutDashboard, GraduationCap, ClipboardList, BookOpen, Library,
    CalendarDays, Megaphone, Bell, MessageSquare, ClipboardCheck,
    Users, UserPlus, School, FileText, Award, Sparkles, MessageCircleHeart,
    Activity, Settings, User as UserIcon, BookMarked, ListChecks, FolderOpen,
    PenTool, BarChart3,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
    label: string;
    href: string;
    icon: ReactNode;
    section?: string;
    badge?: number;
}

export type NavRole = "admin" | "teacher" | "student" | "parent";

const I = (Icon: ComponentType<{ size?: number; strokeWidth?: number }>): ReactNode =>
    createElement(Icon, { size: 18, strokeWidth: 2 });

/** Sidebar nav config per role. Adding a route is a single line here. */
export const roleNav: Record<NavRole, NavItem[]> = {
    admin: [
        { label: "Dashboard", href: "/admin/dashboard", section: "Main", icon: I(LayoutDashboard) },
        { label: "School setup", href: "/admin/school-setup", icon: I(School) },
        { label: "Classes", href: "/admin/classes", icon: I(GraduationCap) },
        { label: "Curriculum", href: "/admin/curriculum", icon: I(BookOpen) },
        { label: "Textbooks", href: "/admin/textbooks", icon: I(Library) },
        { label: "Registration", href: "/admin/registration", icon: I(UserPlus) },
        { label: "Attendance", href: "/admin/attendance", icon: I(ClipboardCheck) },
        { label: "Announcements", href: "/admin/announcements", section: "Communication", icon: I(Megaphone) },
        { label: "Chat", href: "/admin/chat", icon: I(MessageSquare) },
        { label: "Students", href: "/admin/students", section: "People", icon: I(Users) },
        { label: "Teachers", href: "/admin/teachers", icon: I(Users) },
        { label: "Parents", href: "/admin/parents", icon: I(Users) },
        { label: "Feedback", href: "/admin/feedback", section: "Other", icon: I(MessageCircleHeart) },
        { label: "Activity log", href: "/admin/audit", icon: I(Activity) },
        { label: "Profile", href: "/admin/profile", icon: I(UserIcon) },
        { label: "Settings", href: "/admin/settings", icon: I(Settings) },
    ],
    teacher: [
        { label: "Dashboard", href: "/teacher/dashboard", section: "Main", icon: I(LayoutDashboard) },
        { label: "Classes", href: "/teacher/classes", icon: I(GraduationCap) },
        { label: "Students", href: "/teacher/students", icon: I(Users) },
        { label: "Attendance", href: "/teacher/attendance", icon: I(ClipboardCheck) },
        { label: "Assignments", href: "/teacher/assignments", section: "Coursework", icon: I(ClipboardList) },
        { label: "Grades", href: "/teacher/grades", icon: I(BarChart3) },
        { label: "Exams", href: "/teacher/exams", icon: I(FileText) },
        { label: "Materials", href: "/teacher/materials", icon: I(FolderOpen) },
        { label: "Announcements", href: "/teacher/announcements", section: "Communication", icon: I(Megaphone) },
        { label: "Notifications", href: "/teacher/notifications", icon: I(Bell) },
        { label: "Chat", href: "/teacher/chat", icon: I(MessageSquare) },
        { label: "Calendar", href: "/teacher/calendar", section: "Other", icon: I(CalendarDays) },
        { label: "Profile", href: "/teacher/profile", icon: I(UserIcon) },
        { label: "Settings", href: "/teacher/settings", icon: I(Settings) },
    ],
    student: [
        { label: "Dashboard", href: "/student/dashboard", section: "Main", icon: I(LayoutDashboard) },
        { label: "Courses", href: "/student/courses", icon: I(BookOpen) },
        { label: "Curriculum", href: "/student/curriculum", icon: I(ListChecks) },
        { label: "Assignments", href: "/student/assignments", section: "Coursework", icon: I(ClipboardList) },
        { label: "Exams", href: "/student/exams", icon: I(FileText) },
        { label: "Grades", href: "/student/grades", icon: I(BarChart3) },
        { label: "Textbooks", href: "/student/textbooks", icon: I(Library) },
        { label: "Materials", href: "/student/materials", icon: I(FolderOpen) },
        { label: "Announcements", href: "/student/announcements", section: "Communication", icon: I(Megaphone) },
        { label: "Notifications", href: "/student/notifications", icon: I(Bell) },
        { label: "Chat", href: "/student/chat", icon: I(MessageSquare) },
        { label: "Calendar", href: "/student/calendar", section: "Other", icon: I(CalendarDays) },
        { label: "Achievements", href: "/student/achievements", icon: I(Award) },
        { label: "Goals", href: "/student/goals", icon: I(Sparkles) },
        { label: "Feedback", href: "/student/feedback", icon: I(MessageCircleHeart) },
        { label: "Profile", href: "/student/profile", icon: I(UserIcon) },
        { label: "Settings", href: "/student/settings", icon: I(Settings) },
    ],
    parent: [
        { label: "Home", href: "/parent/dashboard", section: "Main", icon: I(LayoutDashboard) },
        { label: "Subjects", href: "/parent/subjects", section: "Child", icon: I(BookOpen) },
        { label: "Grades", href: "/parent/grades", icon: I(BarChart3) },
        { label: "Attendance", href: "/parent/attendance", icon: I(ClipboardCheck) },
        { label: "Teachers", href: "/parent/teachers", icon: I(Users) },
        { label: "Announcements", href: "/parent/announcements", section: "Communication", icon: I(Megaphone) },
        { label: "Notifications", href: "/parent/notifications", icon: I(Bell) },
        { label: "Chat", href: "/parent/chat", icon: I(MessageSquare) },
        { label: "Calendar", href: "/parent/calendar", section: "Other", icon: I(CalendarDays) },
        { label: "Feedback", href: "/parent/feedback", icon: I(MessageCircleHeart) },
        { label: "Profile", href: "/parent/profile", icon: I(UserIcon) },
        { label: "Settings", href: "/parent/settings", icon: I(Settings) },
    ],
};

/** Search keywords (Header search uses these to fuzzy-match nav). */
export const navSearchIndex: Record<NavRole, Array<{ href: string; keywords: string[] }>> = {
    admin: roleNav.admin.map(item => ({
        href: item.href,
        keywords: [item.label.toLowerCase(), ...item.href.split("/").filter(Boolean)],
    })),
    teacher: roleNav.teacher.map(item => ({
        href: item.href,
        keywords: [item.label.toLowerCase(), ...item.href.split("/").filter(Boolean)],
    })),
    student: roleNav.student.map(item => ({
        href: item.href,
        keywords: [item.label.toLowerCase(), ...item.href.split("/").filter(Boolean)],
    })),
    parent: roleNav.parent.map(item => ({
        href: item.href,
        keywords: [item.label.toLowerCase(), ...item.href.split("/").filter(Boolean)],
    })),
};
