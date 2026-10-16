import { peopleRecords } from "./people-records";
import { z } from "zod";
import { bucketSchema, cleanName } from "./organisation";
import type { QueryClient } from "./records";
export async function organisationRecords(c: QueryClient) {
  const buckets = await c.query("select * from buckets order by position,name");
  const tags = await c.query("select id,name from tags order by name_key");
  return {
    buckets: buckets.rows,
    tags: tags.rows,
    ...(await peopleRecords(c)),
  };
}
export async function organise(c: QueryClient, userId: string, input: unknown) {
  const b = z
    .object({
      action: z.enum(["bucket_save", "bucket_reorder", "tag_save"]),
      id: z.string().uuid().optional(),
      value: z.unknown().optional(),
      ids: z.array(z.string().uuid()).max(1000).optional(),
      merge_to: z.string().uuid().optional(),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  if (b.action === "bucket_reorder") {
    const existing = (
      await c.query(
        "select id from buckets where user_id=$1 and not archived",
        [userId],
      )
    ).rows.map((r) => r.id);
    if (
      !b.ids ||
      b.ids.length !== existing.length ||
      new Set(b.ids).size !== existing.length ||
      b.ids.some((id) => !existing.includes(id))
    )
      throw Error("Refresh buckets before reordering");
    for (const [position, id] of b.ids.entries())
      await c.query(
        "update buckets set position=$1,updated_at=now() where id=$2 and user_id=$3",
        [position, id, userId],
      );
    return null;
  }
  if (b.action === "bucket_save") {
    const v = bucketSchema.parse(b.value);
    const rows = b.id
      ? await c.query(
          "update buckets set name=$1,description=$2,aliases=$3,position=$4,archived=$5,updated_at=now() where id=$6 and user_id=$7 returning *",
          [
            v.name,
            v.description,
            v.aliases,
            v.position,
            v.archived,
            b.id,
            userId,
          ],
        )
      : await c.query(
          "insert into buckets(user_id,name,description,aliases,position,archived) values($1,$2,$3,$4,(select coalesce(max(position),-1)+1 from buckets where user_id=$1),$5) returning *",
          [userId, v.name, v.description, v.aliases, v.archived],
        );
    if (rows.rows.length !== 1) throw Error("Bucket unavailable");
    return rows.rows[0];
  }
  if (!b.id) {
    const { name } = z
      .object({
        name: z.string().transform(cleanName).pipe(z.string().min(1).max(60)),
      })
      .parse(b.value);
    return (
      await c.query(
        "insert into tags(user_id,name) values($1,$2) on conflict(user_id,name_key) do update set name=tags.name returning id,name",
        [userId, name],
      )
    ).rows[0];
  }
  const source = (
    await c.query("select id from tags where id=$1 and user_id=$2", [
      b.id,
      userId,
    ])
  ).rows[0];
  if (!source) throw Error("Tag unavailable");
  // Snapshot affected records before modifying associations; refresh their compatibility arrays afterwards.
  const tasks = (
    await c.query(
      "select task_id as id from task_tags where tag_id=$1 and user_id=$2",
      [b.id, userId],
    )
  ).rows;
  const projects = (
    await c.query(
      "select project_id as id from project_tags where tag_id=$1 and user_id=$2",
      [b.id, userId],
    )
  ).rows;
  let record;
  if (b.merge_to) {
    if (b.merge_to === b.id) throw Error("Choose a different tag");
    record = (
      await c.query("select id,name from tags where id=$1 and user_id=$2", [
        b.merge_to,
        userId,
      ])
    ).rows[0];
    if (!record) throw Error("Tag unavailable");
    await c.query(
      "insert into task_tags(user_id,task_id,tag_id) select user_id,task_id,$1 from task_tags where tag_id=$2 and user_id=$3 on conflict do nothing",
      [b.merge_to, b.id, userId],
    );
    await c.query(
      "insert into project_tags(user_id,project_id,tag_id) select user_id,project_id,$1 from project_tags where tag_id=$2 and user_id=$3 on conflict do nothing",
      [b.merge_to, b.id, userId],
    );
    await c.query("delete from task_tags where tag_id=$1 and user_id=$2", [
      b.id,
      userId,
    ]);
    await c.query("delete from project_tags where tag_id=$1 and user_id=$2", [
      b.id,
      userId,
    ]);
    await c.query("delete from tags where id=$1 and user_id=$2", [
      b.id,
      userId,
    ]);
  } else {
    const { name } = z
      .object({
        name: z.string().transform(cleanName).pipe(z.string().min(1).max(60)),
      })
      .parse(b.value);
    record = (
      await c.query(
        "update tags set name=$1 where id=$2 and user_id=$3 returning id,name",
        [name, b.id, userId],
      )
    ).rows[0];
  }
  for (const row of tasks)
    await c.query(
      "update tasks set tags=array(select t.name from task_tags j join tags t on t.id=j.tag_id and t.user_id=j.user_id where j.task_id=$1 and j.user_id=$2 order by t.name_key) where id=$1 and user_id=$2",
      [row.id, userId],
    );
  for (const row of projects)
    await c.query(
      "update projects set tags=array(select t.name from project_tags j join tags t on t.id=j.tag_id and t.user_id=j.user_id where j.project_id=$1 and j.user_id=$2 order by t.name_key) where id=$1 and user_id=$2",
      [row.id, userId],
    );
  return record;
}

/** Only patch membership, so a bulk move cannot overwrite newer task edits. Called in asUser. */
export async function assignTaskBuckets(
  c: QueryClient,
  userId: string,
  input: unknown,
) {
  const value = z
    .object({
      ids: z.array(z.string().uuid()).min(1).max(1000),
      bucket_id: z.string().uuid().nullable(),
    })
    .parse(input);
  const ids = [...new Set(value.ids)];
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  const tasks = await c.query(
    "select id from tasks where id=any($1::uuid[]) and user_id=$2 for update",
    [ids, userId],
  );
  if (tasks.rows.length !== ids.length)
    throw Error(
      "Some selected tasks are unavailable. Refresh and select them again.",
    );
  if (value.bucket_id) {
    const bucket = (
      await c.query(
        "select id from buckets where id=$1 and user_id=$2 and not archived for share",
        [value.bucket_id, userId],
      )
    ).rows[0];
    if (!bucket) throw Error("Bucket unavailable. Choose an active bucket.");
  }
  await c.query(
    "update tasks set bucket_id=$1 where id=any($2::uuid[]) and user_id=$3 and bucket_id is distinct from $1",
    [value.bucket_id, ids, userId],
  );
  return { ids, bucket_id: value.bucket_id };
}
