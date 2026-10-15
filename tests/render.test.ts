import test from "node:test";
import assert from "node:assert/strict";
import { Kysely } from "kysely";
import { KyselyPGlite } from "kysely-pglite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { readFile, writeFile } from "node:fs/promises";
import { authOptions } from "../lib/auth-config";
import { provision } from "../lib/provision";
import { writeRecord, loadRecords } from "../lib/records";
test("Render PostgreSQL migration, app workflows, RLS and Better Auth login", async () => {
  const pg = new KyselyPGlite();
  const db = new Kysely<any>({ dialect: pg.dialect });
  const options = authOptions(
    { db: db as any, type: "postgres" },
    {
      url: "http://localhost:3000",
      secret: "test-only-32-character-secret-for-auth",
      ownerEmail: "owner@example.test",
    },
  );
  const migrations = await getMigrations(options);
  await writeFile("db/auth-schema.sql", await migrations.compileMigrations());
  await migrations.runMigrations();
  await pg.client.exec(await readFile("db/migrations/001_core.sql", "utf8"));
  const c = {
    query: async (text: string, values?: any[]) => {
      const r = await pg.client.query(text, values);
      return { rows: r.rows as any[], rowCount: r.affectedRows };
    },
  };
  await pg.client.exec("BEGIN");
  const owner = await provision(
    c,
    "owner@example.test",
    "Owner",
    "a-secure-test-password",
  );
  await pg.client.exec("COMMIT");
  await assert.rejects(
    () => provision(c, "other@example.test", "Other", "another-safe-password"),
    /already exists/,
  );
  const auth = betterAuth(options);
  const signup = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: "intruder@example.test",
        password: "a-password-long-enough",
        name: "Intruder",
      }),
    }),
  );
  assert.equal(signup.ok, false);
  const login = async (
    password = "a-secure-test-password",
    origin = "http://localhost:3000",
  ) =>
    auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ email: "owner@example.test", password }),
      }),
    );
  const denied = await login("wrong-password");
  assert.equal(denied.ok, false);
  const forged = await login("a-secure-test-password", "https://attacker.test");
  assert.equal(forged.status, 403);
  const signed = await login();
  if (!signed.ok) console.error(await signed.clone().text());
  assert.equal(signed.status, 200);
  const cookie = signed.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("session_token"));
  assert.ok(signed.headers.getSetCookie().some((s) => /httponly/i.test(s)));
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  assert.equal(session?.user.id, owner);
  assert.equal(await auth.api.getSession({ headers: new Headers() }), null);
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true);`,
  );
  const project = await writeRecord(
    c,
    owner,
    "projects",
    "save",
    { name: "Project A" },
    null,
  );
  const parent = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { title: "Parent", project_id: project.id, due_date: "2026-10-15" },
    null,
  );
  const child = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { title: "Child", parent_id: parent.id, project_id: project.id },
    null,
  );
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...parent, status: "Completed" },
    parent.id,
  );
  const all = await loadRecords(c);
  assert.equal(all.tasks.length, 2);
  assert.ok(all.tasks.find((t) => t.id === parent.id)?.completed_at);
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...parent, status: "To Do" },
    parent.id,
  );
  assert.equal(
    (await loadRecords(c)).tasks.find((t) => t.id === parent.id)?.completed_at,
    null,
  );
  await pg.client.exec("COMMIT");
  async function rejected(sql: string, args: any[], pattern: RegExp) {
    await pg.client.exec(
      `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
    );
    try {
      await assert.rejects(() => c.query(sql, args), pattern);
    } finally {
      await pg.client.exec("ROLLBACK");
    }
  }
  await rejected(
    "update tasks set parent_id=$1 where id=$2",
    [child.id, parent.id],
    /loop/,
  );
  await rejected(
    "delete from projects where id=$1",
    [project.id],
    /foreign key/,
  );
  await rejected("delete from tasks where id=$1", [parent.id], /foreign key/);
  await rejected(
    "delete from authorised_users where user_id=$1",
    [owner],
    /permission denied/,
  );
  await rejected(
    "insert into activity(user_id,entity_type,entity_id,title,action) values($1,$2,$3,$4,$5)",
    [owner, "tasks", parent.id, "Fake", "insert"],
    /permission denied/,
  );
  await rejected("select * from account", [], /permission denied/);
  const other = "22222222-2222-4222-8222-222222222222";
  await pg.client.query(
    'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
    [other, "Other", "other@example.test"],
  );
  await pg.client.query("insert into authorised_users values($1)", [other]);
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  assert.equal((await loadRecords(c)).tasks.length, 0);
  await assert.rejects(
    () =>
      writeRecord(
        c,
        other,
        "tasks",
        "save",
        { title: "Attack", project_id: project.id },
        null,
      ),
    /foreign key/,
  );
  await pg.client.exec("ROLLBACK");
  await pg.client.exec("BEGIN");
  await provision(
    c,
    "owner@example.test",
    "Owner",
    "new-safe-password-123",
    true,
  );
  await pg.client.exec("COMMIT");
  assert.equal(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
    null,
  );
  assert.equal((await login("new-safe-password-123")).ok, true);
  const secureAuth = betterAuth({
    ...options,
    baseURL: "https://hub.example",
    trustedOrigins: ["https://hub.example"],
    advanced: { ...options.advanced, useSecureCookies: true },
  });
  const secureLogin = await secureAuth.handler(
    new Request("https://hub.example/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://hub.example",
      },
      body: JSON.stringify({
        email: "owner@example.test",
        password: "new-safe-password-123",
      }),
    }),
  );
  assert.equal(secureLogin.ok, true);
  assert.ok(
    secureLogin.headers
      .getSetCookie()
      .some((c) => /; Secure/i.test(c) && /; HttpOnly/i.test(c)),
  );
  const secureCookie = secureLogin.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const changed = await secureAuth.handler(
    new Request("https://hub.example/api/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://hub.example",
        cookie: secureCookie,
      },
      body: JSON.stringify({
        currentPassword: "new-safe-password-123",
        newPassword: "another-password-123456",
        revokeOtherSessions: true,
      }),
    }),
  );
  assert.equal(changed.ok, true);
  const logout = await secureAuth.handler(
    new Request("https://hub.example/api/auth/sign-out", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://hub.example",
        cookie: secureCookie,
      },
      body: "{}",
    }),
  );
  assert.equal(logout.ok, true);
  assert.equal(
    await secureAuth.api.getSession({
      headers: new Headers({ cookie: secureCookie }),
    }),
    null,
  );
  let limited = false;
  for (let i = 0; i < 6; i++) {
    if ((await login("wrong-password")).status === 429) {
      limited = true;
      break;
    }
  }
  assert.ok(limited, "Repeated login failures are throttled");
  await db.destroy();
});
