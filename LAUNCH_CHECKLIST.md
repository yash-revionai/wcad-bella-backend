# Launch Checklist

This file tracks the remaining work to move the Bella project from MVP-complete to launch-ready.

## Things You Need To Do

- [ ] Provide production environment values for:
  - [ ] Google OAuth
  - [ ] Supabase
  - [ ] Twilio
  - [ ] Resend
- [ ] Connect the real Google account in admin
- [ ] Map the real calendars for:
  - [ ] `pikesville`
  - [ ] `towson`
  - [ ] `mobile`
  - [ ] main calendar
- [ ] Confirm the mapped calendars are the exact calendars Bella should read and write
- [ ] Run a real booking through the full voice flow
- [ ] Confirm SMS confirmations arrive
- [ ] Confirm email confirmations arrive
- [ ] Confirm Google Calendar events land in the correct calendar
- [ ] Confirm revoked Google access shows the expected reconnect flow
- [ ] Approve the final admin UI direction
- [ ] Confirm Bella fallback wording and confirmation copy
- [ ] Confirm transfer phone numbers and escalation behavior

## Things Codex Needs To Do

- [ ] Build and verify any remaining `/api/transfer` gaps against `CLAUDE.md`
- [ ] Re-check Bella-specific edge cases from the spec
- [ ] Add broader integration and regression coverage
- [ ] Add more coverage for booking persistence and notification failure paths
- [ ] Review remaining backend and admin error states
- [ ] Improve admin reconnect and status UX where needed
- [ ] Polish admin spacing, consistency, and premium visual finish
- [ ] Review responsive behavior across dashboard pages
- [ ] Fix issues found during live validation

## Recommended Order

- [ ] Add live environment values
- [ ] Connect Google and map calendars
- [ ] Finish remaining code and polish tasks
- [ ] Run the live launch checklist end to end
- [ ] Fix any issues discovered in final validation
