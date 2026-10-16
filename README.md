# Project Hub — Render edition

A private personal project manager running entirely on Render: Next.js, React, TypeScript, Tailwind CSS, Render PostgreSQL and Better Auth. No Supabase, Vercel or AI runtime integration is required.

## Status

The frictionless capture, bucket and shared-tag upgrades are implemented on the existing Next.js, PostgreSQL and Better Auth application. Existing tasks and projects are preserved by the additive `002_frictionless.sql`, `003_buckets_tags.sql` `004_core_simplicity.sql` `005_people_productivity.sql`, `006_workbench.sql` and `007_simplify_automation.sql` migrations. No new runtime dependencies, AI services or subscriptions are introduced.

Implemented: universal title-only Quick Add (Enter to save; Q to focus; Ctrl/Command+K for commands), deterministic date/classification preview, date presets with optional custom calendar, Standard/Downtime/Ongoing classifications independent of status, manual delegation and follow-ups, effort estimates, Quick Wins, “I've got some time”, Brain Dump, snooze, next actions, project milestones, calendar, subtasks, notes/activity, completion/reopening, inline status/deadline editing, list/Kanban, archive, search, filters, project progress, dark appearance and responsive CSS.

Authentication and Render configuration are retained: private owner account, Better Auth sessions, disabled public registration, origin checks and PostgreSQL row-level security. This change has not been deployed or verified against the live Render service.

Remaining outside this upgrade: email delivery, general CSV import/export, complete backup/restore and full offline workspace access. Settings export includes tasks, projects, buckets, tags and the latest 100 activity entries; it is not a complete database backup.

## Current experience — coordinated simplification upgrade

Primary navigation is now **Home, Inbox, People, Work**. Home has only Quick Capture, up to four attention items, recent work and compact people shortcuts. Work uses a single contextual selector for existing projects, buckets, Downtime/Ongoing, ideas, calendar, planning and review tools. Settings remains a secondary action. No previous records or tools were removed.

Quick Capture is one title field + Enter. Optional selectors are under Options. A short live preview shows recognised metadata, not a list of empty fields. Use original text discards the automatic interpretation before saving. Bucket/team selections and failed-submission retry IDs retain the existing behaviour. Inbox defaults to all Inbox-status captures regardless of classification or assignment, with an Unorganised scope in its collapsed filters. Select individual rows or Select all, choose an active bucket in the bulk toolbar and Apply bucket. No bucket clears membership. The move updates only the selected tasks in one transaction, preserving project links, classifications, status, notes and other metadata. Selection follows the visible filtered Inbox and is retained if saving fails.

Task details open with description, Next Action, checklist, progress and Develop with ChatGPT. Plan This Task is an option in its existing prompt-mode selector. References and history are expandable; metadata, recurrence, assignment, dates, dependencies and optional reminders are under More Details. List rows show the task title and completion action; advanced filters, status/date editing and full metadata remain in filters/task details.

### Smart capture and flexible planning

- Team/bucket records remain the source of truth for aliases. Migration 007 adds TP to existing Technology Planning teams without replacing custom aliases. GM, Systems, VWX, Momentus and MyAVM use the existing names/aliases. Compound prefixes such as `Systems VWX - Discuss coordinate automation` can select both a team and bucket. Unknown/ambiguous prefixes remain in the title.
- `TP - Finalise goals by 30 October` sets a firm deadline; named day/month dates without a year use the next such date and show it in the preview. Invalid dates remain unchanged. Existing deadlines are never automatically converted or moved.
- Explicit chase/follow-up wording such as `Systems - Chase AP locations in 2 weeks` puts the date in Follow-up. `Follow up with IT next Friday` now creates a follow-up date rather than a deadline. An explicit `by` date takes precedence as a deadline. Existing saved records are not reinterpreted.
- `VWX - Work on tags sometime next week` creates a flexible Monday–Friday window. `Eventually` captures Someday without a deadline. These do not create overdue warnings.
- Suggested Plan is available in Work. It reuses the deterministic ranking engine, excludes unmet explicit dependencies, and shows at most three choices for today plus five for the coming week. Accept/skip/move/complete operate on separate flexible dates; no calendar availability is assumed. Firm deadlines remain unchanged.

