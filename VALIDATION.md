# Render edition validation

The application was migrated from Supabase to direct PostgreSQL access and Better Auth on 15 October 2026, Australia/Adelaide.

Local verification:

- Production Next.js compilation and TypeScript checks.
- Six model tests for capture/validation, dashboard statistics, project progress and Adelaide/DST dates.
- A PostgreSQL/Better Auth integration suite using the actual auth migrations, application migration, SQL queries and HTTP auth handler.
- Integration coverage: disabled public signup, wrong-password denial, foreign-origin denial, successful login, HttpOnly and HTTPS Secure cookies, authenticated/anonymous session lookup, authenticated password changes, sign-out, admin password recovery, session revocation and login throttling.
- Database coverage: owner provisioning and duplicate-account prevention, project/task/subtask persistence, completion/reopening timestamps, activity, linked-delete restrictions, cycle prevention, cross-owner access and link denial, and restricted-role denial for authentication tables, allowlist edits and forged activity.

Limits:

- No Render resources were created, charged, connected or deployed.
- Render role-creation privileges, runtime configuration, live login/persistence/HTTPS and database backups must be confirmed during deployment.
- No browser or Android visual/interaction verification was completed.
- Phase 2 and Phase 3 features remain as documented in README.md.
- Password recovery is an administrative Render Shell command; no recovery email delivery is configured.

The older Supabase test suite is superseded. Do not report it as hosted Render validation.
