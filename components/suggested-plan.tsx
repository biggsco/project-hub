"use client";
import { useState } from "react";
import { today, addDays, type Task } from "@/lib/model";
import { suggestedPlan } from "@/lib/planning";
import SmartDate from "./smart-date";
export default function SuggestedPlan({
  tasks,
  onPatch,
  onOpen,
  onComplete,
}: {
  tasks: Task[];
  onPatch: (t: Task, p: Partial<Task>) => Promise<boolean>;
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const plan = suggestedPlan(tasks, undefined, skipped);
  return (
    <section className="panel suggested-plan">
      <h2>Suggested Plan</h2>
      <p className="muted">
        A few useful choices, not a calendar commitment. Flexible work dates can
        move; firm deadlines stay put.
      </p>
      {(
        [
          ["Today", plan.today],
          ["Coming week", plan.week],
        ] as [string, Task[]][]
      ).map(([label, rows]) => (
        <div key={label}>
          <h3>{label}</h3>
          {!rows.length && <p className="muted">No more suggestions here.</p>}
          {rows.map((t) => (
            <article className="radar-row" key={t.id}>
              <button className="task-title" onClick={() => onOpen(t)}>
                <strong>{t.title}</strong>
                <small>
                  {t.next_action ||
                    (t.follow_up_date && `Follow up ${t.follow_up_date}`) ||
                    (t.due_date && `Deadline ${t.due_date}`) ||
                    "Flexible work"}
                </small>
              </button>
              <div className="inline-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    onPatch(t, {
                      planned_for:
                        label === "Today" ? today() : addDays(today(), 1),
                    })
                  }
                >
                  {t.planned_for ? `Accepted · ${t.planned_for}` : "Accept"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setSkipped((v) => [...v, t.id])}
                >
                  Skip
                </button>
                <SmartDate
                  label={`Move work date ${t.title}`}
                  value={t.planned_for}
                  onChange={(planned_for) => onPatch(t, { planned_for })}
                />
                <button className="text-button" onClick={() => onComplete(t)}>
                  Complete
                </button>
              </div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