### Recurring commitments

Type `every Monday`, `every fortnight`, `first Friday of each month` or `every 3 months` while capturing. More Details offers Daily, Weekdays, Weekly, Fortnightly, Monthly, Quarterly, a monthly weekday and custom day/week/month intervals. Choose fixed schedule or after completion.

A reusable definition stores the template; each occurrence is a separate task with its own status, deadline, notes, progress and activity. Fixed schedules coalesce missed dates to the latest due occurrence and cap open occurrences at two. After-completion schedules wait for completion and generate one next instance. Calendar math uses Adelaide dates rather than UTC-duration arithmetic, preserving month-end anchors and DST dates. Pause/resume/stop live under More Details. Deleting an occurrence does not regenerate it because a receipt is retained. Future instances do not inherit private occurrence notes or progress.

### Teams notifications and scheduling

Open Settings → Teams notifications & scheduled jobs. Notifications are disabled until a signed Workflow URL is saved and tenant/destination checks are confirmed. The server encrypts the URL using the existing BETTER_AUTH_SECRET; neither URL nor ciphertext is returned to the browser, task exports or delivery logs. Rotating that secret requires re-entering the webhook. Only Microsoft signed HTTPS Workflow endpoints are allowed and redirects are refused.

Daily digests, optional Monday summaries and opt-in High/Critical task reminders use Adaptive Cards with at most eight relevant titles/links. Privacy mode is on by default; disabling it adds short Next Actions only. Notes, descriptions and progress are never sent. Flexible planning dates alone do not trigger reminders. Task links open the authenticated task workbench.

The durable queue uses unique notification keys, transactional claims, attempt/delivery timestamps and safe error codes. HTTP 429 rejections retry at most three times; timeouts, interrupted workers and ambiguous server errors are marked unconfirmed rather than risking duplicate delivery. A webhook success means acceptance, not confirmed completion of the downstream Teams posting action. Exactly-once delivery is not promised.

No new Render service is provisioned. The repository's scheduled GitHub Action calls `/api/jobs` roughly every 15 minutes. Configuration needed **only for unattended automation**:

- Existing Render web service environment: `HUB_JOB_SECRET`, random and at least 32 characters.
- GitHub Actions repository secret: `PROJECT_HUB_JOB_SECRET`, same value.
- GitHub Actions repository variable: `PROJECT_HUB_URL`, the existing HTTPS app URL.
- In-app notification settings: your signed Teams Workflow URL, tenant/destination confirmation, enabled switches and Adelaide send time.

The endpoint uses constant-time bearer validation. Scheduling/recurrence/delivery state is persisted in PostgreSQL and safe across concurrent calls/restarts. GitHub schedules are best-effort and may be delayed/dropped or disabled after public-repository inactivity; monitor Actions. A dedicated timing-guaranteed scheduler would require separate approval. The authenticated workspace also safely catches up recurring instances when opened; notifications still use server-side jobs.

See the [Teams and scheduler setup guide](public/teams-setup.html), also served at `/teams-setup.html`, for the exact Teams trigger, personal Flow bot chat action/card expression, tenant checks, secret setup, test steps and troubleshooting. No premium HTTP trigger, OAuth app, AI API or new paid service is introduced. Tenant availability, policy, licensing and real chat delivery must be verified manually; the implementation does not assume them from template visibility.

Migration `007_simplify_automation.sql` is additive: flexible/dependency/reminder task fields, recurrence definitions/receipts, encrypted notification settings, durable delivery queue and job timestamps. Migrations 001–006 are unchanged. The existing Render pre-deploy command applies it; no production migration execution is claimed without live deployment access.

## Capture and dates

