import { getMigrations } from "better-auth/db/migration";
import { getPool } from "../lib/db";
import { authOptions } from "../lib/auth-config";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const pool = getPool();
const c = await pool.connect();
try {
  await c.query("select pg_advisory_lock(48151623)");
  const authPlan = await getMigrations(authOptions(pool));
  await authPlan.runMigrations();
  await c.query(
    "create table if not exists hub_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
  );
  for (const name of (await readdir("db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile("db/migrations/" + name, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await c.query(
      "select checksum from hub_migrations where name=$1",
      [name],
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw Error("Migration changed after it was applied: " + name);
      continue;
    }
    await c.query("BEGIN");
    await c.query(sql.replace(/^begin;/i, "").replace(/commit;\s*$/i, ""));
    await c.query("insert into hub_migrations(name,checksum) values($1,$2)", [
      name,
      checksum,
    ]);
    await c.query("COMMIT");
    console.log("Applied " + name);
  }
  console.log("Database migrations complete.");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error(
    "Migration failed. Check database access and the migration files.",
  );
  console.error(e instanceof Error ? e.message : "Unknown migration error");
  process.exitCode = 1;
} finally {
  await c.query("select pg_advisory_unlock(48151623)").catch(() => {});
  c.release();
  await pool.end();
}
