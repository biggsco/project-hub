# Buckets, tags and frictionless capture validation

15 October 2026. The existing Next.js, PostgreSQL, Better Auth and Render deployment configuration is retained. No runtime dependencies were added.

## Automated verification

`npm test`: 28 tests pass, including a PostgreSQL/Better Auth integration suite.

- Title-only capture; independent Standard/Downtime/Ongoing classifications.
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

Additional bucket/tag coverage:

- Migration 003 on existing task tags, case/whitespace deduplication and relational association backfill; initial suggested buckets/tags.
- Custom bucket creation/rename/reorder/archive, preserved memberships, rejection of new archived-bucket assignments, and moving tasks without duplication.
- Simultaneous project/bucket membership, independent classification/status and task-tag relationship integrity.
- Tag creation/deduplication, rename and merge across task/project links and compatibility arrays.
- Cross-owner bucket and tag access rejection.
- Bucket names/aliases, unambiguous incidental mentions without title-word removal, ambiguous/unknown/archived names, hashtags and metadata precedence.
- Bounded Brain Dump preview (20,000 source lines yields at most 200 preview items), metadata-aware idempotency and current values on retry.
- Recent bucket ordering and archive exclusion.

A local React/DOM smoke check also verifies opening a bucket prepares Quick Add, two consecutive captures retain bucket and Downtime classification, grouped results appear once, new multiword tags can be typed without existing prefixes interrupting them, and oversized Brain Dump rendering/submission is bounded. API responses are simulated for these component checks; SQL/auth use the actual integration suite above.

Phase 1/2 additions verified:

- Context defaults for general, bucket, project, Downtime and Ongoing views; project association persists on capture.
- No priority on new tasks, while migration 004 retains every existing priority and tag association.
- Independent Standard classification, legacy Inbox-classification compatibility and existing receipt retries.
- Multi-tag intersection matching with case/whitespace normalisation.
- React/DOM interactions: context changes reset metadata; project capture links the task; Reset to Inbox preserves title and clears project; bucket selection persists during consecutive capture; multi-tag filtering; optimistic completion before the response arrives without a workspace GET; failed completion restores state; Escape closes the optional date menu.

Scope: this implements phases 1 and 2 of the uploaded personal workspace brief. Phase 3 People & Teams and Meeting View are not introduced. Existing later productivity features are preserved.

## Remaining live checks

- The change has not been deployed to Render or tested against its production database. The existing pre-deploy command runs the new numbered migration automatically; migrations 001, 002 and 003 are unchanged.
- Desktop and mobile visual/browser verification is outstanding. Chromium installation was attempted but the environment returned unusable downloads. DOM checks do not validate layout or real browser behaviour.
- After merging the pull request, confirm GitHub checks pass, Render pre-deploy reports `Applied 003_buckets_tags.sql` and `Applied 004_core_simplicity.sql` (003 is skipped if already applied), and `/api/health` succeeds.
- Sign in with the existing account; verify legacy tasks/projects remain; capture several tasks consecutively; refresh and confirm persistence.
- Try `Follow up next Friday`, `Downtime - tidy templates`, `Ongoing - improve MyAVM` and `Prepare goals in 2 weeks` and check the preview before saving.
- Test Brain Dump, delegation/reassignment/return, date presets/custom date, effort/time suggestions, bucket and tag management, shared tag rename/merge, remembered capture bucket, grouped/flat Downtime, project milestones, snooze visibility and wake-up, search and completion on desktop and phone.

No Render resources were created or charged, no production database was accessed, and no deployment secrets were changed. Existing administrative password recovery remains unchanged. Settings JSON export is not a complete database backup.
