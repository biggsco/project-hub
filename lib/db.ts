import { Pool, types, type PoolClient } from "pg";
types.setTypeParser(1082, (value) => value);
const globalDb = globalThis as unknown as { hubPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw Error("Database is not configured");
  if (!globalDb.hubPool)
    globalDb.hubPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl:
        process.env.DATABASE_SSL === "require"
          ? { rejectUnauthorized: true }
          : false,
    });
  return globalDb.hubPool;
}
// Identity is set transaction-locally; it cannot leak when the connection is reused.
export async function asUser<T>(
  userId: string,
  work: (c: PoolClient) => Promise<T>,
) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE hub_app");
    await c.query("select set_config('hub.user_id',$1,true)", [userId]);
    const result = await work(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
