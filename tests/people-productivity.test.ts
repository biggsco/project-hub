import test from "node:test";
import assert from "node:assert/strict";
import {
  taskSchema,
  projectSchema,
  type Task,
  type Project,
} from "../lib/model";
import { type Directory, inPeopleScope, meetingItems } from "../lib/people";
import {
  parseTaskInput,
  captureContextDefaults,
  suitableTasks,
} from "../lib/capture";
import {
  recommendTasks,
  needsAttention,
  resumeWork,
  isWelcomeBack,
  inFocus,
} from "../lib/productivity";
const day = "2026-10-15";
const directory: Directory = {
  teams: [
    {
      id: "planning",
      name: "Technology Planning",
      aliases: ["Planning"],
      description: "",
      archived: false,
    },
    {
      id: "systems",
      name: "Technology Systems",
      aliases: ["Systems"],
      description: "",
      archived: false,
    },
  ],
  people: [
    {
      id: "tom",
      name: "Tom Smith",
      team_ids: ["planning", "systems"],
      notes: "",
      archived: false,
    },
  ],
};
const make = (v: Record<string, unknown> = {}): Task => ({
  ...taskSchema.parse({ title: "Task", ...v }),
  id: crypto.randomUUID(),
  created_at: "2026-10-14T01:00:00Z",
  updated_at: "2026-10-14T01:00:00Z",
  completed_at: null,
});
test("task types do not replace workflow status or work classification", () => {
  const t = make({
    task_type: "Discuss",
    classification: "Downtime",
    status: "In Progress",
  });
  assert.equal(t.task_type, "Discuss");
  assert.equal(t.classification, "Downtime");
  assert.equal(t.status, "In Progress");
  const plain = make();
  assert.equal(plain.task_type, "To Do");
  assert.equal(plain.team_id, null);
  assert.equal(plain.person_id, null);
});
test("people context prepares a discussion checklist without requiring a named person", () => {
  const d = captureContextDefaults("People & Teams", null, null, {
    team_id: "planning",
    meeting: true,
  });
  assert.equal(d.team_id, "planning");
  assert.equal(d.person_id, null);
  assert.equal(d.task_type, "Discuss");
  assert.equal(captureContextDefaults("Dashboard").task_type, "To Do");
});
test("team recognition preserves meaningful text and does not guess ambiguous groups", () => {
  const p = parseTaskInput(
    "Discuss new systems requests with Technology Systems",
    [],
    [],
    day,
    {},
    directory,
  );
  assert.equal(p.title, "Discuss new systems requests with Technology Systems");
  assert.equal(p.task_type, "Discuss");
  assert.equal(p.team_id, "systems");
  const prefixed = parseTaskInput(
    "Discuss - Planning - update goals tomorrow",
    [],
    [],
    day,
    {},
    directory,
  );
  assert.equal(prefixed.title, "update goals");
  assert.equal(prefixed.team_id, "planning");
  assert.equal(prefixed.due_date, "2026-10-16");
  const ambiguous = {
    ...directory,
    teams: [
      ...directory.teams,
      { ...directory.teams[1], aliases: ["Planning"] },
    ],
  };
  assert.equal(
    parseTaskInput("Raise this with Planning", [], [], day, {}, ambiguous)
      .team_id,
    null,
  );
});
test("follow-up dates remain distinct from actual deadlines", () => {
  const p = parseTaskInput(
    "Follow Up - chase Planning next Friday",
    [],
    [],
    day,
    { due_date: "2026-11-01" },
    directory,
  );
  assert.equal(p.follow_up_date, "2026-10-23");
  assert.equal(p.due_date, "2026-11-01");
  assert.equal(p.task_type, "Follow Up");
  const person = parseTaskInput(
    "Delegated - Tom Smith - review diagrams in 2 weeks",
    [],
    [],
    day,
    {},
    directory,
  );
  assert.equal(person.person_id, "tom");
  assert.equal(person.follow_up_date, "2026-10-29");
  assert.equal(person.due_date, null);
  const titleOnly = parseTaskInput(
    "Follow up with IT next Friday",
    [],
    [],
    day,
    {},
    directory,
  );
  assert.equal(
    titleOnly.follow_up_date,
    "2026-10-23",
    "follow-up wording creates a chase date",
  );
});
test("group meeting lists include direct team tasks and member tasks once", () => {
  const a = make({ team_id: null, person_id: null, task_type: "Discuss" });
  // UUID fields are validated separately; fixtures use identifiers after validation.
  const member = { ...make({ task_type: "Discuss" }), person_id: "tom" };
  const both = {
    ...make({ task_type: "Follow Up" }),
    person_id: "tom",
    team_id: "planning",
  };
  const finished = {
    ...member,
    id: crypto.randomUUID(),
    status: "Completed" as const,
  };
  const snoozed = {
    ...member,
    id: crypto.randomUUID(),
    snoozed_until: "2026-10-20",
  };
  assert.equal(
    inPeopleScope(member, directory.teams, directory.people, "planning", null),
    true,
  );
  assert.equal(
    inPeopleScope(member, directory.teams, directory.people, "systems", null),
    true,
  );
  const rows = meetingItems(
    [a, member, both, finished, snoozed],
    directory.people,
    "planning",
    null,
    day,
  );
  assert.deepEqual(
    new Set(rows.map((t) => t.id)),
    new Set([member.id, both.id]),
  );
  assert.equal(rows.length, 2);
  assert.equal(
    inPeopleScope(a, [], [], null, null),
    true,
    "unorganised discussions remain available",
  );
});
test("recommendations exclude blocked, assigned, snoozed, future and completed work", () => {
  const eligible = make({ title: "My action", effort_minutes: 30 });
  const excluded = [
    make({ status: "Blocked" }),
    make({ status: "Completed" }),
    make({ archived: true }),
    make({ assigned_to: "Sarah" }),
    make({ task_type: "Delegated" }),
    make({ task_type: "Discuss" }),
    make({ snoozed_until: "2026-10-16" }),
    make({ start_date: "2026-10-16" }),
    make({ focus_dismissed_until: "2026-10-16" }),
  ];
  assert.deepEqual(
    recommendTasks([eligible, ...excluded], { day }).map((r) => r.task.id),
    [eligible.id],
  );
  assert.equal(
    recommendTasks([eligible], { day, skipped: [eligible.id] }).length,
    0,
  );
  assert.equal(recommendTasks([eligible], { day, minutes: 15 }).length, 0);
});
test("due delegated follow-ups are recommended as chasing, never doing someone else's work", () => {
  const t = make({
    assigned_to: "Sarah",
    task_type: "Delegated",
    status: "Waiting",
    follow_up_date: day,
  });
  const suggested = recommendTasks([t], { day });
  assert.equal(suggested.length, 1);
  assert.equal(suggested[0].kind, "follow_up");
  assert.equal(
    recommendTasks([{ ...t, follow_up_date: "2026-10-16" }], { day }).length,
    0,
  );
  assert.equal(
    recommendTasks([{ ...t, status: "Blocked" }], { day }).length,
    0,
  );
});
test("attention is bounded and excludes low-value overdue backlog", () => {
  const backlog = Array.from({ length: 20 }, () =>
    make({ due_date: "2026-01-01", priority: "Low" }),
  );
  const important = Array.from({ length: 10 }, () =>
    make({ due_date: "2026-10-14", priority: "High" }),
  );
  const result = needsAttention([...backlog, ...important], day);
  assert.equal(result.length, 6);
  assert.ok(result.every((t) => t.priority === "High"));
  assert.equal(
    needsAttention(
      [make({ classification: "Ongoing", due_date: "2026-01-01" })],
      day,
    ).length,
    0,
  );
});
test("available time ranks downtime and skips discussions and delegated work", () => {
  const normal = make({ effort_minutes: 15 }),
    downtime = make({ classification: "Downtime", effort_minutes: 30 });
  assert.deepEqual(
    suitableTasks(
      [
        normal,
        downtime,
        make({ task_type: "Discuss", effort_minutes: 15 }),
        make({ task_type: "Delegated", effort_minutes: 15 }),
      ],
      30,
      day,
    ).map((t) => t.id),
    [downtime.id, normal.id],
  );
});
test("focus dismissal and snooze never rewrite deadlines; welcome-back needs a real absence", () => {
  const t = make({
    due_date: "2026-10-14",
    focus_dismissed_until: "2026-10-22",
  });
  assert.equal(inFocus(t, day), false);
  assert.equal(inFocus(t, "2026-10-22"), true);
  assert.equal(t.due_date, "2026-10-14");
  assert.equal(isWelcomeBack(null, new Date("2026-10-15T00:00:00Z")), false);
  assert.equal(
    isWelcomeBack("2026-10-01T00:00:00Z", new Date("2026-10-15T00:00:00Z")),
    true,
  );
  assert.equal(
    isWelcomeBack("2026-10-14T00:00:00Z", new Date("2026-10-15T00:00:00Z")),
    false,
  );
});
test("recent work is bounded and ordering is deterministic", () => {
  const task = make({ next_action: "Review current configuration" });
  const project: Project = {
    ...projectSchema.parse({ name: "Project", next_action: "Check quote" }),
    id: "project",
    created_at: "2026-10-10",
    updated_at: "2026-10-14",
  };
  assert.equal(resumeWork([task], [project], day).tasks[0].id, task.id);
  assert.deepEqual(
    recommendTasks([task], { day }),
    recommendTasks([task], { day }),
  );
});
