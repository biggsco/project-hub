import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCapture,
  resolveDate,
  addMonths,
  previewBulk,
  suitableTasks,
  assignmentChange,
  actionable,
} from "../lib/capture";
import { taskSchema, stats, today, type Task } from "../lib/model";
const day = "2026-10-15";
const make = (values: Record<string, unknown> = {}): Task => ({
  ...taskSchema.parse({ title: "Task", ...values }),
  id: crypto.randomUUID(),
  completed_at: null,
  created_at: "",
  updated_at: "",
});
test("title-only capture and independent classifications", () => {
  assert.deepEqual(parseCapture("Review kitchen documents", day), {
    title: "Review kitchen documents",
    classification: "Inbox",
    due_date: null,
  });
  for (const classification of ["Downtime", "Ongoing"]) {
    const t = taskSchema.parse(
      parseCapture(classification + " - improve documentation", day),
    );
    assert.equal(t.classification, classification);
    assert.equal(t.status, "Inbox");
    assert.equal(t.due_date, null);
  }
});
test("supported date expressions follow Adelaide calendar rules", () => {
  const expected: Record<string, string> = {
    Today: "2026-10-15",
    Tomorrow: "2026-10-16",
    Friday: "2026-10-16",
    "This Friday": "2026-10-16",
    "Next Friday": "2026-10-23",
    "Next Monday": "2026-10-19",
    "Next week": "2026-10-19",
    "in 2 weeks": "2026-10-29",
    "in 3 days": "2026-10-18",
    "in 2 months": "2026-12-15",
    "End of week": "2026-10-16",
    "End of month": "2026-10-31",
    "15/12/2026": "2026-12-15",
    "2026-12-15": "2026-12-15",
  };
  for (const [expression, date] of Object.entries(expected)) {
    assert.equal(resolveDate(expression, day), date, expression);
    assert.equal(
      parseCapture("Call supplier " + expression, day).due_date,
      date,
      expression,
    );
  }
  assert.equal(resolveDate("Friday", "2026-10-16"), "2026-10-16");
  assert.equal(resolveDate("next Friday", "2026-10-18"), "2026-10-23");
  assert.equal(resolveDate("next Friday", "2026-10-19"), "2026-10-30");
  assert.equal(resolveDate("end of week", "2026-10-18"), "2026-10-23");
});
test("month arithmetic clamps and crosses years and leap days", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(resolveDate("in 1 month", "2026-12-31"), "2027-01-31");
  assert.equal(resolveDate("in 2 weeks", "2026-12-25"), "2027-01-08");
});
test("ambiguous, invalid and unrecognised suffixes are preserved", () => {
  for (const text of [
    "Call sometime soon",
    "Call Friday or Monday",
    "Call next Friday or tomorrow",
    "Call before Friday",
    "Call every Friday",
    "Call maybe tomorrow",
    "Call 30/02/2026",
    "Call 03/04",
    "Call in 0 days",
    "Friday team meeting",
    "tomorrow",
  ]) {
    assert.equal(parseCapture(text, day).title, text, text);
    assert.equal(parseCapture(text, day).due_date, null, text);
  }
});
test("Adelaide day boundaries and daylight saving determine relative dates", () => {
  assert.equal(
    parseCapture("Call tomorrow", today(new Date("2026-10-14T14:00:00Z")))
      .due_date,
    "2026-10-16",
  );
  assert.equal(
    parseCapture("Call tomorrow", today(new Date("2026-06-14T14:00:00Z")))
      .due_date,
    "2026-06-15",
  );
  assert.equal(resolveDate("in 2 days", "2026-10-03"), "2026-10-05");
});
test("brain dump splits CRLF, skips blanks and parses independently", () => {
  const items = previewBulk(
    "Review documents\r\n\r\nFollow up next Friday\nDowntime - tidy templates\nOngoing: improve MyAVM\nPrepare goals in 2 weeks",
    day,
  );
  assert.equal(items.length, 5);
  assert.equal(items[1].due_date, "2026-10-23");
  assert.equal(items[2].classification, "Downtime");
  assert.equal(items[3].classification, "Ongoing");
  assert.equal(items[4].due_date, "2026-10-29");
});
test("assignment, reassignment and return do not alter classification or completion", () => {
  const t = make({ classification: "Downtime", status: "In Progress" });
  const assigned = { ...t, ...assignmentChange(t, " Sarah Smith ", day) };
  assert.equal(assigned.assigned_to, "Sarah Smith");
  assert.equal(assigned.date_assigned, day);
  assert.equal(assigned.classification, "Downtime");
  assert.equal(assigned.status, "In Progress");
  const again = {
    ...assigned,
    ...assignmentChange(assigned, "Sarah Smith", "2026-10-16"),
  };
  assert.equal(again.date_assigned, day);
  const changed = {
    ...again,
    ...assignmentChange(again, "Edward", "2026-10-17"),
  };
  assert.equal(changed.date_assigned, "2026-10-17");
  const returned = { ...changed, ...assignmentChange(changed, "", day) };
  assert.equal(returned.assigned_to, "");
  assert.equal(returned.date_assigned, null);
  assert.equal(returned.follow_up_date, null);
  assert.equal(returned.status, "In Progress");
});
test("available time prioritises suitable downtime and excludes nonactionable work", () => {
  const standard = make({ effort_minutes: 15, priority: "Critical" });
  const downtime = make({ classification: "Downtime", effort_minutes: 30 });
  const rows = [
    standard,
    downtime,
    ...[
      { status: "Waiting" },
      { status: "Blocked" },
      { status: "Completed" },
      { archived: true },
      { assigned_to: "Sarah" },
      { snoozed_until: "2026-10-16" },
      { start_date: "2026-10-16" },
      { effort_minutes: 60 },
      { effort_minutes: null },
      { date_preferences: { due_date: "Someday" } },
    ].map((v) => make({ effort_minutes: 15, ...v })),
  ];
  assert.deepEqual(
    suitableTasks(rows, 30, day).map((t) => t.id),
    [downtime.id, standard.id],
  );
});
test("snooze keeps deadlines intact and wakes on the selected day", () => {
  const t = make({ due_date: "2026-10-14", snoozed_until: "2026-10-16" });
  assert.equal(actionable(t, day), false);
  assert.equal(stats([t], [], day).overdue, 0);
  assert.equal(actionable(t, "2026-10-16"), true);
  assert.equal(t.due_date, "2026-10-14");
});

test("ongoing responsibilities are never counted as overdue", () => {
  const t = make({ classification: "Ongoing", due_date: "2026-01-01" });
  assert.equal(stats([t], [], day).overdue, 0);
  assert.equal(stats([t], [], day).outstanding, 1);
});
