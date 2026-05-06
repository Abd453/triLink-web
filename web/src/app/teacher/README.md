# Teacher Portal Overview

This folder contains all pages for the Teacher portal (`/teacher/...`).

## Current Status

| Page | Path | Status |
|---|---|---|
| Dashboard | `/teacher/dashboard` | API-backed dashboard metrics and quick actions |
| Attendance | `/teacher/attendance` | API-backed class/student loading, daily session creation, marks, submitted-session edits, and history |
| Exams | `/teacher/exams` | API-backed quiz creation, question bank, publishing, results, grading, and live monitor |
| Students | `/teacher/students` | API-backed enrollments, exam scores, grade entries, and attendance summary |
| Announcements | `/teacher/announcements` | API-backed announcement list/create/delete |
| Chat | `/teacher/chat` | REST-backed conversations/messages with Socket.IO update listener |
| Notifications | `/teacher/notifications` | API-backed notifications and read state |
| Calendar | `/teacher/calendar` | API-backed calendar events |
| Settings/Profile | `/teacher/settings`, `/teacher/profile` | API-backed profile/security updates |

## Known Remaining Work

| Item | Status |
|---|---|
| Full AI-driven student recommendations | Deferred to AI service integration |
| Historical attendance date selection | Deferred |
| Richer chat presence | Deferred |
| Broader lint/type cleanup | Deferred unless it blocks build/runtime |
