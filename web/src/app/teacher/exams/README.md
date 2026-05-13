# Teacher Exams (`/teacher/exams`)

Three-tab page: Create Quiz, Exam Bank, and Results & Grades.

## Fixes Applied

| Issue | Status |
|---|---|
| Correct Answer selector (A/B/C/D) had no active state — clicking buttons did nothing visible | ✅ Fixed — added `correctAnswer` state; selected button turns `btn-primary` (blue), shows a green checkmark badge, and a confirmation message appears below |

## Known / Remaining

| Item | Status |
|---|---|
| Create Quiz form has no question list / multi-question management | ⬜ Needs state for question array |
| "Publish Quiz" button has no action | ⬜ Needs API |
| Exam Bank search input has no filter logic | ⬜ Needs state |
| Results table grades are hardcoded | ⬜ Needs API |