- Type a title and press Enter. The field clears immediately and stays focused while saving; failed entries remain available for retry.
- Prefix `Downtime -` or `Ongoing -` (colon also supported) to classify a task. All other captures default to Inbox.
- Recognised dates must be at the end of the title: today, tomorrow, weekdays, next/this weekdays, next week, in X days/weeks/months, end of week/month, YYYY-MM-DD or DD/MM/YYYY. Invalid, ambiguous, conditional or unrecognised wording is kept.
- Dates use Australia/Adelaide, including daylight saving. A bare weekday or “this Friday” means the nearest occurrence including today. “Next Friday” means Friday of the following Monday–Sunday calendar week. “Next week” means next Monday; end of week is the nearest Friday. The preview shows the exact date before saving.
- On Thursday 15 October 2026, `Follow up next Friday` is due 23 October; `Prepare goals in 2 weeks` is due 29 October. One month from 31 January clamps to the final day of February.
- Someday and No deadline both have no actual deadline; Someday is retained as an explicit date preference. Ongoing tasks are excluded from overdue highlighting/counts.
- Brain Dump previews one task per non-empty line (up to 200), then saves all tasks in one transaction. A submission UUID and an owner-isolated receipt prevent duplicate creation on retries, including after a lost response. Identical lines deliberately entered as separate lines remain separate tasks.
- Delegation uses free-text names, remembered from existing assignments, and never requires colleague accounts. Completion/status and classification remain independent. Reassign in task details, or use Return to my workload.
- Snooze never changes a deadline. Snoozed tasks wake on the selected date; use Show snoozed, search or a project view to access them earlier. Search includes completed/archived tasks; these retain their status.
- Effort presets are 15/30/60/120 minutes, half day (240 minutes), or multi-day (960 minutes, used only as a broad estimate). “I've got some time” prioritises Downtime and excludes completed, archived, waiting, blocked, delegated, future-starting, Someday and snoozed work. Unestimated tasks are not guessed to fit.
- Project target dates, milestones and follow-up dates use the same preset date control. Milestones are project tasks with an explicit marker, retaining the existing task workflow.
- Notes are editable in task details and note changes are recorded in activity. Both Ongoing tasks and projects have a Next action field; task subtasks remain available.

## Phases 1 and 2 — Core simplicity and organisation

These phases of the personal workspace brief remain implemented; phases 3 and 4 extend them below.

- Title + Enter creates an Inbox task with no deadline and no priority. Existing priorities are unchanged; `None` represents an unset priority on new tasks and is not shown as a badge.
- Quick Add follows the current bucket, project, Downtime or Ongoing workspace. Bucket/project/work style/date/tag selections stay in place during consecutive entries within that context. Moving to a different view/bucket/project resets optional metadata to that context's defaults, while preserving the task draft and failed submissions.
- Reset to Inbox clears optional metadata, including the contextual project, without clearing the typed title. The override lasts until the user changes context.
- Inbox is a task status. Standard, Downtime and Ongoing are independent work classifications. Migration 004 maps the former Inbox classification to Standard without changing status, ownership, project/bucket links, tags or priority. Legacy Inbox classification writes/receipts are accepted and normalised.
- Task completion/reopening updates the list immediately and confirms with one save request, without reloading all workspace data. The affected task is protected from duplicate clicks; a failed save restores its previous state and displays an error. Quick Add confirms success only after the save succeeds.
- Multiple tag filters can be selected together; results must contain all selected tags. Bucket/tag filters apply across task groups, and project tag filtering uses the same control.
- Snoozed tasks remain visible in an explicit bucket view as well as projects and search; immediate-action suggestions continue excluding them until they wake.
- Escape closes optional date/bucket/tag menus. The global capture shortcut is retained, and Q does not intercept typing or focused interactive controls.
- Phase 2 retains editable/reorderable/archiveable buckets, tag creation/autocomplete/rename/merge, grouped/flat Downtime, Ongoing work, bucket filtering, presets and deterministic parsing from the preceding upgrade.

