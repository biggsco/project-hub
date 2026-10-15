import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskInput, resolveDate } from "../lib/capture";
import {
  recurrenceSchema,
  firstOccurrence,
  nextOccurrence,
  parseRecurrence,
} from "../lib/recurrence";
import { suggestedPlan } from "../lib/planning";
import { taskSchema } from "../lib/model";
import {
  encryptWebhook,
  decryptWebhook,
  validateWebhook,
  notificationPayload,
  scheduledNotifications,
  adelaideClock,
} from "../lib/notifications";
import { notificationSchema } from "../lib/notification-model";
import { postWebhook } from "../lib/jobs";
const day = "2026-10-15",
  teamId = crypto.randomUUID(),
  bucketId = crypto.randomUUID();
const directory = {
  teams: [
    {
      id: teamId,
      name: "Technology Planning",
      aliases: ["TP"],
      description: "",
      archived: false,
    },
    {
      id: crypto.randomUUID(),
      name: "GM",
      aliases: [],
      description: "",
      archived: false,
    },
    {
      id: crypto.randomUUID(),
      name: "Technology Systems",
      aliases: ["Systems"],
      description: "",
      archived: false,
    },
  ],
  people: [],
};
const buckets = [
  {
    id: bucketId,
    name: "Vectorworks",
    aliases: ["VWX"],
    description: "",
    position: 0,
    archived: false,
  },
];
const parse = (s: string) => parseTaskInput(s, buckets, [], day, {}, directory);
const make = (v: any) => ({
  ...taskSchema.parse(v),
  id: crypto.randomUUID(),
  completed_at: null,
  created_at: day + "T00:00:00Z",
  updated_at: day + "T00:00:00Z",
});
test("smart capture recognises custom aliases and compound team/bucket prefixes", () => {
  assert.equal(parse("TP - Review team goals").team_id, teamId);
  const both = parse("Systems VWX - Discuss coordinate automation");
  assert.equal(both.bucket_id, bucketId);
  assert.equal(both.team_id, directory.teams[2].id);
  assert.equal(both.task_type, "Discuss");
  assert.equal(both.title, "Discuss coordinate automation");
  assert.equal(parse("GM - Discuss capital priorities").task_type, "Discuss");
});
test("firm dates, follow-ups and flexible windows stay independent", () => {
  const deadline = parse("TP - Finalise team goals by 30 October");
  assert.equal(deadline.due_date, "2026-10-30");
  assert.equal(deadline.follow_up_date, null);
  const chase = parse("Systems - Chase AP locations in 2 weeks");
  assert.equal(chase.follow_up_date, "2026-10-29");
  assert.equal(chase.due_date, null);
  const flexible = taskSchema.parse(
    parse("VWX - Work on tags sometime next week"),
  );
  assert.equal(flexible.suggested_start, "2026-10-19");
  assert.equal(flexible.suggested_end, "2026-10-23");
  assert.equal(flexible.due_date, null);
  const eventually = parse("Think about improvements eventually");
  assert.equal(eventually.date_preferences.due_date, "Someday");
  assert.equal(eventually.due_date, null);
  assert.equal(resolveDate("30 February", day), null);
  assert.equal(parse("Review by maybe Friday").title, "Review by maybe Friday");
  const raw = parseTaskInput(
    "TP - Review tomorrow",
    buckets,
    [],
    day,
    { literal: true },
    directory,
  );
  assert.equal(raw.title, "TP - Review tomorrow");
  assert.equal(raw.team_id, null);
  assert.equal(raw.due_date, null);
});
test("natural recurrence and calendar arithmetic handle month anchors, ordinals and DST dates", () => {
  for (const input of [
    "Review every Monday",
    "Review every fortnight",
    "Prepare update first Friday of each month",
    "Review links every 3 months",
  ])
    assert.ok(parse(input).recurrence_rule);
  const month = recurrenceSchema.parse({
    frequency: "monthly",
    start_date: "2026-01-31",
  });
  assert.equal(nextOccurrence(month, "2026-01-31"), "2026-02-28");
  assert.equal(nextOccurrence(month, "2026-02-28"), "2026-03-31");
  const ordinal = parseRecurrence(
    "Prepare first Friday of each month",
    day,
  ).rule!;
  assert.equal(ordinal.start_date, "2026-11-06");
  assert.equal(nextOccurrence(ordinal, "2026-11-06"), "2026-12-04");
  const weekdays = recurrenceSchema.parse({
    frequency: "weekdays",
    start_date: day,
  });
  assert.equal(nextOccurrence(weekdays, "2026-10-16"), "2026-10-19");
  const completion = recurrenceSchema.parse({
    frequency: "monthly",
    mode: "after_completion",
    start_date: day,
  });
  assert.equal(nextOccurrence(completion, "2026-11-30"), "2026-12-30");
  assert.equal(
    nextOccurrence(
      recurrenceSchema.parse({ frequency: "daily", start_date: "2026-10-03" }),
      "2026-10-03",
    ),
    "2026-10-04",
  );
});
test("preset first occurrences align weekends and monthly ordinals", () => {
  assert.equal(
    firstOccurrence(
      recurrenceSchema.parse({
        frequency: "weekdays",
        start_date: "2026-10-17",
      }),
    ),
    "2026-10-19",
  );
  assert.equal(
    firstOccurrence(
      recurrenceSchema.parse({
        frequency: "nth_weekday",
        start_date: day,
        weekday: 5,
        ordinal: 1,
      }),
    ),
    "2026-11-06",
  );
  assert.equal(
    recurrenceSchema.safeParse({
      frequency: "monthly",
      start_date: "2026-02-31",
    }).success,
    false,
  );
});
test("Suggested Plan is small, respects dependencies, skips and never changes deadlines", () => {
  const prerequisite = make({ title: "Blocked prerequisite" });
  const dependent = make({
    title: "Dependent",
    priority: "Critical",
    depends_on_id: prerequisite.id,
  });
  const tasks = [
    prerequisite,
    dependent,
    ...Array.from({ length: 20 }, (_, i) =>
      make({ title: `Work ${i}`, due_date: day }),
    ),
  ];
  const before = JSON.stringify(tasks);
  const p = suggestedPlan(tasks, day, [prerequisite.id]);
  assert.ok(p.today.length <= 3 && p.week.length <= 5);
  assert.ok(
    ![...p.today, ...p.week].some(
      (t) => t.id === dependent.id || t.id === prerequisite.id,
    ),
  );
  assert.equal(JSON.stringify(tasks), before);
});
test("webhook secrets are encrypted and URLs cannot target arbitrary hosts or redirects", () => {
  const url =
      "https://prod-01.australiasoutheast.logic.azure.com/workflows/test/triggers/manual/paths/invoke?sig=secret",
    secret = "test-encryption-key-more-than-32-characters";
  const cipher = encryptWebhook(url, secret);
  assert.ok(!cipher.includes("sig="));
  assert.equal(decryptWebhook(cipher, secret), url);
  assert.throws(() =>
    decryptWebhook(cipher, "another-secret-with-at-least-32-characters"),
  );
  for (const bad of [
    "http://localhost/workflows/x?sig=x",
    "https://example.com/workflows/x?sig=x",
    "https://a.logic.azure.com.attacker.test/workflows/x?sig=x",
    "https://user:pass@a.logic.azure.com/workflows/x?sig=x",
    "https://a.logic.azure.com/workflows/x",
  ])
    assert.throws(() => validateWebhook(bad));
});
test("daily/weekly/reminder identifiers are deterministic, date-aware and default to quiet settings", () => {
  const s = notificationSchema.parse({ enabled: true, tenant_confirmed: true });
  assert.equal(s.daily, true);
  assert.equal(s.important, false);
  const now = new Date("2026-10-15T00:00:00Z");
  const task = make({ title: "Flexible", planned_for: day });
  const jobs = scheduledNotifications(s, [task], now);
  assert.equal(jobs[0].key, "daily:2026-10-15");
  const card = JSON.stringify(
    notificationPayload(
      "id",
      "daily",
      [task],
      "https://hub.example",
      true,
      day,
    ),
  );
  assert.ok(!card.includes("Flexible"));
  assert.equal(adelaideClock(new Date("2026-10-14T14:00:00Z")).day, day);
  assert.equal(
    scheduledNotifications({ ...s, enabled: false }, [], now).length,
    0,
  );
  const monday = scheduledNotifications(
    { ...s, weekly: true },
    [],
    new Date("2026-10-19T00:00:00Z"),
  );
  assert.ok(monday.some((j) => j.key === "weekly:2026-10-19"));
});
test("Teams card privacy omits notes and includes direct authenticated task links", () => {
  const task = make({
    title: "Review goals",
    due_date: day,
    notes: "secret notes",
    description: "private description",
    next_action: "private next",
  });
  const body = JSON.stringify(
    notificationPayload(
      "unique-id",
      "daily",
      [task],
      "https://hub.example",
      true,
      day,
    ),
  );
  assert.ok(body.includes(task.title));
  assert.ok(body.includes(task.id));
  assert.ok(
    !body.includes("secret notes") &&
      !body.includes("private description") &&
      !body.includes("private next"),
  );
});
test("webhook retry policy bounds known rejections and avoids duplicate ambiguous sends", async () => {
  const transport = (status: number) => async () =>
    new Response(null, { status });
  assert.equal(
    (await postWebhook("https://x", {}, transport(202) as any)).status,
    "delivered",
  );
  assert.equal(
    (await postWebhook("https://x", {}, transport(429) as any)).retry,
    true,
  );
  assert.equal(
    (await postWebhook("https://x", {}, transport(403) as any)).retry,
    false,
  );
  assert.equal(
    (await postWebhook("https://x", {}, transport(500) as any)).status,
    "unknown",
  );
  const lost = await postWebhook("https://x", {}, (async () => {
    throw Error("URL with secret must not escape");
  }) as any);
  assert.equal(lost.status, "unknown");
  assert.ok(!JSON.stringify(lost).includes("secret"));
});
