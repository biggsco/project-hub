"use client";
import { useState } from "react";
import { type Task } from "@/lib/model";
import { followUpRadar } from "@/lib/review";
import SmartDate from "./smart-date";
type Props = {
  tasks: Task[];
  onAction: (input: Record<string, unknown>) => Promise<any>;
  onPatch: (task: Task, patch: Partial<Task>) => Promise<boolean>;
  onComplete: (task: Task) => void;
  onOpen: (task: Task) => void;
  compact?: boolean;
  onExpand?: () => void;
};
export default function FollowUpRadar({
  tasks,
  onAction,
  onPatch,
  onComplete,
  onOpen,
  compact = false,
  onExpand,
}: Props) {
  const [group, setGroup] = useState("today"),
    [busy, setBusy] = useState<string | null>(null),
    [expanded, setExpanded] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [date, setDate] = useState<string | null>(null),
    [error, setError] = useState("");
  const radar = followUpRadar(tasks),
    rows = compact
      ? [...radar.overdue, ...radar.today].slice(0, 3)
      : (radar as Record<string, Task[]>)[group];
  async function record(
    t: Task,
    text = "",
    follow_up_date: string | null = null,
  ) {
    if (busy) return;
    setBusy(t.id);
    try {
      await onAction({
        action: "followed_up",
        task_id: t.id,
        request_id: crypto.randomUUID(),
        text,
        follow_up_date,
      });
      setExpanded(null);
      setNote("");
      setDate(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="panel follow-up-radar">
      <div className="section-heading">
        <h2>Follow-up Radar</h2>
        {compact && (
          <button className="text-button" onClick={onExpand}>
            View all
          </button>
        )}
      </div>
      {!compact && (
        <div className="inline-actions">
          {(
            [
              ["overdue", "Overdue"],
              ["today", "Due today"],
              ["upcoming", "Upcoming"],
              ["decisions", "Awaiting decisions"],
              ["unscheduled", "No follow-up date"],
            ] as const
          ).map(([key, label]) => (
            <button
              className={group === key ? "primary" : "secondary"}
              key={key}
              onClick={() => setGroup(key)}
            >
              {label} ({radar[key].length})
            </button>
          ))}
        </div>
      )}
      {!rows.length && <p className="muted">No follow-ups in this view.</p>}
      {rows.slice(0, compact ? 3 : 50).map((t) => (
        <article className="radar-row" key={t.id}>
          <button className="task-title" onClick={() => onOpen(t)}>
            <strong>{t.title}</strong>
            <small>
              {t.assigned_to ? `Waiting on ${t.assigned_to} · ` : ""}
              {t.follow_up_date ? `Follow up ${t.follow_up_date}` : "No date"}
              {t.awaiting_decision ? " · Decision needed" : ""}
            </small>
          </button>
          <div className="inline-actions">
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => record(t)}
            >
              Followed Up
            </button>
            {!compact && (
              <>
                <button
                  className="text-button"
                  onClick={() => {
                    setExpanded(t.id);
                    setNote("");
                    setDate(null);
                  }}
                >
                  Note / new date
                </button>
                <SmartDate
                  label={`Reschedule follow-up ${t.title}`}
                  value={t.follow_up_date}
                  onChange={(follow_up_date) => onPatch(t, { follow_up_date })}
                />
                <SmartDate
                  snooze
                  label={`Snooze follow-up ${t.title}`}
                  value={t.snoozed_until}
                  onChange={(snoozed_until) => onPatch(t, { snoozed_until })}
                />
                <button className="text-button" onClick={() => onComplete(t)}>
                  Complete
                </button>
              </>
            )}
          </div>
          {expanded === t.id && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                record(t, note, date);
              }}
            >
              <label>
                Optional update
                <input
                  value={note}
                  maxLength={4000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <SmartDate
                label="Next follow-up"
                value={date}
                onChange={setDate}
              />
              <button className="primary" disabled={!!busy}>
                Record follow-up
              </button>
            </form>
          )}
        </article>
      ))}
      {!compact && rows.length > 50 && (
        <p className="muted">
          Showing the first 50. Use search to find other items.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        Following up records an update and clears or reschedules the follow-up
        date. It does not complete the task.
      </p>
    </section>
  );
}