No new dependency or environment-variable changes are required. Migrations 001–004 are unchanged; the new additive migration is `005_people_productivity.sql`.

## Phases 3 and 4 — People, conversations and getting started

- People & Teams is a private directory, with editable/archiveable groups and people belonging to multiple groups. Starter groups are Technology Planning, Technology Systems, GM and Other People. No accounts, invitations or messages are created for contacts.
- Tasks independently carry a team, associated person and task type: To Do, Discuss, Follow Up or Delegated. These do not replace status, classification, bucket or project. A separately tracked assignee preserves the original discussion person when an action is delegated to somebody else. Renaming an assignee updates assignment labels.
- Team/person views prepare Quick Add for that context. Meeting View defaults new captures to Discuss and provides a persistent unresolved checklist with complete, convert to action, assign/reassign, follow-up and timestamped note actions. Completed items remain accessible in All associated tasks with the Completed status filter. Snoozed items leave the meeting checklist until they wake.
- Known team aliases and exact known person wording can be recognised conservatively. Explicit `Follow Up -` or `Delegated -` relative dates become follow-up dates; ordinary `Follow up with IT next Friday` retains its existing deadline behaviour. Due dates remain independent. Quick Add previews recognised metadata.
- What's Next uses deterministic priority, deadline, due-follow-up, next-action and recency rules. It excludes blocked, completed, archived, snoozed and future-starting work. Delegated tasks are suggested only as due follow-ups, never as work for you to perform. Time estimates are required when filtering to available time. Skip is remembered for the browser-tab session.
- After seven days away, Welcome back appears with a bounded attention list, recent work and active projects. Hide from focus for a week removes an item from dashboard suggestions without deleting it or changing its deadline. Existing search/project access and snooze remain available.
- The current four primary destinations are Home, Inbox, People and Work. Existing secondary views remain available from the Work selector and commands.
- Existing effort, Quick Wins, available-time suggestions, Brain Dump, snooze and next actions are reused. No AI, new runtime dependencies or environment variables are added.

Migration 005 adds owner-isolated teams, people and memberships, task links/types, dashboard focus dates and last-opened tracking. Existing assignments are backfilled into people; existing Waiting items become Follow Up. Titles, workflow status, classification, deadlines and existing records are retained. The existing Render pre-deploy migration command applies this change after merge.

## Phase 5 — Personal Workbench (5A–5D)

The existing task drawer now opens with Resume Work: last timestamped progress entry, prominent editable Next Action, outstanding subtask count and recent references. Overview and advanced fields remain in an expandable section. Progress history, existing free-form notes and task activity are retained separately. Use “Actually discussed” only to record an actual discussion; ordinary updates are never inferred to be conversations.

