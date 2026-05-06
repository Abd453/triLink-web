# Exam Session (`/student/exam/[examId]`)

Full-screen timed exam with anti-cheat enforcement.

## Current Status

| Area | Status |
|---|---|
| Exam metadata and questions | API-backed; student question payload does not expose answer keys |
| Attempt lifecycle | Starts/resumes, autosaves answers, submits, and navigates to result |
| Integrity events | Records tab switch and fullscreen exit through `/api/attempts/:id/violations` |
| Teacher controls | Listens for Socket.IO `attempt:control` events |
| Access checks | Filters visible exams by active enrollment when available |

## Known Remaining Work

| Item | Status |
|---|---|
| Client-side anti-cheat bypass resistance | Browser enforcement is best-effort only |
| Richer locked/rejoin UX | Current flow redirects after lock and waits for teacher action |
| Complete lint/type cleanup | Deferred unless it blocks build/runtime |
