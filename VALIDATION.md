# Buckets, tags and frictionless capture validation

15 October 2026. The existing Next.js, PostgreSQL, Better Auth and Render deployment configuration is retained. No runtime dependencies were added.

## Automated verification

`npm test`: 58 tests pass, including a PostgreSQL/Better Auth integration suite.

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

Phases 3/4 verification:

- Migration 005 on populated data, legacy assignment backfill and unchanged task status/title/deadline.
- Actual SQL custom teams/people, multi-group membership, contact rename/archive, archived-link retention and cross-owner access rejection.
- Associated person remains intact when delegating to a different person; reassignment/return preserve classification and actual deadline. Follow-up, notes, focus dismissal and snooze persist independently.
- Visit timestamps persist without replacing other profile information.
- Pure tests cover independent task types, meeting context, conservative team/person recognition, follow-up date semantics, team/person checklist membership without duplicates, bounded attention, deterministic ranking, eligible due delegation follow-ups, time filters, skip IDs, focus dismissal and seven-day welcome-back threshold.

A simulated React/DOM interaction check also passed meeting-context capture, brief-note persistence, conversion to an action, Welcome back rendering and session-based recommendation skipping, alongside all earlier capture/filter/completion checks. This does not replace live browser/layout verification.

Phase 5A–5D verification:

- Migration 006 runs on the populated PostgreSQL/Better Auth test database. Defaults retain existing records; prior migrations are unchanged.
- SQL tests verify append-only progress/retry IDs, stale-form protection, reference URL validation, subtask append/deduplication/retry protection, reorder, independent followed-up date/status/deadline behaviour and owner isolation for workbench actions and import receipts.
- Pure tests cover numbered/checklist/JSON parsing, invalid/oversized imports, all prompt templates, individual context exclusions, safe URL schemes, CSV formula protection, nonactionable ideas/notes, preserved idea date wording, recoverable capture payload validation, Radar groups, bounded/deduplicated Reset, explicit-only discussion history, Adelaide completion-date filtering and selected-only achievement exports.
- An expanded simulated React/DOM check passes all earlier capture/filter/completion flows, plus workbench next-action/progress, step preview/import, individual progress exclusion with copy disabled until regenerated, prompt copying, command-bar Enter capture, ideas conversion, achievements/reset rendering, draft reload recovery and retry after a lost capture response without duplication. API responses are simulated; persistence/authentication use the SQL suite.
- Production HTTP smoke checks validate manifest/start shortcut, generated 192/512 PNG icon dimensions, public service worker/offline notice, guarded workspace/capture routes and no private data from unauthenticated data/history requests. With no deployment secrets configured, data requests return a guarded 401/503 rather than private content.
- Production compilation and static TypeScript checks pass. Render build/start/pre-deploy commands are unchanged; no required environment variables or runtime dependencies added.

Scope: phases 1–5D. No AI integration, external transmission or automatic offline synchronisation.

## Remaining live checks

- The change has not been deployed to Render or tested against its production database. The existing pre-deploy command runs the new numbered migration automatically; migrations 001–005 are unchanged.
- Desktop and mobile visual/browser verification is outstanding. Chromium installation was attempted but the environment returned unusable downloads. DOM checks do not validate layout or real browser behaviour.
- After merging the pull request, confirm GitHub checks pass, Render pre-deploy reports `Applied 005_people_productivity.sql` and `Applied 006_workbench.sql` (earlier migrations are skipped if already applied), and `/api/health` succeeds.
- Sign in with the existing account; verify legacy tasks/projects remain; capture several tasks consecutively; refresh and confirm persistence.
- Try `Follow up next Friday`, `Downtime - tidy templates`, `Ongoing - improve MyAVM` and `Prepare goals in 2 weeks` and check the preview before saving.
- Test Brain Dump, delegation/reassignment/return, date presets/custom date, effort/time suggestions, bucket and tag management, shared tag rename/merge, remembered capture bucket, grouped/flat Downtime, project milestones, snooze visibility and wake-up, search and completion on desktop and phone.

No Render resources were created or charged and no deployment secrets were changed. Existing administrative password recovery remains unchanged. Settings JSON export is not a complete database backup.

Phase 5 live acceptance checks: verify saved progress/references/subtask ordering after refresh; review exclusions before copying a prompt; import supported lists; test physical-device PWA installation/dictation and capture recovery; record an actual discussion; try Radar follow-up/decision actions and Weekly Reset; verify achievements against known completion dates. Private records require the existing signed-in account. Browser/mobile layout and OS installation checks remain outstanding; no live production-database verification is claimed.

## Coordinated simplification / smart automation upgrade

- Populated-database migration 007 tested after 001–006; prior migrations are unchanged. TP alias appended without replacing existing aliases.
- Pure tests cover source-of-truth and compound aliases, separate deadlines/follow-ups/flexible windows, invalid human dates, original-text override, natural recurrence, month-end and monthly-ordinal math, weekends/DST dates, bounded dependency-aware planning and unchanged deadlines.
- Actual SQL tests cover independent recurring occurrence notes/status, missed-date coalescing, open-backlog cap, repeated generation without duplicates, pause/resume/stop, after-completion scheduling, dependency-cycle rejection and separate flexible work dates.
- Notification tests cover authenticated owner isolation, encrypted URL storage, safe settings responses, enablement confirmation, unique digest keys, test cooldown, transactional duplicate-claim prevention, restart recovery to unknown, cancellation on disable, privacy payloads, Microsoft URL validation, redirects disabled, safe errors and bounded 429 retries. External delivery uses simulated HTTP responses; no live Teams request was sent.
- Simulated React/DOM checks pass: exactly four primary destinations; calm Home; hidden capture options; typed date intent and original-text correction; workbench next action/progress/privacy-safe prompt/import; recurrence controls; Suggested Plan; meeting/achievements views; hidden Teams settings; command capture; lost-response retry. This verifies interactions, not pixel layout or physical-device behaviour.
- TypeScript and production build pass. Existing Render build/start/pre-deploy commands remain unchanged. Scheduled Actions configuration is additive and safely skips when settings are missing.

Manual setup remains: tenant trigger/anonymous-auth/personal-chat verification, creation of the Teams Workflow, storing its signed URL in app Settings, configuring HUB_JOB_SECRET in Render and matching PROJECT_HUB_JOB_SECRET plus PROJECT_HUB_URL in GitHub Actions, manually running the workflow and confirming actual delivery. The public guide at /teams-setup.html contains full instructions. No new Render service, AI API, premium HTTP trigger or subscription was provisioned.

Scheduling limitations: Actions timing is best-effort and public-repository schedules can auto-disable after inactivity. No guaranteed-time scheduler is claimed. Outbound webhooks cannot guarantee exactly-once delivery; unknown outcomes are held rather than automatically resent. A successful webhook response does not establish that the later Teams posting action succeeded. Desktop/mobile browser layout, tenant access and live Render database/deployment remain unverified until inspected in those environments.