- Add a progress line with Enter. Notes use server timestamps and stable retry IDs. Add/edit safe HTTP(S) references with titles. Subtasks support quick creation, inline title editing, completion and move-up/down ordering.
- Develop with ChatGPT uses four local templates: Break into Steps, Explore the Idea, Build / Implement and Help Me Get Unstuck. Select individual context items, add constraints, regenerate, edit and copy. Changing exclusions disables Copy until the preview is regenerated. No prompt, URL or task data is automatically sent anywhere; no API key or AI service exists.
- Paste Steps accepts numbered lists, Markdown checklists and JSON (`{"steps":["Step title"]}`). Preview/edit/deselect up to 100 steps. Imports append to the existing task, retain existing subtasks, deduplicate case/whitespace-equivalent titles and persist an idempotency receipt. Retrying cannot recreate imported/deleted steps or overwrite later edits. Titles are limited to 255 characters; pasted input to 60,000 characters.
- Ctrl/Cmd+K opens Search & commands. Search tasks/projects/buckets/people/teams, navigate or select a recent task. Add task uses the same Quick Add submission logic and current context; typing then Enter captures immediately. Q still focuses Quick Add. Recents are scoped locally to the signed-in email.
- `/capture` is an authenticated, minimal mobile route using the existing Quick Add. The PWA manifest provides install support, 192/512 PNG icons and a Quick Capture home-screen shortcut. Device keyboard dictation works without an API. Installation varies by browser; Safari users can use Add to Home Screen.
- Typed drafts and unconfirmed captures are retained in this device's browser storage, scoped to the signed-in email. Reopen and use Retry save after reconnecting; original request IDs are retained, including after a lost response. This is recoverable capture, not automatic offline synchronisation. Browser storage must be available; optional metadata on an unsent text draft should be reviewed after reopening. Pending submissions preserve all selected metadata. Drafts may contain private information and remain on this device.
- The service worker caches only a public offline notice. Authenticated pages, API responses and private task data are never cached by it. Opening the app while fully offline shows a reconnect notice; open capture drafts can survive a reload and be recovered once online.
- Capture as Task, Idea or Note. Ideas/notes preserve date words, require no deadline or workflow choices, stay out of recommendations/workload counts and can be converted to Inbox tasks. They appear in Inbox and Ideas & Notes, and remain searchable.
- Follow-up Radar groups overdue, due today, upcoming, explicitly flagged decisions and undated waiting work. Followed Up adds a dated progress entry and clears/reschedules only the follow-up date; underlying completion/deadline stay unchanged. Optional note/date, reschedule, snooze, complete and open actions are inline. The dashboard shows at most three requiring attention.
- Last Time We Spoke is integrated into selected people/team views and uses explicit discussion entries, recorded completions, follow-ups, decision flags and unresolved discussion tasks. It does not invent summaries or historical meetings.
- Weekly Reset is on demand: up to 12 deduplicated overdue/near-due/stale/follow-up/Inbox items plus three active projects. Keep priority, reschedule, snooze, complete, move to Downtime or mark reviewed. It does not automatically change dates or require Inbox Zero.
- Achievements uses actual task completion dates and the most recent 500 project completion events. Filter by Adelaide date, project, bucket, team or task type; select items, copy plain/Markdown, export formula-safe CSV or prepare an editable ChatGPT summary prompt. Notes/progress are excluded. Reopened tasks are not counted as currently completed; project events are labelled recorded status changes, without invented outcomes. Rendering is paginated at 50 task rows.
- Dashboard refinements reuse the existing recommendation engine: conversation shortcuts, Radar, recent Next Actions, Quick Wins/Downtime and a Deep Work time mode. Secondary functions remain available from Work and commands; the current four-item navigation is described above.

Migration `006_workbench.sql` adds defaulted JSONB progress/reference arrays, subtask order, content type and decision flag to tasks, plus an owner-isolated step-import receipt table. Existing records default to Task and retain notes/status/dates/links. Migration 005 remains unchanged. Dedicated owner-locked actions append progress and modify references; stale task forms cannot overwrite these fields. No required environment variables or runtime dependencies are added. The existing Render pre-deploy command applies all unapplied numbered migrations.

## Buckets and shared tags

Migration `003_buckets_tags.sql` adds reusable owner-isolated buckets, a tag library, task-tag and project-tag relationships, and a nullable bucket relationship on tasks. Tasks can belong to a project and bucket simultaneously. Existing records are preserved. Existing tags are backfilled, consolidating case/whitespace duplicates while retaining their task associations. The existing tags arrays remain compatible, synchronised by database triggers with the relational links.

Starter buckets are Vectorworks (VWX), Momentus, MyAVM / SharePoint, Technology Systems and Other Ideas. Starter tags are Automation, Research, Improvement, Bug, Documentation, Quick Win and Delegatable. These are database records, fully editable rather than fixed application categories. The migration seeds existing owners; a database trigger seeds newly provisioned owners.

