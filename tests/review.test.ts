import test from "node:test";
import assert from "node:assert/strict";
import { taskSchema } from "../lib/model";
import {
  followUpRadar,
  weeklyReset,
  conversationHistory,
  achievements,
} from "../lib/review";
const day = "2026-10-15";
const make = (v: any) => ({
  ...taskSchema.parse(v),
  id: crypto.randomUUID(),
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  completed_at: null,
});
test("radar separates dates and explicit decisions and excludes completed and snoozed work", () => {
  const rows = [
    make({ title: "Late", follow_up_date: "2026-10-14", assigned_to: "Alex" }),
    make({ title: "Today", follow_up_date: day }),
    make({ title: "Soon", follow_up_date: "2026-10-20" }),
    make({ title: "Decision", awaiting_decision: true }),
    make({ title: "Not a decision", status: "Waiting" }),
    make({ title: "Done", status: "Completed", follow_up_date: day }),
    make({ title: "Later", follow_up_date: day, snoozed_until: "2026-11-01" }),
  ];
  const r = followUpRadar(rows, day);
  assert.deepEqual(
    r.overdue.map((t) => t.title),
    ["Late"],
  );
  assert.deepEqual(
    r.today.map((t) => t.title),
    ["Today"],
  );
  assert.deepEqual(
    r.upcoming.map((t) => t.title),
    ["Soon"],
  );
  assert.deepEqual(
    r.decisions.map((t) => t.title),
    ["Decision"],
  );
  assert.equal(r.unscheduled.length, 2);
});
test("Weekly Reset is bounded, deduplicated and does not rewrite task dates", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    make({
      title: `Item ${i}`,
      status: i % 2 ? "In Progress" : "Inbox",
      priority: "High",
      due_date: i % 3 ? "2026-10-14" : "2026-10-18",
      follow_up_date: day,
    }),
  );
  const before = JSON.stringify(rows);
  const reset = weeklyReset(rows, [], day);
  assert.ok(reset.items.length <= 12);
  assert.equal(
    new Set(reset.items.map((r) => r.task.id)).size,
    reset.items.length,
  );
  assert.equal(JSON.stringify(rows), before);
});
test("conversation summaries require explicit discussion entries and never infer conversations from updates", () => {
  const team = crypto.randomUUID();
  const t = make({ title: "Edited task", team_id: team, task_type: "Discuss" });
  const directory = {
    teams: [
      { id: team, name: "GM", aliases: [], description: "", archived: false },
    ],
    people: [],
  };
  assert.equal(
    conversationHistory([t], directory, team, null, day).discussions.length,
    0,
  );
  t.progress_entries.push({
    id: crypto.randomUUID(),
    text: "Actually discussed",
    kind: "discussion",
    created_at: "2026-10-14T05:00:00Z",
  });
  assert.equal(
    conversationHistory([t], directory, team, null, day).discussions[0].entry
      .text,
    "Actually discussed",
  );
  assert.equal(
    conversationHistory([t], directory, team, null, day).unresolved.length,
    1,
  );
});
test("achievements use recorded completion timestamps with Adelaide day boundaries", () => {
  const t = {
    ...make({ title: "Completed work", status: "Completed" }),
    completed_at: "2026-10-14T14:00:00Z",
  };
  const filters = {
    from: day,
    to: day,
    project: "",
    bucket: "",
    team: "",
    type: "",
  };
  assert.equal(achievements([t], filters, { teams: [], people: [] }).length, 1);
  assert.equal(
    achievements([{ ...t, status: "To Do" }], filters, {
      teams: [],
      people: [],
    }).length,
    0,
  );
  assert.equal(
    achievements([{ ...t, content_type: "Note" }], filters, {
      teams: [],
      people: [],
    }).length,
    0,
  );
});

test("achievement exports include only selected recorded work and protect CSV cells", async () => {
  const { achievementSummary, achievementCsv, achievementPrompt } =
    await import("../lib/achievement-export");
  const t = {
    ...make({
      title: "=Unsafe spreadsheet title",
      notes: "Private notes",
      status: "Completed",
    }),
    completed_at: "2026-10-14T14:00:00Z",
  };
  const summary = achievementSummary([t], [], [], true);
  assert.ok(summary.startsWith("- 2026-10-15"));
  assert.ok(!summary.includes("Private notes"));
  assert.ok(
    achievementCsv([t], [], []).includes('"\'=Unsafe spreadsheet title"'),
  );
  assert.ok(
    achievementPrompt(summary).includes("Do not invent business impact"),
  );
  assert.equal(achievementSummary([], [], []), "");
});
