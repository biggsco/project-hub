import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { getPool } from "./db";
import { authOptions } from "./auth-config";
let instance: ReturnType<typeof betterAuth> | undefined;
export function configured() {
  return !!(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_SECRET.length >= 32 &&
    process.env.OWNER_EMAIL
  );
}
export function getAuth() {
  return (instance ??= betterAuth(authOptions(getPool())));
}
export async function currentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (
    !session ||
    session.user.email.toLowerCase() !== process.env.OWNER_EMAIL?.toLowerCase()
  )
    return null;
  const allowed = await getPool().query(
    "select user_id from authorised_users where user_id=$1",
    [session.user.id],
  );
  return allowed.rowCount ? session.user : null;
}
