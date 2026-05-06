# Teacher Attendance (`/teacher/attendance`)

Daily attendance marking per class with present, absent, and excused states.

## Current Status

| Area | Status |
|---|---|
| Class selection | API-backed teacher class offerings |
| Student list | API-backed active enrollments per class |
| Daily submission | Creates attendance session and bulk-upserts marks |
| Submitted-session edits | Existing daily sessions can be updated with corrected marks |
| Excuse notes | Sent to backend with excused marks |
| History | API-backed session/mark history per student |

## Known Remaining Work

| Item | Status |
|---|---|
| Historical date picker | Deferred |
| Admin override audit trail | Deferred |
