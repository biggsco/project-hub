import { today } from "./model";
import { randomUUID } from "node:crypto";
import { asUser, getPool } from "./db";
import { advanceRecurring } from "./recurrence-records";
import { loadRecords } from "./records";
import { notificationSchema } from "./notification-model";
import {
  scheduledNotifications,
  notificationPayload,
  decryptWebhook,
} from "./notifications";
export async function enqueueForUser(
  c: any,
  userId: string,
  baseUrl: string,
  now = new Date(),
) {
  await advanceRecurring(c, userId, today(now));
  const settings = (
    await c.query("select * from notification_settings where user_id=$1", [
      userId,
    ])
  ).rows[0];
  let queued = 0;
  if (settings?.webhook_cipher) {
    const data = await loadRecords(c);
    for (const n of scheduledNotifications(
      notificationSchema.parse(settings),
      data.tasks as any,
      now,
    )) {
      const id = randomUUID();
      const r = await c.query(
        "insert into notification_deliveries(id,user_id,notification_key,kind,payload) values($1,$2,$3,$4,$5::jsonb) on conflict(user_id,notification_key) do nothing returning id",
        [
          id,
          userId,
          n.key,
          n.kind,
          JSON.stringify(
            notificationPayload(id, n.kind, n.tasks, baseUrl, settings.privacy),
          ),
        ],
      );
      queued += r.rows.length;
    }
  }
  await c.query(
    "insert into automation_runs(user_id,last_run_at) values($1,$2) on conflict(user_id) do update set last_run_at=excluded.last_run_at",
    [userId, now.toISOString()],
  );
  // A crash after claiming could have sent the message: never blindly re-send it.
  await c.query(
    "update notification_deliveries set status='unknown',error_code='interrupted_delivery',payload='{}'::jsonb where user_id=$1 and status='sending' and claimed_at<now()-interval '5 minutes'",
    [userId],
  );
  // Minimise retained private payloads after delivery or terminal failure.
  await c.query(
    "update notification_deliveries set payload='{}'::jsonb where user_id=$1 and status in('delivered','failed','unknown','cancelled')",
    [userId],
  );
  return queued;
}
export async function claimDelivery(
  c: any,
  userId: string,
  onlyId: string | null = null,
) {
  const r = await c.query(
    "select d.*,s.webhook_cipher,s.enabled,s.tenant_confirmed from notification_deliveries d join notification_settings s on s.user_id=d.user_id where d.user_id=$1 and ($2::uuid is null or d.id=$2) and d.status='pending' and d.attempts<3 and d.next_attempt_at<=now() and s.tenant_confirmed and s.webhook_cipher is not null and (s.enabled or d.kind='test') order by d.created_at limit 1 for update of d skip locked",
    [userId, onlyId],
  );
  if (!r.rows[0]) return null;
  await c.query(
    "update notification_deliveries set status='sending',attempts=attempts+1,claimed_at=now() where id=$1 and user_id=$2",
    [r.rows[0].id, userId],
  );
  return { ...r.rows[0], attempts: r.rows[0].attempts + 1 };
}
export async function postWebhook(
  url: string,
  payload: any,
  transport: typeof fetch = fetch,
) {
  try {
    const r = await transport(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return { status: "delivered", error: null, retry: false };
    if (r.status === 429)
      return { status: "pending", error: "rate_limited", retry: true };
    if (r.status === 401 || r.status === 403)
      return {
        status: "failed",
        error: "authentication_or_expired_url",
        retry: false,
      };
    if (r.status === 404 || r.status === 410)
      return { status: "failed", error: "webhook_not_found", retry: false };
    return {
      status: r.status >= 500 ? "unknown" : "failed",
      error: r.status >= 500 ? "ambiguous_server_error" : "payload_rejected",
      retry: false,
    };
  } catch {
    return { status: "unknown", error: "delivery_unconfirmed", retry: false };
  }
}
export async function deliverUser(
  userId: string,
  secret: string,
  limit = 5,
  onlyId: string | null = null,
) {
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    const job = await asUser(userId, (c) => claimDelivery(c, userId, onlyId));
    if (!job) break;
    let result;
    try {
      result = await postWebhook(
        decryptWebhook(job.webhook_cipher, secret),
        job.payload,
      );
    } catch {
      result = {
        status: "failed",
        error: "encryption_or_url_invalid",
        retry: false,
      };
    }
    const status = result.retry && job.attempts >= 3 ? "failed" : result.status;
    await asUser(userId, (c) =>
      c.query(
        "update notification_deliveries set status=$1,error_code=$2,delivered_at=case when $1='delivered' then now() else null end,next_attempt_at=now()+interval '15 minutes',payload=case when $1='pending' then payload else '{}'::jsonb end where id=$3 and user_id=$4 and status='sending'",
        [status, result.error, job.id, userId],
      ),
    );
    if (status === "delivered") sent++;
  }
  return sent;
}
export async function runJobs() {
  const base = process.env.BETTER_AUTH_URL;
  if (!base) throw Error("Application URL is not configured");
  const owners = (await getPool().query("select user_id from authorised_users"))
    .rows;
  let processed = 0;
  for (const { user_id } of owners) {
    await asUser(user_id, (c) => enqueueForUser(c, user_id, base));
    await deliverUser(user_id, process.env.BETTER_AUTH_SECRET || "");
    processed++;
  }
  return { processed };
}
