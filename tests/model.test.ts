import test from "node:test";
import assert from "node:assert/strict";
import {
  taskSchema,
  projectSchema,
  stats,
  progress,
  today,
  addDays,
  type Task,
} from "../lib/model";
const make = (id: string, values: Record<string, unknown> = {}): Task => ({
  ...taskSchema.parse({ title: "Task", ...values }),
  id,
  completed_at: null,
  created_at: "2026-10-14T00:00:00Z",
  updated_at: "2026-10-14T00:00:00Z",
});
test("quick capture needs only a title", () => {
  const t = taskSchema.parse({ title: "  Follow up  " });
  assert.equal(t.title, "Follow up");
  assert.equal(t.status, "Inbox");
  assert.equal(t.due_date, null);
  assert.equal(t.priority, "None");
  assert.equal(t.classification, "Standard");
});
test("rejects invalid status, dates, IDs and empty titles", () => {
  for (const v of [
    { title: "" },
    { title: "x", status: "Wrong" },
    { title: "x", due_date: "2026-02-30" },
    { title: "x", project_id: "bad" },
  ])
    assert.equal(taskSchema.safeParse(v).success, false);
});
test("dashboard counts exclude completed and archived records", () => {
  const rows = [
    make("1", { due_date: "2026-10-15" }),
    make("2", { due_date: "2026-10-14", priority: "High" }),
    make("3", { due_date: "2026-10-22", status: "Waiting" }),
    make("4", { due_date: "2026-10-23" }),
    make("5", { status: "Completed" }),
    make("6", { archived: true }),
  ];
  assert.deepEqual(stats(rows, [], "2026-10-15"), {
    outstanding: 4,
    today: 1,
    overdue: 1,
    week: 1,
    high: 1,
    waiting: 1,
    projects: 0,
  });
});
test("progress uses completed over non archived tasks, empty is null", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(progress([], id), null);
  assert.equal(
    progress(
      [
        make("1", { project_id: id }),
        make("2", { project_id: id, status: "Completed" }),
        make("3", { project_id: id, archived: true }),
      ],
      id,
    ),
    50,
  );
});
test("Adelaide date includes DST and UTC day boundary", () => {
  assert.equal(today(new Date("2026-10-14T14:00:00Z")), "2026-10-15");
  assert.equal(today(new Date("2026-06-14T14:00:00Z")), "2026-06-14");
  assert.equal(addDays("2026-12-29", 7), "2027-01-05");
});
test("project validates statuses and trims title", () => {
  assert.equal(projectSchema.parse({ name: " x " }).name, "x");
  assert.equal(
    projectSchema.safeParse({ name: "x", status: "To Do" }).success,
    false,
  );
});