- In Downtime, select All Downtime, a bucket, Uncategorised, Available to Delegate or Quick Wins. Switch between grouped and flat lists; priority, effort, tags, assignment and status filters apply across groups. Counts show incomplete tasks, including snoozed items; Show snoozed controls their visibility.
- Manage buckets & tags is available inline in Downtime and Settings. Create/rename/reorder/archive/restore buckets, edit descriptions/aliases, and rename or merge tags. Archiving retains memberships and shows archived groups that still contain work; archived buckets cannot receive new assignments.
- Quick Add has optional bucket chips/selector, classification, date and tags. Bucket selection stays selected across consecutive entries. Opening a bucket prepares Quick Add for that bucket; the default classification is Downtime in Downtime, Ongoing in Ongoing and Standard elsewhere. The capture status remains Inbox. Explicit selections are retained within the current context.
- Bucket chips prioritise recently used buckets, stored locally per browser. The native selector supports keyboard navigation and creating a bucket inline. You can also create buckets from task details.
- Known bucket names/aliases can be prefixes: `VWX - investigate coordinates` or `Momentus - inspect webhooks in 2 weeks`. Combine class and bucket prefixes in either order: `Downtime - VWX - tidy symbols`. Only an unambiguous known prefix is removed.
- A single unambiguous bucket mention also selects that bucket without removing title words: `Update MyAVM documentation #documentation #improvement` retains `Update MyAVM documentation` as its title. Unknown or ambiguous bucket wording remains unchanged. Archived buckets are ignored by recognition.
- Supported metadata in the title overrides the corresponding optional Quick Add defaults; choosing a bucket alone never changes classification. Preview shows the effective bucket, classification, tags and date.
- Type a tag in the autocomplete field and press Enter or Add. A new tag becomes reusable when the task/project is saved. Hashtags also create/select tags; case/whitespace duplicates are prevented. Known multiword tags accept hyphen/underscore forms, e.g. `#quick-win` selects Quick Win.
- Tasks and projects share the same tag library. Renaming or merging updates both the relational links and compatibility arrays in one transaction. Project list has a tag filter; task filters and search include tags.
- Brain Dump uses the same recognition/defaults. Preview rendering is capped at 200 entries before parsing/rendering, and oversized submissions are disabled. Retry IDs include the selected defaults, so a changed submission cannot accidentally reuse an old receipt. Successful retries clear prior error messages and return current task values.
- Settings export now includes bucket/tag definitions along with task/project metadata. It remains a portability export, not a complete database backup.

No environment-variable, Render plan, authentication or dependency changes are needed. Merge after checks pass; the existing pre-deploy command applies any unapplied numbered migrations, including 005. Live Render deployment and desktop/mobile visual verification are separate acceptance checks.

## GitHub updates

Source repository: https://github.com/biggsco/project-hub.

GitHub Actions runs the tests and production build on pushes and pull requests to `main`. Checks do not need the live database or any deployment secrets. Render's Blueprint is configured with `autoDeployTrigger: checksPass` so it deploys updates to `main` after the checks pass. For a manually created Render service, select **Auto-Deploy → After CI Checks Pass** in its Settings.

For updates, use a branch and pull request, review successful checks, then merge into `main`. Render rebuilds the app and runs migrations before deployment. The initial GitHub upload does not create Render resources or configure its connection. Keep credentials in Render Environment settings and grant Render access to only this repository where practical.

## Recommended deployment

Use the existing **Hobby workspace** with a paid web service and a paid PostgreSQL database. Workspace and service compute plans are separate. The smallest services have a rough combined compute baseline of USD 13/month, before storage, bandwidth and other usage; confirm Render's displayed quote before creation. Do not upgrade the workspace to Pro.

`render.yaml` describes this configuration with both services in Singapore and database external access disabled. The app uses the `0.5c-512mb` compute plan; the database uses `0.1c-256mb` with 1 GB storage and storage autoscaling off. Both services must use the same region. Review the actual resource quote before confirming a Blueprint.

### Step 1: Publish source to a private repository

