import { syncSeries } from "./recurrence-records";
import {
  taskSchema,
  projectSchema,
  today,
  type Task,
  captureDefaultsSchema,
} from "./model";
import { parseTaskInput } from "./capture";
import { z } from "zod";
import { organisationRecords } from "./organisation-records";
function normalise(row: Record<string, any>) {
  for (const k of [
    "start_date",
    "due_date",
    "target_date",
    "actual_date",
    "date_assigned",
    "follow_up_date",
    "snoozed_until",
    "focus_dismissed_until",
    "suggested_start",
    "suggested_end",
    "planned_for",
    "reminder_on",
    "recurrence_date",
  ])
    if (row[k] instanceof Date) row[k] = row[k].toISOString().slice(0, 10);
  return row;
}
export type QueryClient = {
  query: (
    text: string,
    values?: any[],
  ) => Promise<{ rows: any[]; rowCount?: number | null }>;
};
export async function loadRecords(c: QueryClient) {
  const tasks = await c.query("select * from tasks order by created_at desc");
  const projects = await c.query(
    "select * from projects order by created_at desc",
  );
  const series = await c.query(
    "select id,rule,next_date,paused,stopped,skipped_count from recurring_series order by created_at desc",
  );
  const activity = await c.query(
    "select * from activity order by created_at desc limit 100",
  );
  return {
    tasks: tasks.rows.map(normalise),
    series: series.rows.map((row) => {
      if (row.next_date instanceof Date)
        row.next_date = row.next_date.toISOString().slice(0, 10);
      return row;
    }),
    projects: projects.rows.map(normalise),
    activity: activity.rows,
    ...(await organisationRecords(c)),
  };
}
export async function writeRecord(
  c: QueryClient,
  userId: string,
  table: "tasks" | "projects",
  action: "save" | "delete",
  value: unknown,
  id: string | null,
  generated = false,
) {
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  let result;
  let previous: Task | undefined;
  if (table === "tasks" && id)
    previous = (
      await c.query("select * from tasks where id=$1 and user_id=$2", [
        id,
        userId,
      ])
    ).rows[0];
  if (action === "delete") {
    if (!id) throw Error("Missing record");
    result = await c.query(
      `delete from ${table} where id=$1 and user_id=$2 returning id`,
      [id, userId],
    );
  } else {
    const parsed = (table === "tasks" ? taskSchema : projectSchema).parse(
      value,
    );
    if (table === "tasks" && "recurrence_rule" in parsed) {
      if (!generated) {
        parsed.recurrence_series_id = previous?.recurrence_series_id || null;
        parsed.recurrence_date = previous?.recurrence_date
          ? normalise({ ...previous }).recurrence_date
          : null;
      }
      if (
        parsed.suggested_start &&
        parsed.suggested_end &&
        parsed.suggested_end < parsed.suggested_start
      )
        throw Error("Invalid suggested window");
      if (parsed.depends_on_id) {
        const ancestors = (
          await c.query(
            "with recursive chain as (select id,depends_on_id from tasks where id=$1 and user_id=$2 union select t.id,t.depends_on_id from tasks t join chain a on t.id=a.depends_on_id where t.user_id=$2) select id from chain",
            [parsed.depends_on_id, userId],
          )
        ).rows;
        if (!ancestors.length || ancestors.some((a) => a.id === id))
          throw Error("Invalid task dependency");
      }
    }
    if (table === "tasks" && "bucket_id" in parsed && parsed.bucket_id) {
      const bucket = (
        await c.query(
          "select archived from buckets where id=$1 and user_id=$2",
          [parsed.bucket_id, userId],
        )
      ).rows[0];
      const previous = id
        ? (
            await c.query(
              "select bucket_id from tasks where id=$1 and user_id=$2",
              [id, userId],
            )
          ).rows[0]
        : null;
      if (
        !bucket ||
        (bucket.archived && previous?.bucket_id !== parsed.bucket_id)
      )
        throw Error("Bucket unavailable");
    }
    if (table === "tasks" && "task_type" in parsed) {
      const previous = id
        ? (
            await c.query("select * from tasks where id=$1 and user_id=$2", [
              id,
              userId,
            ])
          ).rows[0]
        : null;
      for (const [field, tableName] of [
        ["team_id", "teams"],
        ["person_id", "people"],
      ] as const) {
        const selected = parsed[field];
        if (!selected) continue;
        const contact = (
          await c.query(
            `select * from ${tableName} where id=$1 and user_id=$2`,
            [selected, userId],
          )
        ).rows[0];
        if (!contact || (contact.archived && previous?.[field] !== selected))
          throw Error("Contact unavailable");
      }
      if (
        parsed.task_type === "Delegated" &&
        !parsed.assigned_to &&
        parsed.person_id
      ) {
        parsed.assigned_to = (
          await c.query("select name from people where id=$1 and user_id=$2", [
            parsed.person_id,
            userId,
          ])
        ).rows[0].name;
      }
      if (parsed.assigned_to) {
        const name = parsed.assigned_to.trim().replace(/\s+/g, " ");
        const contact = (
          await c.query(
            "select * from people where user_id=$1 and name_key=lower($2)",
            [userId, name],
          )
        ).rows[0];
        if (contact?.archived && previous?.assigned_person_id !== contact.id)
          throw Error("Contact unavailable");
        const person =
          contact ||
          (
            await c.query(
              "insert into people(user_id,name) values($1,$2) returning *",
              [userId, name],
            )
          ).rows[0];
        parsed.assigned_person_id = person.id;
        if (!parsed.person_id) parsed.person_id = person.id;
        parsed.assigned_to = person.name;
        parsed.task_type = "Delegated";
      }
      if (!parsed.assigned_to) parsed.assigned_person_id = null;
      if (parsed.task_type === "Delegated" && !parsed.date_assigned)
        parsed.date_assigned = today();
    }
    if (table === "tasks" && "progress_entries" in parsed) {
      const prior = id
        ? (
            await c.query(
              "select progress_entries,reference_links from tasks where id=$1 and user_id=$2",
              [id, userId],
            )
          ).rows[0]
        : null;
      // Append/edit these through dedicated owner-locked actions, never a stale detail form.
      parsed.progress_entries = prior?.progress_entries || [];
      parsed.reference_links = prior?.reference_links || [];
    }
    const entries = Object.entries(parsed);
    const fields = entries.map(([k]) => k);
    const values = entries.map(([k, v]) =>
      ["progress_entries", "reference_links", "recurrence_rule"].includes(k)
        ? JSON.stringify(v)
        : v,
    );
    if (id) {
      result = await c.query(
        `update ${table} set ${fields.map((k, i) => k + "=$" + (i + 1)).join(",")} where id=$${values.length + 1} and user_id=$${values.length + 2} returning *`,
        [...values, id, userId],
      );
    } else {
      result = await c.query(
        `insert into ${table} (${fields.join(",")},user_id) values (${values.map((_, i) => "$" + (i + 1)).join(",")},$${values.length + 1}) returning *`,
        [...values, userId],
      );
    }
  }
  if (result.rows.length !== 1)
    throw Error("Record not found or access denied");
  const row = normalise(result.rows[0]);
  return table === "tasks" && action === "save" && !generated
    ? await syncSeries(c, userId, row as Task, previous)
    : row;
}

