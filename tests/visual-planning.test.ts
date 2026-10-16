import test from "node:test";
import assert from "node:assert/strict";
import { taskSchema, type Task } from "../lib/model";
import {
  planningBoard,
  planningPatch,
  planningLanes,
  suggestedPlan,
} from "../lib/planning";
import { recommendTasks } from "../lib/productivity";
import { suitableTasks } from "../lib/capture";
import {
  taskWorkspace,
  workspaceColour,
  taskDate,
} from "../lib/workspace-style";
const day = "2026-10-16";
const make = (value: Record<string, unknown> = {}): Task => ({
  ...taskSchema.parse({ title: "A task", status: "To Do", ...value }),
  id: crypto.randomUUID(),
  created_at: `${day}T00:00:00Z`,
  updated_at: `${day}T00:00:00Z`,
  completed_at: null,
});
test("planning handles empty and large backlogs without duplicates or hidden unscheduled tasks", () => {
  assert.deepEqual(planningBoard([], day), {
    Today: [],
    Tomorrow: [],
    "This Week": [],
    Later: [],
  });
  const tasks = Array.from({ length: 500 }, (_, i) =>
    make({
      title: `Task ${i}`,
      planned_for:
        i % 5 === 0
          ? "2026-10-01"
          : i % 5 === 1
            ? "2026-10-17"
            : i % 5 === 2
              ? "2026-10-20"
              : i % 5 === 3
                ? "2026-11-01"
                : null,
    }),
  );
  const before = JSON.stringify(tasks),
    board = planningBoard(tasks, day),
    rows = Object.values(board).flat();
  assert.equal(rows.length, 500);
  assert.equal(new Set(rows.map((t) => t.id)).size, 500);
  assert.ok(board.Today.some((t) => t.planned_for === "2026-10-01"));
  assert.equal(board.Tomorrow.length, 100);
  assert.equal(board["This Week"].length, 100);
  assert.equal(JSON.stringify(tasks), before);
  assert.deepEqual(planningBoard(tasks, day), board);
  const plan = suggestedPlan(tasks, day);
  assert.ok(plan.today.length <= 3 && plan.week.length <= 5);
});
test("moving flexible work across every lane preserves firm and follow-up dates", () => {
  const original = make({
    due_date: "2026-10-18",
    follow_up_date: "2026-10-19",
    planned_for: "2026-10-01",
    next_action: "Call supplier",
  });
  for (const lane of planningLanes) {
    const patch = planningPatch(lane, day),
      moved = { ...original, ...patch };
    assert.deepEqual(Object.keys(patch), ["planned_for"]);
    assert.equal(moved.due_date, original.due_date);
    assert.equal(moved.follow_up_date, original.follow_up_date);
    assert.ok(planningBoard([moved], day)[lane].some((t) => t.id === moved.id));
  }
});
test("planning and recommendations respect blockers, dependencies, snooze and due recurring occurrences", () => {
  const prerequisite = make(),
    future = make({ recurrence_date: "2026-10-17", effort_minutes: 15 }),
    due = make({ recurrence_date: day });
  const hidden = [
    make({ status: "Blocked" }),
    make({ depends_on_id: prerequisite.id }),
    make({ snoozed_until: "2026-10-17" }),
    make({ status: "Completed" }),
    future,
  ];
  const tasks = [prerequisite, due, ...hidden];
  assert.deepEqual(
    new Set(
      Object.values(planningBoard(tasks, day))
        .flat()
        .map((t) => t.id),
    ),
    new Set([prerequisite.id, due.id]),
  );
  assert.ok(
    !recommendTasks(tasks, { day }).some((r) => r.task.id === future.id),
  );
  assert.equal(suitableTasks([future], 30, day).length, 0);
  assert.equal(suitableTasks([future], 30, "2026-10-17").length, 1);
});
test("workspace identities stay consistent across aliases and task contexts; labels distinguish dates", () => {
  assert.equal(
    workspaceColour("Technology Planning", ["TP"]),
    workspaceColour("TP"),
  );
  assert.equal(
    workspaceColour("Vectorworks (VWX)", ["VWX"]),
    workspaceColour("VWX"),
  );
  assert.equal(
    workspaceColour("My own workspace"),
    workspaceColour("My own workspace"),
  );
  const bucket = {
    id: crypto.randomUUID(),
    name: "Momentus",
    aliases: [],
    description: "",
    position: 0,
    archived: false,
  };
  const task = make({ bucket_id: bucket.id, planned_for: "2026-10-01" });
  assert.equal(
    taskWorkspace(task, { teams: [], buckets: [bucket], projects: [] }).name,
    "Momentus",
  );
  assert.deepEqual(taskDate(task), { label: "Flexible", date: "2026-10-01" });
  assert.equal(taskDate({ ...task, due_date: day })?.label, "Deadline");
  assert.equal(taskDate({ ...task, follow_up_date: day })?.label, "Follow up");
});