1. Create a private GitHub repository named `project-hub`.
2. Extract the ZIP. Put the **contents** of its `project-hub` folder at the repository root (where `package.json` and `render.yaml` live).
3. Upload/commit all source, `package-lock.json`, migrations and scripts. Never upload `.env.local`, `node_modules`, `.next`, database dumps or credentials.

The app needs a running Node web service, not a static site. Render can connect directly to GitHub; ChatGPT does not need access to your Render account or database.

### Step 2: Configure Render

Either create a Blueprint from the repository and review all resources, or create the database and service manually:

**Database**

- Name: `project-hub-db`
- PostgreSQL: a currently supported default version
- Region: Singapore (match the app)
- Compute: smallest paid instance, not a 30-day Free database
- Initial storage: 1 GB, storage autoscaling off
- Database name: `project_hub`
- External IP allowlist: empty (private/internal access only)

**Web service**

- Name: `project-hub`
- Runtime: Node
- Region: same as the database
- Compute: smallest paid instance (Hobby workspace remains unchanged)
- Build: `npm ci --include=dev && npm run build`
- Pre-deploy: `npm run db:migrate`
- Start: `npm start -- -p $PORT`
- Health check: `/api/health`
- Node version: 24

Set these server-only environment values directly in Render:

| Variable                  | Value                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Render PostgreSQL **internal** database URL, or the Blueprint database reference                      |
| `BETTER_AUTH_SECRET`      | Render-generated random secret, at least 32 characters; generateValue is provided in the Blueprint    |
| `BETTER_AUTH_URL`         | Exact app HTTPS origin, e.g. `https://project-hub-xxxx.onrender.com`                                  |
| `OWNER_EMAIL`             | Your sole login email address                                                                         |
| `DATABASE_SSL`            | `disable` for Render private/internal connectivity; `require` for externally accessed TLS connections |
| `NODE_VERSION`            | `24`                                                                                                  |
| `NEXT_TELEMETRY_DISABLED` | `1`                                                                                                   |

No environment values should be prefixed `NEXT_PUBLIC_`. Do not paste credentials into chat. If your generated service hostname differs from the anticipated one, correct `BETTER_AUTH_URL` and redeploy before login. Trusted origins and cookie settings are derived from this URL.

### Step 3: Create your owner account

After deployment, open the paid web service's **Shell** in the Render dashboard and run:

```sh
npm run account:create
```

Enter a display name and a password of 12–128 characters. The password prompts do not echo input. Save the password in your password manager. The command creates one owner and refuses if any account already exists. There is never a public setup/signup endpoint.

Open the app's HTTPS URL and sign in with `OWNER_EMAIL` and that password.

### Password management and recovery

Settings supports changing your password with your current password. Other sessions are revoked on change.

If you forget it, open Render's authenticated service Shell and run:

```sh
npm run account:reset
```

Enter and confirm a new password. All sessions are revoked. Browser "Forgot password" explains this process; it does not pretend to send email. Email-based recovery is a deferred enhancement requiring a mail delivery provider. Secure your Render/GitHub accounts because dashboard administrators control application recovery and deployment.

## Database and access model

Better Auth's version-matched programmatic migration creates user, session, account, verification and rate-limit tables. `db/auth-schema.sql` is the generated schema for review, not a second migration to run manually.

The application migration creates projects, tasks, profiles, activity and the owner allowlist. UUID keys, timestamps, constraints, composite owner foreign keys and indexes remain in place. Deleting a project with tasks or a parent with children is blocked; unlink dependants first. Parent completion does not automatically complete its children. Archived tasks do not contribute to project progress; projects without tasks display no percentage.

All task/project queries run inside a transaction under the restricted `hub_app` role, with the authenticated user UUID stored transaction-locally. PostgreSQL RLS filters records and rejects cross-owner writes, project links and parent links. That role cannot read password/session tables or edit the owner allowlist/activity. Activity triggers write audit entries. The server holds the administrative pool for authentication and controlled migration/provisioning; browsers never receive database credentials.

