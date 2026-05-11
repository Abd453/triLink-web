# Exam Result (`/student/result/[examId]`)

Displays the student's score, correct/wrong/unanswered breakdown, and a full question-by-question review after exam submission.

## Fixes Applied

| Issue | Status |
|---|---|
| Result page showed hardcoded static data regardless of what the student actually answered | ✅ Fixed — reads from Zustand `examStore`; score, correct, wrong, and unanswered are all computed from actual student answers |
| Blank fill-in answers displayed as generic "(no answer)" | ✅ Fixed — fill-in blanks show "Left blank" (italic, gray) while skipped MCQ/T-F show "Not answered" |
| No fallback if the page was accessed directly via URL (store empty) | ✅ Fixed — a fallback demo result is shown so the page never crashes |
| `formatTime` was duplicated across pages | ✅ Consolidated — now lives inside this component (no shared import needed yet) |

## Known / Remaining

| Item | Status |
|---|---|
| Results are not persisted — refreshing clears the Zustand store | ⬜ Needs localStorage persistence or API |
| "View Result" from dashboard for old completed exams shows fallback data | ⬜ Needs API to fetch past submissions |
| Tab violation count is displayed in the submission metadata but not prominently flagged to teacher | ⬜ Needs backend / teacher monitoring view |
