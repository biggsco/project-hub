import type { QueryClient } from "./records";
import { writeRecord } from "./records";
import { today, taskSchema, type Task } from "./model";
import {
  firstOccurrence,
  nextOccurrence,
  recurrenceSchema,
} from "./recurrence";
import { z } from "zod";
const dateString = (v: any) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v;
function template(t: Task) {
  const keys = [
    "title",
    "description",
    "project_id",
    "bucket_id",
    "team_id",
    "person_id",
    "task_type",
    "classification",
    "tags",
    "priority",
    "effort_minutes",
    "next_action",
    "assigned_to",
  ] as const;
  return Object.fromEntries(keys.map((k) => [k, t[k]]));
}
export async function syncSeries(
  c: QueryClient,
  userId: string,
  task: Task,
  previous: Task | undefined,
  day = today(),
) {
  const rule = task.recurrence_rule;
  if (!rule) {
    if (previous?.recurrence_series_id)
      await c.query(
        "update recurring_series set stopped=true,updated_at=now() where id=$1 and user_id=$2",
        [previous.recurrence_series_id, userId],
      );
    return task;
  }
  let series = task.recurrence_series_id
    ? (
        await c.query(
          "select * from recurring_series where id=$1 and user_id=$2 for update",
          [task.recurrence_series_id, userId],
        )
      ).rows[0]
    : null;
  if (!series) {
    const first = firstOccurrence(rule);
    series = (
      await c.query(
        "insert into recurring_series(user_id,template,rule,next_date) values($1,$2::jsonb,$3::jsonb,$4) returning *",
        [
          userId,
          JSON.stringify(template(task)),
          JSON.stringify(rule),
          rule.mode === "fixed" ? nextOccurrence(rule, first) : null,
        ],
      )
    ).rows[0];
    const updated = (
      await c.query(
        "update tasks set recurrence_series_id=$1,recurrence_date=$2,due_date=coalesce(due_date,$2::date) where id=$3 and user_id=$4 returning *",
        [series.id, first, task.id, userId],
      )
    ).rows[0];
    await c.query(
      "insert into recurrence_occurrences(user_id,series_id,occurrence_date,task_id) values($1,$2,$3,$4) on conflict do nothing",
      [userId, series.id, first, task.id],
    );
    task = {
      ...updated,
      due_date: dateString(updated.due_date),
      recurrence_date: dateString(updated.recurrence_date),
    };
  } else {
    const changed = JSON.stringify(series.rule) !== JSON.stringify(rule);
    const next = changed
      ? rule.mode === "fixed"
        ? rule.start_date > day
          ? rule.start_date
          : nextOccurrence(rule, day)
        : null
      : dateString(series.next_date);
    await c.query(
      "update recurring_series set template=$1::jsonb,rule=$2::jsonb,next_date=$3,updated_at=now() where id=$4 and user_id=$5",
      [
        JSON.stringify(template(task)),
        JSON.stringify(rule),
        next,
        series.id,
        userId,
      ],
    );
  }
  if (
    rule.mode === "after_completion" &&
    task.status === "Completed" &&
    previous?.status !== "Completed" &&
    !series.stopped
  ) {
    const next = nextOccurrence(rule, day);
    await c.query(
      "update recurring_series set next_date=case when next_date is null or next_date<$1 then $1::date else next_date end where id=$2 and user_id=$3",
      [next, series.id, userId],
    );
  }
  return task;
}
export async function advanceRecurring(
  c: QueryClient,
  userId: string,
  day = today(),
) {
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  const series = (
    await c.query(
      "select * from recurring_series where user_id=$1 and not paused and not stopped and next_date<=$2 order by next_date limit 100 for update",
      [userId, day],
    )
  ).rows;
  const created: Task[] = [];
  for (const s of series) {
    const rule = recurrenceSchema.parse(s.rule);
    let occurrence = dateString(s.next_date),
      next: string | null = null,
      missed = 0;
    // Fixed schedules coalesce missed dates into the latest due occurrence, never a catch-up backlog.
    if (rule.mode === "fixed") {
      let candidate = nextOccurrence(rule, occurrence);
      while (candidate <= day && missed < 200000) {
        occurrence = candidate;
        candidate = nextOccurrence(rule, occurrence);
        missed++;
      }
      next = candidate;
    }
    const prior = (
      await c.query(
        "select task_id from recurrence_occurrences where series_id=$1 and occurrence_date=$2 and user_id=$3",
        [s.id, occurrence, userId],
      )
    ).rows[0];
    const open = (
      await c.query(
        "select count(*)::int as n from tasks where recurrence_series_id=$1 and user_id=$2 and status<>'Completed' and not archived",
        [s.id, userId],
      )
    ).rows[0].n;
    if (!prior && open < 2) {
      let value = {
        ...s.template,
        status: "To Do",
        due_date: occurrence,
        recurrence_rule: rule,
        recurrence_series_id: s.id,
        recurrence_date: occurrence,
      };
      // Archived organisation records retain old links but do not receive newly generated work.
      for (const [field, table] of [
        ["bucket_id", "buckets"],
        ["team_id", "teams"],
        ["person_id", "people"],
      ])
        if (value[field]) {
          const v = (
            await c.query(
              `select archived from ${table} where id=$1 and user_id=$2`,
              [value[field], userId],
            )
          ).rows[0];
          if (!v || v.archived) value[field] = null;
        }
      const t = (await writeRecord(
        c,
        userId,
        "tasks",
        "save",
        taskSchema.parse(value),
        null,
        true,
      )) as Task;
      await c.query(
        "insert into recurrence_occurrences(user_id,series_id,occurrence_date,task_id) values($1,$2,$3,$4) on conflict do nothing",
        [userId, s.id, occurrence, t.id],
      );
      created.push(t);
    } else if (!prior) missed++;
    await c.query(
      "update recurring_series set next_date=$1,skipped_count=skipped_count+$2,updated_at=now() where id=$3 and user_id=$4",
      [next, missed, s.id, userId],
    );
  }
  return created;
}
export async function recurrenceAction(
  c: QueryClient,
  userId: string,
  input: unknown,
) {
  const v = z
    .object({
      series_id: z.string().uuid(),
      operation: z.enum(["pause", "resume", "stop"]),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  const row = (
    await c.query(
      "select * from recurring_series where id=$1 and user_id=$2 for update",
      [v.series_id, userId],
    )
  ).rows[0];
  if (!row) throw Error("Series unavailable");
  if (v.operation === "resume" && row.stopped)
    throw Error("Stopped recurrence cannot be resumed. Create a new schedule.");
  return (
    await c.query(
      "update recurring_series set paused=$1,stopped=$2,updated_at=now() where id=$3 and user_id=$4 returning id,rule,next_date,paused,stopped,skipped_count",
      [
        v.operation === "pause",
        v.operation === "stop" || row.stopped,
        v.series_id,
        userId,
      ],
    )
  ).rows[0];
}
