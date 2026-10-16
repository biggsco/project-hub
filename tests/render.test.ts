import test from "node:test";
import assert from "node:assert/strict";
import { Kysely } from "kysely";
import { KyselyPGlite } from "kysely-pglite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { readFile, writeFile } from "node:fs/promises";
import { authOptions } from "../lib/auth-config";
import {
  assignTaskBuckets,
  organise,
  organisationRecords,
} from "../lib/organisation-records";
import { advanceRecurring, recurrenceAction } from "../lib/recurrence-records";
import {
  saveNotificationSettings,
  notificationSettings,
  queueTest,
} from "../lib/notification-records";
import { enqueueForUser, claimDelivery } from "../lib/jobs";
import { today } from "../lib/model";
import { planningPatch } from "../lib/planning";
import { workbenchAction } from "../lib/workbench-records";
import { saveContact, peopleRecords, recordVisit } from "../lib/people-records";
import { provision } from "../lib/provision";
import {
  writeRecord,
  loadRecords,
  captureTasks,
  planTask,
} from "../lib/records";
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
  // Apply the additive upgrade to an already populated database.
  const legacy = await c.query(
    "insert into tasks(user_id,title,person,status) values($1,'Existing task','Legacy contact','Waiting') returning id",
    [owner],
  );
  await pg.client.exec(
    await readFile("db/migrations/002_frictionless.sql", "utf8"),
  );
  await c.query(
    "update tasks set tags=array[' automation ','AUTOMATION','Old Tag'] where id=$1",
    [legacy.rows[0].id],
  );
  await pg.client.exec(
    await readFile("db/migrations/003_buckets_tags.sql", "utf8"),
  );
  const preserved = await c.query("select * from tasks where id=$1", [
    legacy.rows[0].id,
  ]);
  assert.equal(preserved.rows[0].title, "Existing task");
  assert.equal(preserved.rows[0].person, "Legacy contact");
  assert.equal(preserved.rows[0].status, "Waiting");
  assert.equal(preserved.rows[0].classification, "Inbox");
  assert.deepEqual(preserved.rows[0].tags, ["automation", "Old Tag"]);
  assert.equal(
    (
      await c.query("select * from task_tags where task_id=$1", [
        legacy.rows[0].id,
      ])
    ).rows.length,
    2,
  );
  assert.equal((await c.query("select * from buckets")).rows.length, 5);

  await pg.client.exec(
    await readFile("db/migrations/004_core_simplicity.sql", "utf8"),
  );
  const simplified = (
    await c.query("select * from tasks where id=$1", [legacy.rows[0].id])
  ).rows[0];
  assert.equal(simplified.classification, "Standard");
  assert.deepEqual(simplified.tags, preserved.rows[0].tags);
  assert.equal(
    simplified.priority,
    preserved.rows[0].priority,
    "existing priority is retained",
  );
  assert.equal(simplified.status, "Waiting");
  assert.equal(simplified.title, "Existing task");
  // Upgrade an existing manual delegation without requiring a colleague account.
  const oldDelegation = (
    await c.query(
      "insert into tasks(user_id,title,assigned_to,status) values($1,'Existing delegation',' Existing Colleague ','Waiting') returning *",
      [owner],
    )
  ).rows[0];
  await pg.client.exec(
    await readFile("db/migrations/005_people_productivity.sql", "utf8"),
  );
  await pg.client.exec(
    await readFile("db/migrations/006_workbench.sql", "utf8"),
  );
  await pg.client.exec(
    await readFile("db/migrations/007_simplify_automation.sql", "utf8"),
  );
  const migrated = (
    await c.query("select * from tasks where id=$1", [oldDelegation.id])
  ).rows[0];
  assert.equal(migrated.status, "Waiting");
  assert.equal(migrated.task_type, "Delegated");
  assert.ok(migrated.person_id);
  assert.equal(
    (await c.query("select name from people where id=$1", [migrated.person_id]))
      .rows[0].name,
    "Existing Colleague",
  );
  await c.query("delete from tasks where id=$1", [oldDelegation.id]);
  const oldClient = (
    await c.query(
      "insert into tasks(user_id,title,classification) values($1,'Previous deployment','Inbox') returning *",
      [owner],
    )
  ).rows[0];
  assert.equal(oldClient.classification, "Standard");
  assert.equal(oldClient.priority, "None");
  await c.query("delete from tasks where id=$1", [oldClient.id]);
  await c.query("delete from tasks where id=$1", [legacy.rows[0].id]);
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
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const capture = {
    request_id: crypto.randomUUID(),
    lines: [
      "Review documents",
      "Follow up next Friday",
      "Downtime - tidy templates",
      "Ongoing - improve MyAVM in 2 weeks",
    ],
  };
  const captured = await captureTasks(
    c,
    owner,
    capture,
    new Date("2026-10-15T01:00:00Z"),
  );
  assert.equal(captured.length, 4);
  assert.equal(captured[1].follow_up_date, "2026-10-23");
  assert.equal(captured[2].classification, "Downtime");
  assert.equal(captured[3].classification, "Ongoing");
  assert.equal(captured[3].due_date, "2026-10-29");
  const contextCapture = {
    request_id: crypto.randomUUID(),
    lines: ["Project-context task"],
    defaults: {
      project_id: project.id,
      bucket_id: null,
      classification: "Standard",
    },
  };
  const contextRows = await captureTasks(c, owner, contextCapture);
  assert.equal(contextRows[0].project_id, project.id);
  assert.equal(contextRows[0].priority, "None");
  assert.equal(contextRows[0].status, "Inbox");
  const legacyReceipt = {
    request_id: crypto.randomUUID(),
    lines: ["Legacy receipt task"],
  };
  const legacyRecords = await captureTasks(c, owner, {
    ...legacyReceipt,
    request_id: crypto.randomUUID(),
  });
  await c.query(
    "insert into capture_batches(defaults,user_id,request_id,lines,records) values($1::jsonb,$2,$3,$4::jsonb,$5::jsonb)",
    [
      JSON.stringify({ classification: "Inbox" }),
      owner,
      legacyReceipt.request_id,
      JSON.stringify(legacyReceipt.lines),
      JSON.stringify(legacyRecords),
    ],
  );
  assert.equal(
    (
      await captureTasks(c, owner, {
        ...legacyReceipt,
        defaults: { classification: "Standard" },
      })
    )[0].id,
    legacyRecords[0].id,
  );
  await pg.client.exec("COMMIT");
  // Retry after commit simulates a lost HTTP response. No new rows are written.
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const beforeRetry = (await loadRecords(c)).tasks.length;
  const retried = await captureTasks(c, owner, capture);
  assert.deepEqual(
    retried.map((t: any) => t.id),
    captured.map((t) => t.id),
  );
  assert.equal((await loadRecords(c)).tasks.length, beforeRetry);
  await assert.rejects(
    () => captureTasks(c, owner, { ...capture, lines: ["Changed payload"] }),
    /already used/,
  );
  await assert.rejects(() =>
    captureTasks(c, owner, {
      request_id: crypto.randomUUID(),
      lines: ["Would be valid", "x".repeat(300)],
    }),
  );
  assert.equal(
    (await loadRecords(c)).tasks.length,
    beforeRetry,
    "invalid batch writes nothing",
  );
  const delegated = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...captured[2],
      assigned_to: "Sarah Smith",
      date_assigned: "2026-10-15",
      follow_up_date: "2026-10-23",
      assignment_notes: "Review when available",
      effort_minutes: 30,
      next_action: "Check current template",
      snoozed_until: "2026-10-16",
    },
    captured[2].id,
  );
  assert.equal(delegated.status, "Inbox");
  assert.equal(delegated.classification, "Downtime");
  assert.equal(delegated.completed_at, null);
  assert.equal(delegated.follow_up_date, "2026-10-23");
  const reassign = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...delegated, assigned_to: "Edward" },
    delegated.id,
  );
  assert.equal(reassign.assigned_to, "Edward");
  assert.equal(reassign.completed_at, null);
  const returned = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...reassign,
      assigned_to: "",
      task_type: "To Do",
      date_assigned: null,
      follow_up_date: null,
      status: "To Do",
    },
    reassign.id,
  );
  assert.equal(returned.classification, "Downtime");
  assert.equal(returned.status, "To Do");
  const done = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...returned, status: "Completed" },
    returned.id,
  );
  assert.ok(done.completed_at);
  await pg.client.exec("COMMIT");
  // Every row, receipt and audit entry rolls back when the enclosing operation fails.
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const rollbackId = crypto.randomUUID();
  const rolled = await captureTasks(c, owner, {
    request_id: rollbackId,
    lines: ["Rolled back"],
  });
  await pg.client.exec("ROLLBACK");
  assert.equal(
    (await c.query("select * from tasks where id=$1", [rolled[0].id])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await c.query("select * from capture_batches where request_id=$1", [
        rollbackId,
      ])
    ).rows.length,
    0,
  );
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  assert.equal(
    (await c.query("select * from capture_batches")).rows.length,
    0,
    "capture receipts are isolated by owner",
  );
  assert.equal(
    (await c.query("select * from tasks where assigned_to='Edward'")).rows
      .length,
    0,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const library = await organisationRecords(c);
  const vwx = library.buckets.find((b) => b.name === "Vectorworks (VWX)");
  const custom = await organise(c, owner, {
    action: "bucket_save",
    value: {
      name: "  Venue  Planning ",
      description: "Useful layout improvements",
      aliases: ["Planning"],
    },
  });
  assert.equal(custom.name, "Venue Planning");
  const initial = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Both project and bucket",
      project_id: project.id,
      bucket_id: custom.id,
      classification: "Downtime",
      status: "To Do",
      tags: [" Research ", "research", "Custom  Tag"],
    },
    null,
  );
  assert.equal(initial.project_id, project.id);
  assert.equal(initial.bucket_id, custom.id);
  assert.equal(initial.classification, "Downtime");
  assert.equal(initial.tags.length, 2);
  assert.equal(
    (await c.query("select * from task_tags where task_id=$1", [initial.id]))
      .rows.length,
    2,
  );
  const tagLibrary = await organisationRecords(c);
  const customTag = tagLibrary.tags.find((t) => t.name === "Custom Tag");
  const duplicate = await organise(c, owner, {
    action: "tag_save",
    value: { name: " custom   tag " },
  });
  assert.equal(
    duplicate.id,
    customTag.id,
    "case and whitespace do not create a second library tag",
  );
  const taggedProject = await writeRecord(
    c,
    owner,
    "projects",
    "save",
    { ...project, tags: [customTag.name, "Research"] },
    project.id,
  );
  assert.equal(taggedProject.tags.length, 2);
  await organise(c, owner, {
    action: "tag_save",
    id: customTag.id,
    value: { name: "Renamed tag" },
  });
  let current = await loadRecords(c);
  assert.ok(
    current.tasks
      .find((t) => t.id === initial.id)
      ?.tags.includes("Renamed tag"),
  );
  assert.ok(
    current.projects
      .find((p) => p.id === project.id)
      ?.tags.includes("Renamed tag"),
  );
  const research = current.tags.find(
    (t) => t.name.toLowerCase() === "research",
  );
  await organise(c, owner, {
    action: "tag_save",
    id: customTag.id,
    merge_to: research.id,
  });
  current = await loadRecords(c);
  assert.deepEqual(current.tasks.find((t) => t.id === initial.id)?.tags, [
    research.name,
  ]);
  assert.deepEqual(current.projects.find((p) => p.id === project.id)?.tags, [
    research.name,
  ]);
  assert.equal(
    (await c.query("select * from task_tags where task_id=$1", [initial.id]))
      .rows.length,
    1,
  );
  assert.ok(!current.tags.some((t) => t.id === customTag.id));
  const updated = await organise(c, owner, {
    action: "bucket_save",
    id: custom.id,
    value: { ...custom, name: "Venue Improvements", aliases: ["Venue"] },
  });
  assert.equal(updated.id, custom.id);
  const order = current.buckets
    .filter((b) => !b.archived)
    .map((b) => b.id)
    .reverse();
  await organise(c, owner, { action: "bucket_reorder", ids: order });
  assert.deepEqual(
    (await organisationRecords(c)).buckets.map((b) => b.id),
    order,
  );
  const captureWithMetadata = {
    request_id: crypto.randomUUID(),
    lines: [
      "VWX - improve symbols #research",
      "Update MyAVM documentation #documentation",
    ],
    defaults: {
      classification: "Downtime",
      bucket_id: custom.id,
      tags: ["Automation"],
    },
  };
  const batch = await captureTasks(
    c,
    owner,
    captureWithMetadata,
    new Date("2026-10-15T01:00:00Z"),
  );
  assert.equal(batch[0].bucket_id, vwx.id);
  assert.equal(batch[0].classification, "Downtime");
  assert.ok(batch[0].tags.includes(research.name));
  assert.equal(batch[1].title, "Update MyAVM documentation");
  assert.notEqual(batch[1].bucket_id, custom.id);
  assert.deepEqual(
    (await captureTasks(c, owner, captureWithMetadata)).map((t) => t.id),
    batch.map((t) => t.id),
  );
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...batch[0], notes: "Updated after initial capture" },
    batch[0].id,
  );
  assert.equal(
    (await captureTasks(c, owner, captureWithMetadata))[0].notes,
    "Updated after initial capture",
  );
  await assert.rejects(
    () =>
      captureTasks(c, owner, {
        ...captureWithMetadata,
        defaults: { classification: "Inbox" },
      }),
    /already used/,
  );
  await organise(c, owner, {
    action: "bucket_save",
    id: custom.id,
    value: { ...updated, archived: true },
  });
  const afterArchive = await loadRecords(c);
  assert.equal(
    afterArchive.tasks.find((t) => t.id === initial.id)?.bucket_id,
    custom.id,
    "archiving preserves task membership",
  );
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...afterArchive.tasks.find((t) => t.id === initial.id),
      status: "Completed",
    },
    initial.id,
  );
  await assert.rejects(
    () =>
      writeRecord(
        c,
        owner,
        "tasks",
        "save",
        { title: "New archived bucket task", bucket_id: custom.id },
        null,
      ),
    /Bucket unavailable/,
  );
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...initial, bucket_id: vwx.id },
    initial.id,
  );
  assert.equal(
    (await loadRecords(c)).tasks.filter((t) => t.id === initial.id).length,
    1,
    "moving never duplicates the task",
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  assert.equal(
    (await c.query("select * from buckets where id=$1", [custom.id])).rows
      .length,
    0,
  );
  await assert.rejects(
    () =>
      organise(c, other, {
        action: "tag_save",
        id: research.id,
        value: { name: "Intruder rename" },
      }),
    /Tag unavailable/,
  );
  await assert.rejects(
    () =>
      writeRecord(
        c,
        other,
        "tasks",
        "save",
        { title: "Cross-owner bucket", bucket_id: vwx.id },
        null,
      ),
    /Bucket unavailable/,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const directory = await peopleRecords(c);
  assert.equal(directory.teams.length, 4);
  const team = await saveContact(c, owner, {
    action: "team_save",
    value: { name: "Venue Planning", aliases: ["Venue"] },
  });
  const person = await saveContact(c, owner, {
    action: "person_save",
    value: { name: "Alex Manager", team_ids: [team.id, directory.teams[0].id] },
  });
  assert.equal(
    (await peopleRecords(c)).people.find((p) => p.id === person.id)?.team_ids
      .length,
    2,
  );
  const discussion = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Discuss venue plan",
      task_type: "Discuss",
      person_id: person.id,
      team_id: team.id,
      classification: "Downtime",
      due_date: "2026-12-01",
    },
    null,
  );
  const contactDelegated = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...discussion,
      assigned_to: "  Sam   Planner ",
      follow_up_date: "2026-11-01",
      notes: "Decision recorded",
    },
    discussion.id,
  );
  assert.equal(
    contactDelegated.person_id,
    person.id,
    "delegation retains associated discussion person",
  );
  assert.notEqual(contactDelegated.assigned_person_id, person.id);
  assert.equal(contactDelegated.assigned_to, "Sam Planner");
  assert.equal(contactDelegated.status, discussion.status);
  assert.equal(contactDelegated.task_type, "Delegated");
  assert.equal(contactDelegated.due_date, "2026-12-01");
  const assignee = (await peopleRecords(c)).people.find(
    (p) => p.id === contactDelegated.assigned_person_id,
  )!;
  await saveContact(c, owner, {
    action: "person_save",
    id: assignee.id,
    value: { ...assignee, name: "Sam Updated" },
  });
  assert.equal(
    (await loadRecords(c)).tasks.find((t) => t.id === discussion.id)
      ?.assigned_to,
    "Sam Updated",
  );
  const contactReturned = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...contactDelegated,
      assigned_to: "",
      task_type: "To Do",
      focus_dismissed_until: "2026-11-02",
      snoozed_until: "2026-10-30",
    },
    discussion.id,
  );
  assert.equal(contactReturned.assigned_person_id, null);
  assert.equal(contactReturned.person_id, person.id);
  assert.equal(contactReturned.classification, "Downtime");
  assert.equal(contactReturned.due_date, "2026-12-01");
  assert.equal(contactReturned.notes, "Decision recorded");
  await saveContact(c, owner, {
    action: "team_save",
    id: team.id,
    value: { ...team, archived: true },
  });
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...contactReturned, notes: "Archived team retains existing work" },
    discussion.id,
  );
  await assert.rejects(
    () =>
      writeRecord(
        c,
        owner,
        "tasks",
        "save",
        { title: "New archived association", team_id: team.id },
        null,
      ),
    /Contact unavailable/,
  );
  const visit = await recordVisit(c, owner);
  assert.equal(visit.previous, null);
  assert.ok((await recordVisit(c, owner)).previous);
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  assert.equal(
    (await c.query("select * from people where id=$1", [person.id])).rows
      .length,
    0,
  );
  assert.equal(
    (await c.query("select * from teams where id=$1", [team.id])).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      saveContact(c, other, {
        action: "person_save",
        id: person.id,
        value: { name: "Intruder" },
      }),
    /Person unavailable/,
  );
  await assert.rejects(
    () =>
      writeRecord(
        c,
        other,
        "tasks",
        "save",
        { title: "Cross-owner contact", person_id: person.id },
        null,
      ),
    /Contact unavailable/,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const progressId = crypto.randomUUID();
  const progressInput = {
    action: "progress_add",
    task_id: discussion.id,
    text: "Schema investigated",
    request_id: progressId,
  };
  await workbenchAction(c, owner, progressInput);
  await workbenchAction(c, owner, progressInput);
  let workTask = (await loadRecords(c)).tasks.find(
    (t) => t.id === discussion.id,
  )!;
  assert.equal(
    workTask.progress_entries.length,
    1,
    "retried progress is added once",
  );
  await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...discussion, description: "Stale form updated" },
    discussion.id,
  );
  workTask = (await loadRecords(c)).tasks.find((t) => t.id === discussion.id)!;
  assert.equal(
    workTask.progress_entries.length,
    1,
    "stale forms cannot replace progress history",
  );
  const link = {
    action: "reference_save",
    task_id: discussion.id,
    reference_id: crypto.randomUUID(),
    title: "Reference",
    url: "https://example.test/docs",
  };
  await workbenchAction(c, owner, link);
  await assert.rejects(() =>
    workbenchAction(c, owner, { ...link, url: "javascript:alert(1)" }),
  );
  const stepsInput = {
    action: "steps_import",
    task_id: discussion.id,
    request_id: crypto.randomUUID(),
    titles: ["Inspect schema", "Build prototype", "Inspect schema"],
  };
  // Existing team is archived: remove it from parent before adding new associations.
  await c.query("update tasks set team_id=null where id=$1", [discussion.id]);
  const imported = await workbenchAction(c, owner, stepsInput);
  assert.equal(imported.records!.length, 2);
  assert.equal(
    (await workbenchAction(c, owner, stepsInput)).records!.length,
    2,
  );
  const repeated = await workbenchAction(c, owner, {
    ...stepsInput,
    request_id: crypto.randomUUID(),
  });
  assert.equal(repeated.records!.length, 0);
  await assert.rejects(
    () => workbenchAction(c, owner, { ...stepsInput, titles: ["Changed"] }),
    /already used/,
  );
  await workbenchAction(c, owner, {
    action: "subtasks_reorder",
    task_id: discussion.id,
    ids: imported.records!.map((t: any) => t.id).reverse(),
  });
  const importedOrder = (
    await c.query(
      "select title from tasks where parent_id=$1 order by subtask_position",
      [discussion.id],
    )
  ).rows;
  assert.deepEqual(
    importedOrder.map((t) => t.title),
    ["Build prototype", "Inspect schema"],
  );
  const chase = await workbenchAction(c, owner, {
    action: "followed_up",
    task_id: discussion.id,
    request_id: crypto.randomUUID(),
    text: "Asked for update",
    follow_up_date: "2026-12-10",
  });
  assert.equal(chase.record.status, discussion.status);
  assert.equal(
    new Date(chase.record.due_date).toISOString().slice(0, 10),
    "2026-12-01",
  );
  assert.equal(chase.record.progress_entries.at(-1).kind, "follow_up");
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  await assert.rejects(
    () => workbenchAction(c, other, progressInput),
    /Task unavailable/,
  );
  assert.equal(
    (
      await c.query("select * from step_imports where request_id=$1", [
        stepsInput.request_id,
      ])
    ).rows.length,
    0,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const repeating = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Monthly review",
      notes: "Original occurrence notes",
      recurrence_rule: {
        frequency: "monthly",
        mode: "fixed",
        start_date: "2026-01-31",
      },
    },
    null,
  );
  assert.ok(repeating.recurrence_series_id);
  const march = await advanceRecurring(c, owner, "2026-03-31");
  assert.equal(march.length, 1);
  assert.equal(march[0].due_date, "2026-03-31");
  assert.equal(march[0].notes, "");
  assert.equal(march[0].progress_entries.length, 0);
  assert.equal((await advanceRecurring(c, owner, "2026-03-31")).length, 0);
  assert.equal(
    (await advanceRecurring(c, owner, "2026-05-31")).length,
    0,
    "fixed schedules cap the open backlog at two",
  );
  const scheduled = (
    await c.query("select * from recurring_series where id=$1", [
      repeating.recurrence_series_id,
    ])
  ).rows[0];
  assert.ok(scheduled.skipped_count >= 2);
  await recurrenceAction(c, owner, {
    series_id: repeating.recurrence_series_id,
    operation: "pause",
  });
  assert.equal((await advanceRecurring(c, owner, "2026-06-30")).length, 0);
  await recurrenceAction(c, owner, {
    series_id: repeating.recurrence_series_id,
    operation: "resume",
  });
  await recurrenceAction(c, owner, {
    series_id: repeating.recurrence_series_id,
    operation: "stop",
  });
  await assert.rejects(
    () =>
      recurrenceAction(c, owner, {
        series_id: repeating.recurrence_series_id,
        operation: "resume",
      }),
    /Stopped recurrence/,
  );
  const afterCompletion = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "After completion",
      recurrence_rule: {
        frequency: "weekly",
        mode: "after_completion",
        start_date: today(),
      },
    },
    null,
  );
  assert.equal(
    (
      await c.query("select next_date from recurring_series where id=$1", [
        afterCompletion.recurrence_series_id,
      ])
    ).rows[0].next_date,
    null,
  );
  const completedRecurring = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      ...afterCompletion,
      status: "Completed",
      notes: "Own completed occurrence",
    },
    afterCompletion.id,
  );
  const afterSeries = (
    await c.query("select next_date from recurring_series where id=$1", [
      afterCompletion.recurrence_series_id,
    ])
  ).rows[0];
  assert.ok(afterSeries.next_date);
  const nextAfter = new Date(afterSeries.next_date).toISOString().slice(0, 10);
  const afterInstances = await advanceRecurring(c, owner, nextAfter);
  assert.equal(afterInstances.length, 1);
  assert.equal(afterInstances[0].notes, "");
  assert.equal(afterInstances[0].status, "To Do");
  assert.notEqual(afterInstances[0].id, completedRecurring.id);
  const dependent = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Dependent task",
      depends_on_id: afterCompletion.id,
      planned_for: today(),
    },
    null,
  );
  await assert.rejects(
    () =>
      writeRecord(
        c,
        owner,
        "tasks",
        "save",
        { ...completedRecurring, depends_on_id: dependent.id },
        afterCompletion.id,
      ),
    /Invalid task dependency/,
  );
  const firm = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Keep deadline",
      due_date: "2026-12-01",
      suggested_start: "2026-10-19",
      suggested_end: "2026-10-23",
    },
    null,
  );
  const moved = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    { ...firm, planned_for: "2026-10-22" },
    firm.id,
  );
  assert.equal(moved.due_date, "2026-12-01");
  const notificationSecret = "test-encryption-secret-more-than-32-characters",
    webhook =
      "https://prod-01.australiasoutheast.logic.azure.com/workflows/test/triggers/manual/paths/invoke?sig=never-leak-this-secret";
  await assert.rejects(
    () =>
      saveNotificationSettings(
        c,
        owner,
        { value: { enabled: true }, webhook_url: webhook },
        notificationSecret,
      ),
    /Confirm tenant/,
  );
  const notificationResult = await saveNotificationSettings(
    c,
    owner,
    { value: { enabled: true, tenant_confirmed: true }, webhook_url: webhook },
    notificationSecret,
  );
  assert.equal(notificationResult.settings.configured, true);
  assert.ok(!JSON.stringify(notificationResult).includes("never-leak"));
  const rawSettings = (
    await c.query(
      "select webhook_cipher from notification_settings where user_id=$1",
      [owner],
    )
  ).rows[0];
  assert.ok(
    rawSettings.webhook_cipher &&
      !rawSettings.webhook_cipher.includes("never-leak"),
  );
  await enqueueForUser(
    c,
    owner,
    "https://hub.example",
    new Date("2026-10-15T01:00:00Z"),
  );
  await enqueueForUser(
    c,
    owner,
    "https://hub.example",
    new Date("2026-10-15T01:01:00Z"),
  );
  assert.equal(
    (
      await c.query(
        "select id from notification_deliveries where notification_key='daily:2026-10-15'",
      )
    ).rows.length,
    1,
  );
  const testNotification = await queueTest(c, owner, "https://hub.example");
  assert.equal(
    await queueTest(c, owner, "https://hub.example"),
    testNotification,
    "test button has a server cooldown",
  );
  const claimed = await claimDelivery(c, owner, testNotification);
  assert.equal(claimed.id, testNotification);
  assert.equal(
    await claimDelivery(c, owner, testNotification),
    null,
    "a claimed message cannot be sent twice by concurrent workers",
  );
  await c.query(
    "update notification_deliveries set claimed_at=now()-interval '10 minutes' where id=$1",
    [testNotification],
  );
  await enqueueForUser(
    c,
    owner,
    "https://hub.example",
    new Date("2026-10-15T02:00:00Z"),
  );
  const interrupted = (
    await c.query(
      "select status,payload from notification_deliveries where id=$1",
      [testNotification],
    )
  ).rows[0];
  assert.equal(interrupted.status, "unknown");
  assert.deepEqual(interrupted.payload, {});
  const safeSettings = await notificationSettings(c, owner);
  assert.ok(!JSON.stringify(safeSettings).includes("never-leak"));
  assert.ok(!JSON.stringify(safeSettings).includes("webhook_cipher"));
  await saveNotificationSettings(
    c,
    owner,
    { value: { enabled: false, tenant_confirmed: true } },
    notificationSecret,
  );
  assert.equal(
    (
      await c.query(
        "select id from notification_deliveries where status='pending'",
      )
    ).rows.length,
    0,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  assert.equal(
    (await c.query("select * from notification_settings")).rows.length,
    0,
  );
  assert.equal(
    (await c.query("select * from notification_deliveries")).rows.length,
    0,
  );
  assert.equal(
    (await c.query("select * from recurring_series")).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      recurrenceAction(c, other, {
        series_id: repeating.recurrence_series_id,
        operation: "pause",
      }),
    /Series unavailable/,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${other}',true)`,
  );
  const foreignBucket = (await c.query("select id from buckets limit 1"))
    .rows[0].id;
  const foreignTask = await writeRecord(
    c,
    other,
    "tasks",
    "save",
    { title: "Other owner's task" },
    null,
  );
  await pg.client.exec("COMMIT");
  await pg.client.exec(
    `BEGIN;SET LOCAL ROLE hub_app;select set_config('hub.user_id','${owner}',true)`,
  );
  const bulkBucket = await organise(c, owner, {
    action: "bucket_save",
    value: { name: "Bulk test bucket" },
  });
  const bulkProject = await writeRecord(
    c,
    owner,
    "projects",
    "save",
    { name: "Bulk membership project" },
    null,
  );
  const bulkA = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Bulk task A",
      project_id: bulkProject.id,
      notes: "Keep the latest notes",
      classification: "Downtime",
      task_type: "Discuss",
      due_date: "2026-12-01",
      tags: ["Research"],
    },
    null,
  );
  const bulkB = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Bulk task B",
      status: "In Progress",
      next_action: "Keep my next action",
    },
    null,
  );
  const bulkIds = [bulkA.id, bulkB.id];
  const result = await assignTaskBuckets(c, owner, {
    ids: [...bulkIds, bulkA.id],
    bucket_id: bulkBucket.id,
  });
  assert.deepEqual(
    new Set(result.ids),
    new Set(bulkIds),
    "duplicate selection IDs update each task once",
  );
  const bulkRows = (await loadRecords(c)).tasks.filter((t) =>
    bulkIds.includes(t.id),
  );
  assert.ok(bulkRows.every((t) => t.bucket_id === bulkBucket.id));
  for (const original of [bulkA, bulkB]) {
    const current = bulkRows.find((t) => t.id === original.id)!;
    const {
      bucket_id: oldBucket,
      updated_at: oldUpdated,
      ...before
    } = original;
    const { bucket_id: newBucket, updated_at: newUpdated, ...after } = current;
    assert.deepEqual(
      after,
      before,
      "bulk membership preserves every other task field",
    );
  }
  await assert.rejects(
    () =>
      assignTaskBuckets(c, owner, {
        ids: [bulkA.id, foreignTask.id],
        bucket_id: vwx.id,
      }),
    /selected tasks are unavailable/,
  );
  assert.equal(
    (await c.query("select bucket_id from tasks where id=$1", [bulkA.id]))
      .rows[0].bucket_id,
    bulkBucket.id,
    "a mixed invalid selection changes nothing",
  );
  await assert.rejects(
    () =>
      assignTaskBuckets(c, owner, { ids: bulkIds, bucket_id: foreignBucket }),
    /Bucket unavailable/,
  );
  await organise(c, owner, {
    action: "bucket_save",
    id: bulkBucket.id,
    value: { name: "Bulk test bucket", archived: true },
  });
  await assert.rejects(
    () =>
      assignTaskBuckets(c, owner, { ids: bulkIds, bucket_id: bulkBucket.id }),
    /Bucket unavailable/,
  );
  await assert.rejects(() =>
    assignTaskBuckets(c, owner, { ids: [], bucket_id: null }),
  );
  await assignTaskBuckets(c, owner, { ids: bulkIds, bucket_id: null });
  assert.ok(
    (await loadRecords(c)).tasks
      .filter((t) => bulkIds.includes(t.id))
      .every((t) => t.bucket_id === null),
  );
  const plannedTask = await writeRecord(
    c,
    owner,
    "tasks",
    "save",
    {
      title: "Firm deadline, flexible work",
      due_date: "2026-10-20",
      follow_up_date: "2026-10-18",
    },
    null,
  );
  for (const lane of ["Today", "Tomorrow", "This Week", "Later"] as const) {
    const patch = planningPatch(lane, "2026-10-16");
    await planTask(c, owner, { id: plannedTask.id, ...patch });
    const saved = (await loadRecords(c)).tasks.find(
      (t) => t.id === plannedTask.id,
    )!;
    assert.equal(
      saved.planned_for,
      patch.planned_for,
      "flexible moves survive database reload",
    );
    assert.equal(
      saved.due_date,
      "2026-10-20",
      "planning never moves firm deadlines",
    );
    assert.equal(
      saved.follow_up_date,
      "2026-10-18",
      "planning never moves follow-ups",
    );
  }
  await c.query(
    "update tasks set due_date='2026-12-01', notes='Changed in another tab' where id=$1",
    [plannedTask.id],
  );
  const freshPlan = await planTask(c, owner, {
    id: plannedTask.id,
    planned_for: "2026-10-16",
  });
  assert.equal(
    freshPlan.due_date,
    "2026-12-01",
    "a stale planning card cannot overwrite a newer firm deadline",
  );
  assert.equal(freshPlan.notes, "Changed in another tab");
  await assert.rejects(
    () => planTask(c, owner, { id: foreignTask.id, planned_for: "2026-10-16" }),
    /access denied/,
  );
  await assert.rejects(() =>
    planTask(c, owner, { id: plannedTask.id, planned_for: "2026-02-31" }),
  );
  await pg.client.exec("COMMIT");
  await db.destroy();
});
