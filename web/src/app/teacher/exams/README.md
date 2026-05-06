# Teacher Exams (`/teacher/exams`)

Three-tab page: Create Quiz, Exam Bank, and Results & Grades.

## Current Status

| Area | Status |
|---|---|
| Multi-question quiz builder | Implemented with per-question state |
| Publish/schedule | API-backed; creates exams, creates/reuses questions, attaches questions, publishes |
| Exam bank | API-backed with filtering and pagination controls |
| Results and grading | API-backed roster/results, grading, release, and PDF export |
| Live monitor | API-backed roster refresh plus Socket.IO activity/violation listeners |

## Known Remaining Work

| Item | Status |
|---|---|
| Attempt violation/control API path | Fixed to use backend `/api/attempts/:id/...` routes |
| Question bank usage counts | Local display only; not a persisted backend metric |
| Complete lint/type cleanup | Deferred unless it blocks build/runtime |
