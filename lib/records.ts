import { taskSchema, projectSchema, today, type Task } from "./model";
import { parseCapture } from "./capture";
import { z } from "zod";
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
  const { request_id, lines } = z
    .object({
      request_id: z.string().uuid(),
      lines: z.array(z.string().trim().min(1).max(1000)).min(1).max(200),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId + request_id,
  ]);
  const prior = await c.query(
    "select lines, records from capture_batches where user_id=$1 and request_id=$2",
    [userId, request_id],
  );
  if (prior.rows.length) {
    if (JSON.stringify(prior.rows[0].lines) !== JSON.stringify(lines))
      throw Error("Capture request already used");
    return prior.rows[0].records;
  }
  // Validate the entire payload before writing any record.
  const values = lines.map((line) =>
    taskSchema.parse(parseCapture(line, today(now))),
  );
  const records: Task[] = [];
  for (const value of values)
    records.push(
      (await writeRecord(c, userId, "tasks", "save", value, null)) as Task,
    );
  await c.query(
    "insert into capture_batches(user_id,request_id,lines,records) values($1,$2,$3::jsonb,$4::jsonb)",
    [userId, request_id, JSON.stringify(lines), JSON.stringify(records)],
  );
  return records;
}
