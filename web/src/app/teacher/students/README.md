# Teacher Students (`/teacher/students`)

Student list with click-to-expand analytics panel showing scores, attendance, and AI recommendations per subject.

## Fixes Applied

| Issue | Status |
|---|---|
| Student detail panel's 3 mini-cards (Avg Score, Attendance, Class Rank) used raw inline color boxes inconsistent with design system | ✅ Fixed — now uses `.stats-grid` (3-column) + `.stat-card` + `.stat-icon` with semantic SVG icons and color classes (`blue`, `green`, `orange`) |

## Known / Remaining

| Item | Status |
|---|---|
| Only 3 students are hardcoded | ⬜ Needs API |
| AI Recommendation is a hardcoded text decision | ⬜ Replace with real AI/ML call |
| No pagination or search on the student table | ⬜ Needs filter state |
