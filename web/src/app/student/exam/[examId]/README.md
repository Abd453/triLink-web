# Exam Session (`/student/exam/[examId]`)

Full-screen timed exam with anti-cheat enforcement.

## Fixes Applied

| Issue | Status |
|---|---|
| No fullscreen enforcement — exam could be taken in a windowed browser | ✅ Fixed — `requestFullscreen()` is called on mount; exiting fullscreen counts as a violation and re-entry is attempted automatically |
| Inline "submitted" card was shown instead of navigating to the result page | ✅ Fixed — on submit, results are saved to Zustand store and router navigates to `/student/result/[examId]` |
| Tab violation auto-submit threshold existed but exam result was never persisted | ✅ Fixed — all submit paths (timer expiry, manual submit, tab violation limit) now save to store before navigating |
| `submittedRef` was missing — fullscreen exit on navigation could incorrectly log a violation | ✅ Fixed — `submittedRef` tracks submission state synchronously for use inside event handlers |

## Anti-Cheat Summary

| Feature | Status |
|---|---|
| Tab visibility detection (`visibilitychange`) | ✅ Active |
| Fullscreen enforcement with violation on exit | ✅ Active |
| Right-click disabled | ✅ Active |
| Copy / Paste / DevTools keyboard shortcuts blocked | ✅ Active |
| `beforeunload` warning | ✅ Active |
| Auto-submit after 3 violations | ✅ Active |
| Minimum time before submission allowed | ✅ Active |
| Timer turns red under 5 minutes | ✅ Active |
| Question navigator (answered / flagged / unanswered grid) | ✅ Active |

## Known / Remaining

| Item | Status |
|---|---|
| Exam questions are hardcoded mock data | ⬜ Needs real API |
| Correct answers are hardcoded inside the component | ⬜ Should come from API (not exposed to client) |
| Teacher real-time notification on tab switch | ⬜ Needs backend / WebSocket |
