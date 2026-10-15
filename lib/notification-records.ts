import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { QueryClient } from "./records";
import { notificationSchema } from "./notification-model";
import { encryptWebhook, notificationPayload } from "./notifications";
export async function notificationSettings(c: QueryClient, userId: string) {
  const row = (
    await c.query(
      "select enabled,daily,weekly,important,send_time,privacy,tenant_confirmed,(webhook_cipher is not null) as configured from notification_settings where user_id=$1",
      [userId],
    )
  ).rows[0];
  const deliveries = (
    await c.query(
      "select id,kind,status,attempts,delivered_at,error_code,created_at from notification_deliveries where user_id=$1 order by created_at desc limit 30",
      [userId],
    )
  ).rows;
  const run = (
    await c.query("select last_run_at from automation_runs where user_id=$1", [
      userId,
    ])
  ).rows[0];
  return {
    settings: row || { ...notificationSchema.parse({}), configured: false },
    deliveries,
    last_run_at: run?.last_run_at || null,
  };
}
export async function saveNotificationSettings(
  c: QueryClient,
  userId: string,
  input: unknown,
  secret: string,
) {
  const b = z
    .object({
      value: notificationSchema,
      webhook_url: z.string().max(4000).optional(),
      remove_webhook: z.boolean().optional(),
    })
    .parse(input);
  await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    userId,
  ]);
  const old = (
    await c.query(
      "select webhook_cipher from notification_settings where user_id=$1",
      [userId],
    )
  ).rows[0];
  const cipher = b.remove_webhook
    ? null
    : b.webhook_url
      ? encryptWebhook(b.webhook_url, secret)
      : old?.webhook_cipher || null;
  if (b.value.enabled && (!cipher || !b.value.tenant_confirmed))
    throw Error(
      "Confirm tenant access and configure a Teams webhook before enabling notifications.",
    );
  const v = b.value;
  await c.query(
    "insert into notification_settings(user_id,webhook_cipher,enabled,daily,weekly,important,send_time,privacy,tenant_confirmed) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id) do update set webhook_cipher=excluded.webhook_cipher,enabled=excluded.enabled,daily=excluded.daily,weekly=excluded.weekly,important=excluded.important,send_time=excluded.send_time,privacy=excluded.privacy,tenant_confirmed=excluded.tenant_confirmed,updated_at=now()",
    [
      userId,
      cipher,
      v.enabled,
      v.daily,
      v.weekly,
      v.important,
      v.send_time,
      v.privacy,
      v.tenant_confirmed,
    ],
  );
  if (!v.enabled || b.remove_webhook || b.webhook_url)
    await c.query(
      "update notification_deliveries set status='cancelled',payload='{}'::jsonb,error_code='settings_changed' where user_id=$1 and status='pending'",
      [userId],
    );
  return notificationSettings(c, userId);
}
export async function queueTest(
  c: QueryClient,
  userId: string,
  baseUrl: string,
) {
  const s = (
    await c.query(
      "select webhook_cipher,tenant_confirmed from notification_settings where user_id=$1",
      [userId],
    )
  ).rows[0];
  if (!s?.webhook_cipher || !s.tenant_confirmed)
    throw Error("Save the webhook and confirm tenant access before testing.");
  const recent = (
    await c.query(
      "select id from notification_deliveries where user_id=$1 and kind='test' and created_at>now()-interval '1 minute'",
      [userId],
    )
  ).rows[0];
  if (recent) return recent.id;
  const id = randomUUID();
  await c.query(
    "insert into notification_deliveries(id,user_id,notification_key,kind,payload) values($1,$2,$3,'test',$4::jsonb)",
    [
      id,
      userId,
      "test:" + id,
      JSON.stringify(notificationPayload(id, "test", [], baseUrl)),
    ],
  );
  return id;
}
