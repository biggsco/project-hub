# Frictionless task upgrade validation

15 October 2026. The existing Next.js, PostgreSQL, Better Auth and Render deployment configuration is retained. No runtime dependencies were added.

## Automated verification

`npm test`: 17 tests pass, including a PostgreSQL/Better Auth integration suite.

- Title-only capture; independent Inbox/Downtime/Ongoing classifications.
- Supported dates, explicit weekday semantics, Adelaide day boundaries/DST, month-end clamping, leap years and year rollover.
- Preservation of ambiguous, invalid and unrecognised date wording.
- Bulk line splitting and independent parsing.
- Delegation/reassignment/return, completion independence and preservation of classification.
- Available-time ranking and exclusion of nonactionable work.
- Snooze leaves deadlines intact and wakes on the selected date; Ongoing is excluded from overdue counts.
- Actual Better Auth migrations and additive migration 002 on a populated database; legacy title/contact/status preserved.
- Actual SQL capture persistence, atomic rollback of tasks/receipts, all-input validation, retry after commit without duplicate creation, and rejection of request-ID reuse with a changed payload.
- Delegation, follow-up, effort, next-action and snooze persistence; completion timestamps.
- Owner isolation for tasks and capture receipts, existing RLS and linked-record restrictions.
- Existing login, secure cookies, session persistence/revocation, password changes/recovery, throttling, disabled signup and foreign-origin rejection.

`npm run build` and `npm run typecheck`: production compilation and static type validation.

An additional local React/DOM interaction smoke check, using simulated API responses, verifies rapid consecutive capture and retained input focus, Brain Dump preview/save, typed assignee names including spaces, delegated view, snoozed search and calendar rendering. This is a component interaction check, not a live database/browser check.

## Remaining live checks

- The change has not been deployed to Render or tested against its production database. The existing pre-deploy command runs the new numbered migration automatically; migration 001 is unchanged.
- Desktop and mobile visual/browser verification is outstanding. Chromium installation was attempted but the environment returned unusable downloads. DOM checks do not validate layout or real browser behaviour.
- After merging the pull request, confirm GitHub checks pass, Render pre-deploy reports `Applied 002_frictionless.sql`, and `/api/health` succeeds.
- Sign in with the existing account; verify legacy tasks/projects remain; capture several tasks consecutively; refresh and confirm persistence.
- Try `Follow up next Friday`, `Downtime - tidy templates`, `Ongoing - improve MyAVM` and `Prepare goals in 2 weeks` and check the preview before saving.
- Test Brain Dump, delegation/reassignment/return, date presets/custom date, effort/time suggestions, project milestones, snooze visibility and wake-up, search and completion on desktop and phone.

No Render resources were created or charged, no production database was accessed, and no deployment secrets were changed. Existing administrative password recovery remains unchanged. Settings JSON export is not a complete database backup.
