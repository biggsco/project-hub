import { hashPassword } from "better-auth/crypto";
import type { QueryClient } from "./records";
import { randomUUID } from "node:crypto";
export async function provision(
  c: QueryClient,
  email: string,
  name: string,
  password: string,
  reset = false,
) {
  if (password.length < 12 || password.length > 128)
    throw Error("Password must contain 12–128 characters");
  const normal = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  await c.query("select pg_advisory_xact_lock(917361)");
  if (reset) {
    const owner = await c.query(
      'select u.id from "user" u join authorised_users a on a.user_id=u.id where lower(u.email)=$1',
      [normal],
    );
    if (owner.rows.length !== 1) throw Error("Owner account not found");
    const updated = await c.query(
      'update account set password=$1,"updatedAt"=now() where "userId"=$2 and "providerId"=$3 returning id',
      [hash, owner.rows[0].id, "credential"],
    );
    if (updated.rows.length !== 1) throw Error("Password account not found");
    await c.query('delete from session where "userId"=$1', [owner.rows[0].id]);
    return owner.rows[0].id;
  }
  const existing = await c.query('select count(*)::int as count from "user"');
  if (existing.rows[0].count > 0)
    throw Error("An account already exists. Public registration is disabled.");
  const id = randomUUID();
  await c.query(
    'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
    [id, name, normal],
  );
  await c.query(
    'insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2::text,$3,$2::uuid,$4,now(),now())',
    [randomUUID(), id, "credential", hash],
  );
  await c.query("insert into authorised_users(user_id) values($1)", [id]);
  await c.query("insert into profiles(user_id,display_name) values($1,$2)", [
    id,
    name,
  ]);
  return id;
}