The initial migration requires the database owner to create and grant a non-login role. If Render denies those privileges, stop and share the non-secret error text so the role can be provisioned correctly. Do not bypass the access controls.

Login rate limits are database-backed and survive service restarts. If a trusted client IP cannot be resolved, Better Auth uses a shared per-path bucket, which is acceptable for this single-owner app and cannot be bypassed by changing an untrusted forwarded header. It may temporarily block login after repeated failures. Data routes enforce the configured origin and validate fields with Zod. SQL values are parameterised, and editable table/column names come only from fixed schemas.

Calendar dates are PostgreSQL `date` values and kept as YYYY-MM-DD strings. Audit/session times use `timestamptz`. Dashboard boundaries use `Australia/Adelaide` with daylight saving. All application records are read without the previous hosted API's implicit 1,000-row limit.

## Local development and checks

Use Node.js 24 and PostgreSQL. Put local credentials in `.env.local` (never commit it):

```sh
npm ci
npm run db:migrate
npm run account:create
npm run dev
```

Next.js loads `.env.local`; administrative scripts explicitly load it. To check source without connecting a live database:

```sh
npm test
npm run build
npm run typecheck
```

The local PostgreSQL integration test uses PGlite through Kysely. It runs the actual Better Auth migrations, app migration, owner provisioning, HTTP auth handler, session reads, task/project queries and RLS. It does not simulate successful login or stub database access. This remains a local engine test rather than a deployed Render verification.

`npm run db:migrate` uses a PostgreSQL advisory lock, checksum tracking and transactional application migrations. Never edit an applied app migration; add a new numbered migration. Pin auth dependencies with the committed lockfile and review Better Auth schema changes before upgrades.

## Live acceptance checklist

- Healthy deployment on HTTPS, with `/api/health` returning success.
- Owner account creation succeeds once; public registration stays disabled.
- Valid login works, incorrect passwords fail, session survives refresh and sign-out revokes it.
- Anonymous and unapproved sessions cannot access data.
- Create/edit/archive projects; create/edit/complete/reopen tasks and subtasks.
- Linked deletes and subtask cycles are blocked.
- Dashboard counts and progress match actual database records.
- Search, filters, sorting, bulk operations and status changes work.
- Refresh and re-login retain data.
- Change password with current password; test administrative recovery.
- Test editor focus and controls on desktop and Android.
- Confirm credentials are absent from browser bundles and the database external allowlist is empty.

## Backup and recovery

Settings export is a portability aid, not a full backup. Use the paid Render database backup/export facilities and verify the selected instance's retention and recovery options. Keep independent encrypted database exports and test restoration in a separate database. Dumps contain sensitive password hashes and sessions; never commit or upload them as project artifacts.

A full restore must include authentication and application tables, allowlist and migration records. Restore database roles/ownership/grants as needed; a data-only dump does not recreate `hub_app`. Set a fresh `BETTER_AUTH_SECRET` after recovery if sessions should be invalidated. Account recovery also revokes sessions. Retain secure copies of runtime configuration outside the repository.

Render's app filesystem is disposable; business records live in PostgreSQL. No persistent application disk is needed for this version. No cron, Redis, SMTP subscription or AI API is required.

## Maintenance

Monitor Render usage and displayed charges. Commit the lockfile, test/build before upgrades, back up before database migrations, and use Render's deployment rollback for application regressions. App rollback does not automatically roll back database migrations. Keep `BETTER_AUTH_URL` and HTTPS/cookie settings aligned when changing domains.

## Official references

- [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app)
- [Render PostgreSQL](https://render.com/docs/postgresql)
- [Render free-service limitations](https://render.com/docs/free)
- [Render compute-plan identifiers](https://render.com/docs/compute-plans)
- [Better Auth database migrations](https://better-auth.com/docs/concepts/database)
- [Better Auth password authentication](https://better-auth.com/docs/authentication/email-password)
