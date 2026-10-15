import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { today, addDays, type Task } from "./model";
import { needsAttention, openTask } from "./productivity";
import type { NotificationSettings } from "./notification-model";
export function validateWebhook(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Error("Use a valid Teams Workflow HTTPS URL.");
  }
  const allowed =
    u.hostname.endsWith(".logic.azure.com") ||
    u.hostname.endsWith(".environment.api.powerplatform.com");
  if (
    u.protocol !== "https:" ||
    !allowed ||
    (u.port && u.port !== "443") ||
    u.username ||
    u.password ||
    u.hash ||
    !u.pathname.includes("/workflows/") ||
    !u.searchParams.get("sig")
  )
    throw Error(
      "Use an anonymous Teams Workflow URL from Microsoft (including its signature).",
    );
  return u.toString();
}
function key(secret: string) {
  if (!secret || secret.length < 32)
    throw Error("Server encryption is not configured.");
  return createHash("sha256")
    .update("project-hub-notifications-v1:" + secret)
    .digest();
}
export function encryptWebhook(url: string, secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(validateWebhook(url), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}
export function decryptWebhook(value: string, secret: string) {
  const data = Buffer.from(value, "base64"),
    cipher = createDecipheriv("aes-256-gcm", key(secret), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return validateWebhook(
    Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
export function adelaideClock(now = new Date()) {
  return {
    day: today(now),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Australia/Adelaide",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now),
    weekday: new Date(today(now) + "T12:00:00Z").getUTCDay(),
  };
}
const escape = (s: string) => s.replace(/[\\`*_\[\]<>]/g, "\\$&");
export function notificationPayload(
  id: string,
  kind: string,
  tasks: Task[],
  baseUrl: string,
  privacy = true,
  day = today(),
) {
  const open = tasks.filter(
    (t) => openTask(t) && (!t.snoozed_until || t.snoozed_until <= day),
  );
  const seen = new Set<string>();
  const groups: { name: string; rows: Task[] }[] = [];
  const add = (name: string, rows: Task[]) => {
    const selected = rows
      .filter((t) => !seen.has(t.id))
      .slice(0, Math.min(3, 8 - seen.size));
    selected.forEach((t) => seen.add(t.id));
    if (selected.length) groups.push({ name, rows: selected });
  };
  if (kind === "weekly") {
    add(
      "Upcoming deadlines",
      open.filter(
        (t) => t.due_date && t.due_date >= day && t.due_date <= addDays(day, 7),
      ),
    );
    add(
      "Follow-ups",
      open.filter(
        (t) => t.follow_up_date && t.follow_up_date <= addDays(day, 7),
      ),
    );
    add(
      "Recurring",
      open.filter(
        (t) =>
          t.recurrence_series_id && t.due_date && t.due_date <= addDays(day, 7),
      ),
    );
    add("Suggested priorities", needsAttention(open, day, 2));
  } else if (kind === "reminder") {
    add("Important reminder", open.slice(0, 1));
  } else {
    add(
      "Recurring",
      open.filter((t) => t.recurrence_series_id && t.due_date === day),
    );
    add(
      "Due today",
      open.filter((t) => t.due_date === day),
    );
    add(
      "Follow-ups",
      open.filter((t) => t.follow_up_date && t.follow_up_date <= day),
    );
    add("Important", needsAttention(open, day, 2));
  }
  const body: any[] = [
    {
      type: "TextBlock",
      text:
        kind === "test"
          ? "Project Hub — connection test"
          : kind === "weekly"
            ? "Project Hub — this week"
            : "Project Hub — today",
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
  ];
  for (const group of groups) {
    body.push({
      type: "TextBlock",
      text: group.name,
      weight: "Bolder",
      wrap: true,
    });
    for (const t of group.rows) {
      body.push({
        type: "TextBlock",
        text: `[${escape(t.title)}](${new URL("/?task=" + t.id, baseUrl).toString()})`,
        wrap: true,
      });
      if (!privacy && t.next_action)
        body.push({
          type: "TextBlock",
          text: escape(t.next_action.slice(0, 160)),
          wrap: true,
          isSubtle: true,
        });
    }
  }
  if (!groups.length)
    body.push({
      type: "TextBlock",
      text:
        kind === "test"
          ? "The webhook is connected. Private task content is excluded from this test."
          : "Nothing requiring attention in this summary.",
      wrap: true,
    });
  body.push({
    type: "TextBlock",
    text: `Notification ${id}`,
    size: "Small",
    isSubtle: true,
    wrap: true,
  });
  return {
    notificationId: id,
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.2",
          body,
          actions: [
            { type: "Action.OpenUrl", title: "Open Project Hub", url: baseUrl },
          ],
        },
      },
    ],
  };
}
export function scheduledNotifications(
  settings: NotificationSettings,
  tasks: Task[],
  now = new Date(),
) {
  if (!settings.enabled || !settings.tenant_confirmed) return [];
  const { day, time, weekday } = adelaideClock(now);
  if (time < settings.send_time) return [];
  const result: { key: string; kind: string; tasks: Task[] }[] = [];
  if (settings.daily)
    result.push({ key: `daily:${day}`, kind: "daily", tasks });
  if (settings.weekly && weekday === 1)
    result.push({ key: `weekly:${day}`, kind: "weekly", tasks });
  if (settings.important)
    for (const t of tasks
      .filter(
        (t) =>
          openTask(t) &&
          t.reminder_enabled &&
          t.reminder_on &&
          t.reminder_on <= day &&
          ["High", "Critical"].includes(t.priority) &&
          (!t.snoozed_until || t.snoozed_until <= day),
      )
      .slice(0, 10))
      result.push({
        key: `reminder:${t.id}:${t.reminder_on}`,
        kind: "reminder",
        tasks: [t],
      });
  return result;
}
