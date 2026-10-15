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
  const activity = await c.query(
    "select * from activity order by created_at desc limit 100",
  );
  return {
    tasks: tasks.rows.map(normalise),
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
) {
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  let result;
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
    const entries = Object.entries(parsed);
    const fields = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
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
  return normalise(result.rows[0]);
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
      parseTaskInput(line, library.buckets, library.tags, today(now), defaults),
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
