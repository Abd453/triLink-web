# Student Dashboard (`/student/dashboard`)

Exam portal landing page for the student. Shows available, upcoming, and completed exams.

## Fixes Applied

| Issue | Status |
|---|---|
| Stats cards used raw inline styles instead of `.stat-card` / `.stat-icon` design system classes | ✅ Fixed |
| Filter button "Completed" used an oversized 18px icon, inconsistent with other filter buttons | ✅ Fixed — now uses a 14px inline SVG matching the button text size |
| No empty state when a filter returns zero results | ✅ Fixed — shows a friendly "No exams found" message with icon |
| Missed exam cards had identical border/shadow to upcoming exams | ✅ Fixed — missed exams now have a red border and subtle red glow |

## Known / Remaining

| Item | Status |
|---|---|
| Exam data is hardcoded mock data | ⬜ Needs real API |
| Student name/grade hardcoded in layout | ⬜ Needs auth context |
| "View Result" for completed exams shows fallback data if session store was cleared | ⬜ Needs persistent storage / API |
