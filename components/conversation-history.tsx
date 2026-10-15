"use client";
import type { Task } from "@/lib/model";
import type { Directory } from "@/lib/people";
import { conversationHistory } from "@/lib/review";
export default function ConversationHistory({
  tasks,
  directory,
  teamId,
  personId,
  onOpen,
}: {
  tasks: Task[];
  directory: Directory;
  teamId: string | null;
  personId: string | null;
  onOpen: (t: Task) => void;
}) {
  const h = conversationHistory(tasks, directory, teamId, personId);
  return (
    <details className="panel conversation-history" open>
      <summary>Last Time We Spoke</summary>
      <p className="muted">
        Only entries explicitly marked “Actually discussed” are recorded as
        conversations. Other updates are shown as task activity.
      </p>
      {h.discussions.length ? (
        <div>
          <h3>Recorded discussions</h3>
          {h.discussions.map(({ task, entry }) => (
            <button
              key={entry.id}
              className="resume-project"
              onClick={() => onOpen(task)}
            >
              <strong>{entry.text}</strong>
              <small>
                {task.title} ·{" "}
                {new Date(entry.created_at).toLocaleDateString("en-AU", {
                  timeZone: "Australia/Adelaide",
                })}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">
          No recorded discussions yet. Add an “Actually discussed” progress
          entry in a task workbench.
        </p>
      )}
      {(
        [
          ["Recently completed actions", h.completed],
          ["Follow-ups", h.followups],
          ["Outstanding decisions", h.decisions],
          ["Unresolved discussions", h.unresolved],
        ] as [string, Task[]][]
      ).map(([label, rows]) =>
        rows.length ? (
          <div key={label}>
            <h3>{label}</h3>
            {rows.map((t) => (
              <button
                className="resume-project"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                <strong>{t.title}</strong>
                <small>
                  {t.follow_up_date
                    ? `Follow up ${t.follow_up_date}`
                    : t.next_action || t.status}
                </small>
              </button>
            ))}
          </div>
        ) : null,
      )}
    </details>
  );
}
