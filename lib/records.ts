import { taskSchema, projectSchema } from "./model";
function normalise(row: Record<string, any>) {
  for (const k of ["start_date", "due_date", "target_date", "actual_date"])
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
