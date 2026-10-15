# Project Hub — Render edition

A private personal project manager running entirely on Render: Next.js, React, TypeScript, Tailwind CSS, Render PostgreSQL and Better Auth. No Supabase, Vercel or AI runtime integration is required.

## Status

The Phase 1 application and Render migration are implemented and locally tested. **The app is not deployed or live-verified yet.** No external account has been connected or paid service created.

Implemented: dashboard statistics, quick Inbox capture, project management and progress, task editor, subtasks, completion/reopening, inline status, duplication, archive, delete confirmation, bulk complete/archive, list/Kanban views, search/filter/sorting, Waiting task view, bookmarkable project routes, database activity, responsive CSS and dark appearance.

Authentication: email/password sign-in, HttpOnly session cookies, secure cookies over HTTPS, database-persisted login rate limits, disabled public registration, allowlisted owner, password change requiring current password, private administrative account creation and password recovery. Better Auth handles hashing and sessions; passwords are not stored in plaintext.

Remaining: live Render deployment acceptance and desktop/Android browser interaction checks; Phase 2 milestones, calendar, detailed follow-up workflows, recurrence, reminders, CSV import/export, complete backup/restore and advanced filters; Phase 3 PWA installation, accessibility/performance review and production hardening.

Notes/tags are embedded in Phase 1 records; the planned relational notes/tags tables are not yet implemented. Profile editing and timezone selection are not wired up. Tasks use Australia/Adelaide. Settings JSON export contains tasks, projects and 100 recent activity entries; it is **not** a complete database backup. There is no offline support.

## GitHub updates

Source repository: https://github.com/biggsco/project-hub (private).

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