// Called inside asUser: the whole batch and its retry receipt commit atomically.
export async function captureTasks(
  c: QueryClient,
  userId: string,
  input: unknown,
  now = new Date(),
): Promise<Task[]> {
  const { request_id, lines, defaults } = z
    .object({
      request_id: z.string().uuid(),
      lines: z.array(z.string().trim().min(1).max(1000)).min(1).max(200),
      defaults: captureDefaultsSchema.default({}),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId + request_id,
  ]);
  const prior = await c.query(
    "select lines, records, defaults from capture_batches where user_id=$1 and request_id=$2",
    [userId, request_id],
  );
  if (prior.rows.length) {
    if (
      JSON.stringify(prior.rows[0].lines) !== JSON.stringify(lines) ||
      JSON.stringify(captureDefaultsSchema.parse(prior.rows[0].defaults)) !==
        JSON.stringify(defaults)
    )
      throw Error("Capture request already used");
    // A retry must not resurrect deleted tasks or overwrite later edits with the receipt snapshot.
    const ids = (prior.rows[0].records as Task[]).map((t) => t.id);
    const current = await c.query(
      "select * from tasks where id=any($1::uuid[]) and user_id=$2",
      [ids, userId],
    );
    return ids
      .map((id) => current.rows.find((t) => t.id === id))
      .filter(Boolean)
      .map(normalise) as Task[];
  }
  // Validate the entire payload before writing any record.
  const library = await organisationRecords(c);
  const values = lines.map((line) =>
    taskSchema.parse(
      parseTaskInput(
        line,
        library.buckets,
        library.tags,
        today(now),
        defaults,
        library,
      ),
    ),
  );
  const records: Task[] = [];
  for (const value of values)
    records.push(
      (await writeRecord(c, userId, "tasks", "save", value, null)) as Task,
    );
  await c.query(
    "insert into capture_batches(user_id,request_id,lines,records,defaults) values($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)",
    [
      userId,
      request_id,
      JSON.stringify(lines),
      JSON.stringify(records),
      JSON.stringify(defaults),
    ],
  );
  return records;
}
