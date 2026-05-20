# Teacher Attendance (`/teacher/attendance`)

Daily attendance marking per class with present / absent / excused states and excuse notes.

## Fixes Applied

| Issue | Status |
|---|---|
| Stats bar (Total / Present / Absent / Excused) used raw inline `div` styles inconsistent with design system | ✅ Fixed — now uses `.stats-grid` + `.stat-card` + `.stat-icon` + `.stat-info` classes with semantic SVG icons |

## Known / Remaining

| Item | Status |
|---|---|
| "Save Attendance" logs nothing — no API call | ⬜ Needs backend |
| Class selection only changes the label; student list doesn't change per class | ⬜ Needs per-class student data |
| Date is always today — no date picker for historical records | ⬜ Needs date picker component |
