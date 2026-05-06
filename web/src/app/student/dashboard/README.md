# Student Dashboard (`/student/dashboard`)

Exam portal landing page for the student. Shows available, upcoming, completed, and missed exams from the backend.

## Current Status

| Area | Status |
|---|---|
| Exam list | API-backed via active academic year and visible student exams |
| Enrollment filter | Uses student enrollments when available |
| Announcements | API-backed via `announcementsForMe()` |
| Assignments and grade activity | API-backed for the current student |
| Empty/filter states | Implemented |

## Known Remaining Work

| Item | Status |
|---|---|
| Dashboard counters | `studentDashboard()` is loaded but not fully surfaced in the UI |
| Exam question counts | Falls back to zero if backend response does not include a question count |
| Broader activity timeline polish | Deferred |
