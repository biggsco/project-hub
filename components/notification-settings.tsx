"use client";
import { useEffect, useState } from "react";
import {
  notificationSchema,
  type NotificationSettings,
} from "@/lib/notification-model";
export default function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettings>(
      notificationSchema.parse({}),
    ),
    [configured, setConfigured] = useState(false),
    [url, setUrl] = useState(""),
    [remove, setRemove] = useState(false),
    [logs, setLogs] = useState<any[]>([]),
    [run, setRun] = useState<string | null>(null),
    [scheduler, setScheduler] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  function apply(b: any) {
    setSettings(b.settings);
    setConfigured(b.settings.configured);
    setLogs(b.deliveries || []);
    setRun(b.last_run_at || null);
    if (b.scheduler_configured !== undefined)
      setScheduler(b.scheduler_configured);
  }
  useEffect(() => {
    fetch("/api/notifications")
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to load notification settings");
        apply(await r.json());
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function submit(test = false) {
    setBusy(true);
    try {
      const r = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          test
            ? { action: "test" }
            : {
                action: "save",
                value: settings,
                ...(url ? { webhook_url: url } : {}),
                remove_webhook: remove,
              },
        ),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      apply(b);
      setUrl("");
      setRemove(false);
      setMessage(
        test
          ? "Test processed. Check delivery status below and confirm it arrived in your Teams chat."
          : "Notification settings saved",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel notification-settings">
      <summary>Teams notifications & scheduled jobs</summary>
      <p className="muted">
        Uses “When a Teams webhook request is received”. No AI or premium HTTP
        trigger.{" "}
        <a href="/teams-setup.html" target="_blank" rel="noopener noreferrer">
          Setup guide
        </a>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          Teams Workflow webhook URL
          <input
            aria-label="Teams webhook URL"
            type="password"
            autoComplete="new-password"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              configured
                ? "Configured securely — enter a new URL to replace"
                : "Paste the signed Workflow URL"
            }
            maxLength={4000}
          />
        </label>
        {configured && (
          <label className="context-choice">
            <input
              type="checkbox"
              checked={remove}
              onChange={(e) => {
                setRemove(e.target.checked);
                if (e.target.checked)
                  setSettings((s) => ({ ...s, enabled: false }));
              }}
            />
            Remove saved webhook
          </label>
        )}
        <label className="context-choice">
          <input
            type="checkbox"
            checked={settings.tenant_confirmed}
            onChange={(e) =>
              setSettings((s) => ({ ...s, tenant_confirmed: e.target.checked }))
            }
          />
          I verified this trigger is allowed in my tenant, “Anyone”
          authentication is permitted, and the posting action targets my own
          Teams chat.
        </label>
        {(
          [
            ["enabled", "Enable notifications"],
            ["daily", "One daily digest"],
            ["weekly", "Weekly overview (Monday)"],
            ["important", "Allow individually enabled High/Critical reminders"],
            ["privacy", "Titles and links only (privacy mode)"],
          ] as const
        ).map(([key, label]) => (
          <label className="context-choice" key={key}>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
        <label>
          Notification time (Australia/Adelaide)
          <input
            type="time"
            required
            value={settings.send_time}
            onChange={(e) =>
              setSettings((s) => ({ ...s, send_time: e.target.value }))
            }
          />
        </label>
        <div className="inline-actions">
          <button className="primary" disabled={busy}>
            Save notification settings
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              busy || !configured || !settings.tenant_confirmed || !!url
            }
            onClick={() => submit(true)}
          >
            Test notification
          </button>
        </div>
      </form>
      <p role="status">{message}</p>
      <p className="muted">
        Scheduler secret: {scheduler ? "configured" : "not configured"}. Last
        server job:{" "}
        {run
          ? new Date(run).toLocaleString("en-AU", {
              timeZone: "Australia/Adelaide",
            })
          : "not yet run"}
        . Add the GitHub Actions settings in the guide to run without an open
        browser. Scheduled runs can be delayed.
      </p>
      <details>
        <summary>Recent delivery status</summary>
        <p className="muted">
          Accepted means the webhook returned success. Confirm the Workflow's
          Teams posting action succeeded. Unconfirmed deliveries are not retried
          automatically. HTTP 429 retries are bounded to three attempts.
        </p>
        {logs.map((l) => (
          <p className="muted" key={l.id}>
            {new Date(l.created_at).toLocaleString("en-AU", {
              timeZone: "Australia/Adelaide",
            })}{" "}
            · {l.kind} ·{" "}
            {l.status === "delivered" ? "Accepted by webhook" : l.status} ·{" "}
            {l.attempts} attempts {l.error_code ? `· ${l.error_code}` : ""}
          </p>
        ))}
      </details>
    </details>
  );
}
