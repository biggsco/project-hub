import { z } from "zod";
import { type QueryClient, writeRecord } from "./records";
import { taskSchema, today, type Task } from "./model";
import { referenceSchema, stepKey } from "./workbench";
export async function workbenchAction(
  c: QueryClient,
  userId: string,
  input: unknown,
) {
  const base = z
    .object({
      action: z.enum([
        "progress_add",
        "reference_save",
        "reference_delete",
        "steps_import",
        "subtasks_reorder",
        "followed_up",
      ]),
      task_id: z.string().uuid(),
    })
    .passthrough()
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  const task = (
    await c.query("select * from tasks where id=$1 and user_id=$2 for update", [
      base.task_id,
      userId,
    ])
  ).rows[0];
  if (!task) throw Error("Task unavailable");
  if (base.action === "progress_add" || base.action === "followed_up") {
    const v = z
      .object({
        text: z.string().trim().max(4000).default(""),
        kind: z.enum(["progress", "discussion"]).default("progress"),
        follow_up_date: taskSchema.shape.follow_up_date.optional(),
        request_id: z.string().uuid(),
      })
      .parse(base);
    if (base.action === "progress_add" && !v.text)
      throw Error("Enter a progress note");
    const entries = task.progress_entries as any[];
    const prior = entries.find((n) => n.id === v.request_id);
    if (prior) {
      if (
        prior.text !== (v.text || "Followed up") ||
        prior.kind !== (base.action === "followed_up" ? "follow_up" : v.kind)
      )
        throw Error("Request already used");
      return { record: task };
    }
    if (entries.length >= 500)
      throw Error("This task has reached 500 progress entries.");
    entries.push({
      id: v.request_id,
      text: v.text || "Followed up",
      kind: base.action === "followed_up" ? "follow_up" : v.kind,
      created_at: new Date().toISOString(),
    });
    // An explicit followed-up action clears or reschedules only the follow-up date.
    const r = await c.query(
      base.action === "followed_up"
        ? "update tasks set progress_entries=$1::jsonb,follow_up_date=$2 where id=$3 and user_id=$4 returning *"
        : "update tasks set progress_entries=$1::jsonb where id=$2 and user_id=$3 returning *",
      base.action === "followed_up"
        ? [JSON.stringify(entries), v.follow_up_date || null, task.id, userId]
        : [JSON.stringify(entries), task.id, userId],
    );
    return { record: r.rows[0] };
  }
  if (base.action === "reference_save" || base.action === "reference_delete") {
    const id = z.string().uuid().parse(base.reference_id);
    const links = (task.reference_links as any[]).filter((l) => l.id !== id);
    if (base.action === "reference_save") {
      const old = (task.reference_links as any[]).find((l) => l.id === id);
      links.push(
        referenceSchema.parse({
          id,
          title: base.title,
          url: base.url,
          created_at: old?.created_at || new Date().toISOString(),
        }),
      );
    }
    if (links.length > 100)
      throw Error("A task can have up to 100 references.");
    return {
      record: (
        await c.query(
          "update tasks set reference_links=$1::jsonb where id=$2 and user_id=$3 returning *",
          [JSON.stringify(links), task.id, userId],
        )
      ).rows[0],
    };
  }
  if (base.action === "subtasks_reorder") {
    const ids = z.array(z.string().uuid()).max(1000).parse(base.ids);
    const rows = (
      await c.query(
        "select id from tasks where parent_id=$1 and user_id=$2 and not archived",
        [task.id, userId],
      )
    ).rows;
    if (
      new Set(ids).size !== ids.length ||
      rows.length !== ids.length ||
      rows.some((r) => !ids.includes(r.id))
    )
      throw Error("Subtasks changed. Refresh before reordering.");
    for (const [i, id] of ids.entries())
      await c.query(
        "update tasks set subtask_position=$1 where id=$2 and user_id=$3",
        [i, id, userId],
      );
    return {
      records: (
        await c.query(
          "select * from tasks where parent_id=$1 and user_id=$2 order by subtask_position",
          [task.id, userId],
        )
      ).rows,
    };
  }
  const v = z
    .object({
      request_id: z.string().uuid(),
      titles: z.array(z.string().trim().min(1).max(255)).min(1).max(100),
    })
    .parse(base);
  const prior = (
    await c.query(
      "select * from step_imports where request_id=$1 and user_id=$2",
      [v.request_id, userId],
    )
  ).rows[0];
  if (prior) {
    if (
      prior.parent_id !== task.id ||
      JSON.stringify(prior.titles) !== JSON.stringify(v.titles)
    )
      throw Error("Import request already used");
    return {
      records: (
        await c.query(
          "select * from tasks where id=any($1::uuid[]) and user_id=$2",
          [prior.task_ids, userId],
        )
      ).rows,
      skipped: 0,
    };
  }
  const existing = (
    await c.query(
      "select * from tasks where parent_id=$1 and user_id=$2 order by subtask_position",
      [task.id, userId],
    )
  ).rows as Task[];
  const known = new Set(existing.map((t) => stepKey(t.title))),
    created: Task[] = [];
  let position = Math.max(-1, ...existing.map((t) => t.subtask_position)) + 1;
  for (const title of v.titles) {
    if (known.has(stepKey(title))) continue;
    known.add(stepKey(title));
    created.push(
      (await writeRecord(
        c,
        userId,
        "tasks",
        "save",
        {
          title,
          parent_id: task.id,
          status: "To Do",
          project_id: task.project_id,
          bucket_id: task.bucket_id,
          team_id: task.team_id,
          person_id: task.person_id,
          classification: task.classification,
          subtask_position: position++,
        },
        null,
      )) as Task,
    );
  }
  await c.query(
    "insert into step_imports(user_id,request_id,parent_id,titles,task_ids) values($1,$2,$3,$4::jsonb,$5)",
    [
      userId,
      v.request_id,
      task.id,
      JSON.stringify(v.titles),
      created.map((t) => t.id),
    ],
  );
  return { records: created, skipped: v.titles.length - created.length };
}
