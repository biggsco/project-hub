import { z } from "zod";
import { teamSchema, personSchema } from "./people";
import type { QueryClient } from "./records";
export async function peopleRecords(c: QueryClient) {
  const teams = await c.query("select * from teams order by name_key");
  const people = await c.query(
    "select p.*,coalesce((select array_agg(j.team_id order by j.team_id) from person_teams j where j.person_id=p.id and j.user_id=p.user_id),'{}'::uuid[]) as team_ids from people p order by name_key",
  );
  return { teams: teams.rows, people: people.rows };
}
export async function saveContact(
  c: QueryClient,
  userId: string,
  input: unknown,
) {
  const b = z
    .object({
      action: z.enum(["team_save", "person_save"]),
      id: z.string().uuid().optional(),
      value: z.unknown(),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  if (b.action === "team_save") {
    const v = teamSchema.parse(b.value);
    const r = b.id
      ? await c.query(
          "update teams set name=$1,description=$2,aliases=$3,archived=$4 where id=$5 and user_id=$6 returning *",
          [v.name, v.description, v.aliases, v.archived, b.id, userId],
        )
      : await c.query(
          "insert into teams(user_id,name,description,aliases,archived) values($1,$2,$3,$4,$5) returning *",
          [userId, v.name, v.description, v.aliases, v.archived],
        );
    if (r.rows.length !== 1) throw Error("Team unavailable");
    return r.rows[0];
  }
  const v = personSchema.parse(b.value);
  for (const id of v.team_ids) {
    const t = (
      await c.query("select archived from teams where id=$1 and user_id=$2", [
        id,
        userId,
      ])
    ).rows[0];
    const old = b.id
      ? (
          await c.query(
            "select 1 from person_teams where person_id=$1 and team_id=$2 and user_id=$3",
            [b.id, id, userId],
          )
        ).rows.length
      : 0;
    if (!t || (t.archived && !old)) throw Error("Team unavailable");
  }
  const r = b.id
    ? await c.query(
        "update people set name=$1,notes=$2,archived=$3 where id=$4 and user_id=$5 returning *",
        [v.name, v.notes, v.archived, b.id, userId],
      )
    : await c.query(
        "insert into people(user_id,name,notes,archived) values($1,$2,$3,$4) returning *",
        [userId, v.name, v.notes, v.archived],
      );
  if (r.rows.length !== 1) throw Error("Person unavailable");
  const record = r.rows[0];
  await c.query("delete from person_teams where person_id=$1 and user_id=$2", [
    record.id,
    userId,
  ]);
  for (const team of new Set(v.team_ids))
    await c.query(
      "insert into person_teams(user_id,person_id,team_id) values($1,$2,$3)",
      [userId, record.id, team],
    );
  // Renaming a person updates active assignment labels without changing completion/status.
  if (b.id)
    await c.query(
      "update tasks set assigned_to=$1 where assigned_person_id=$2 and user_id=$3 and assigned_to<>''",
      [record.name, record.id, userId],
    );
  return { ...record, team_ids: v.team_ids };
}
export async function recordVisit(c: QueryClient, userId: string) {
  const prior = (
    await c.query(
      "select last_opened_at from profiles where user_id=$1 for update",
      [userId],
    )
  ).rows[0];
  await c.query("update profiles set last_opened_at=now() where user_id=$1", [
    userId,
  ]);
  return { previous: prior?.last_opened_at || null };
}
