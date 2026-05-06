# Exam Result (`/student/result/[examId]`)

Displays the released exam result for an attempt.

## Current Status

| Area | Status |
|---|---|
| Result loading | API-backed via `/api/attempts/:id/result` |
| Question review | Uses backend result breakdown, including answer keys only after release |
| Violation display | Shows integrity violation count/details returned by backend |
| Dashboard back navigation | Implemented |

## Known Remaining Work

| Item | Status |
|---|---|
| Pending/unreleased result UX | Currently shows backend error until teacher releases the result |
| Result export/download from web | Backend supports CSV, web UI does not expose it here |
