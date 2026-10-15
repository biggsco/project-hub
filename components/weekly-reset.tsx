"use client";
import { useState } from "react";
import { type Task, type Project } from "@/lib/model";
import { weeklyReset } from "@/lib/review";
import SmartDate from "./smart-date";
export default function WeeklyReset({
  tasks,
  projects,
  onPatch,
  onComplete,
  onOpen,
  onProject,
}: {
  tasks: Task[];
  projects: Project[];
  onPatch: (t: Task, p: Partial<Task>) => Promise<boolean>;
  onComplete: (t: Task) => void;
  onOpen: (t: Task) => void;
  onProject: (p: Project) => void;
}) {
  const [reviewed, setReviewed] = useState<string[]>([]),
    [busy, setBusy] = useState<string | null>(null);
  const review = weeklyReset(
    tasks.filter((t) => !reviewed.includes(t.id)),
    projects,
  );
  async function patch(t: Task, p: Partial<Task>) {
    setBusy(t.id);
    try {
      if (await onPatch(t, p)) setReviewed((v) => [...v, t.id]);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="panel weekly-reset">
      <div className="section-heading">
        <h2>Weekly Reset</h2>
        <button className="text-button" onClick={() => setReviewed([])}>
          Start fresh
        </button>
      </div>
      <p className="muted">
        A short review, whenever you need it. Up to 12 useful items; no need to
        clear your backlog. Deadlines only change when you choose a new date.
      </p>
      {review.items.map(({ task: t, reason }) => (
        <article className="radar-row" key={t.id}>
          <small>{reason}</small>
          <button className="task-title" onClick={() => onOpen(t)}>
            <strong>{t.title}</strong>
            <small>{t.next_action || t.due_date || t.status}</small>
          </button>
          <div className="inline-actions">
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() =>
                patch(t, { priority: "High", focus_dismissed_until: null })
              }
            >
              Keep as priority
            </button>
            <SmartDate
              label={`Reset deadline ${t.title}`}
              value={t.due_date}
              onChange={(due_date) => patch(t, { due_date })}
            />
            <SmartDate
              snooze
              label={`Reset snooze ${t.title}`}
              value={t.snoozed_until}
              onChange={(snoozed_until) => patch(t, { snoozed_until })}
            />
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => patch(t, { classification: "Downtime" })}
            >
              Move to Downtime
            </button>
            <button className="text-button" onClick={() => onComplete(t)}>
              Complete
            </button>
            <button
              className="text-button"
              onClick={() => setReviewed((v) => [...v, t.id])}
            >
              Reviewed / next
            </button>
          </div>
        </article>
      ))}
      {!review.items.length && (
        <p>Enough for now. Your other work remains in its usual views.</p>
      )}
      <h3>Recently active projects</h3>
      {review.projects.map((p) => (
        <button
          className="resume-project"
          key={p.id}
          onClick={() => onProject(p)}
        >
          <strong>{p.name}</strong>
          <small>{p.next_action}</small>
        </button>
      ))}
    </section>
  );
}
