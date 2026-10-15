"use client";
import { useEffect, useState } from "react";
import { type Task, today, addDays } from "@/lib/model";
import type { Person } from "@/lib/people";
import SmartDate from "./smart-date";
export default function TaskTools({
  task,
  people,
  onPatch,
  onComplete,
  disabled = false,
  focus = false,
}: {
  task: Task;
  people: Person[];
  onPatch: (task: Task, patch: Partial<Task>) => Promise<boolean>;
  onComplete: (task: Task) => void;
  disabled?: boolean;
  focus?: boolean;
}) {
  const [note, setNote] = useState(""),
    [assignee, setAssignee] = useState(task.assigned_to),
    [busy, setBusy] = useState(false);
  useEffect(() => setAssignee(task.assigned_to), [task.assigned_to]);
  async function save(patch: Partial<Task>) {
    setBusy(true);
    try {
      return await onPatch(task, patch);
    } finally {
      setBusy(false);
    }
  }
  const locked = disabled || busy;
  return (
    <details
      className="task-tools"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.removeAttribute("open");
          e.stopPropagation();
        }
      }}
    >
      <summary>Actions</summary>
      <div className="task-tools-panel">
        <div className="inline-actions">
          <button
            type="button"
            className="secondary"
            disabled={locked}
            onClick={() => onComplete(task)}
          >
            {task.status === "Completed"
              ? "Reopen"
              : task.task_type === "Delegated" || task.task_type === "Follow Up"
                ? "Mark resolved"
                : "Complete"}
          </button>
          {task.task_type === "Discuss" && (
            <button
              type="button"
              className="secondary"
              disabled={locked}
              onClick={() => save({ task_type: "To Do", status: "To Do" })}
            >
              Convert to action
            </button>
          )}
          {(task.assigned_to ||
            task.task_type === "Delegated" ||
            task.status === "Waiting") && (
            <button
              type="button"
              className="secondary"
              disabled={locked}
              onClick={() =>
                save({
                  assigned_to: "",
                  task_type: "To Do",
                  date_assigned: null,
                  follow_up_date: null,
                  assignment_notes: "",
                  status: "To Do",
                })
              }
            >
              Return to my workload
            </button>
          )}
        </div>
        <label>
          Assign / reassign
          <input
            aria-label={"Assign " + task.title}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            list={"people-" + task.id}
            placeholder="Type a name"
            maxLength={255}
          />
        </label>
        <datalist id={"people-" + task.id}>
          {people
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.name} />
            ))}
        </datalist>
        <button
          type="button"
          className="secondary"
          disabled={locked || !assignee.trim()}
          onClick={() =>
            save({
              assigned_to: assignee.trim(),
              task_type: "Delegated",
              date_assigned: today(),
            })
          }
        >
          {task.assigned_to ? "Reassign" : "Assign action"}
        </button>
        <SmartDate
          label="Follow-up date"
          value={task.follow_up_date}
          disabled={locked}
          natural
          onChange={(follow_up_date) => save({ follow_up_date })}
        />
        <button
          type="button"
          className="text-button"
          disabled={locked}
          onClick={() => save({ follow_up_date: addDays(today(), 1) })}
        >
          Follow up tomorrow
        </button>
        <SmartDate
          label="Snooze task until"
          snooze
          value={task.snoozed_until}
          disabled={locked}
          onChange={(snoozed_until) => save({ snoozed_until })}
        />
        {task.notes && <p className="task-note">{task.notes}</p>}
        <label>
          Brief note
          <textarea
            aria-label={"Note for " + task.title}
            rows={2}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={
            locked ||
            !note.trim() ||
            task.notes.length + note.length + 60 > 20000
          }
          onClick={async () => {
            const stamp = new Date().toLocaleString("en-AU", {
              timeZone: "Australia/Adelaide",
            });
            if (
              await save({
                notes: [task.notes, `[${stamp}] ${note.trim()}`]
                  .filter(Boolean)
                  .join("\n\n"),
              })
            )
              setNote("");
          }}
        >
          Add note
        </button>
        {(focus || task.focus_dismissed_until) && (
          <button
            type="button"
            className="text-button"
            disabled={locked}
            onClick={() =>
              save({
                focus_dismissed_until:
                  task.focus_dismissed_until &&
                  task.focus_dismissed_until > today()
                    ? null
                    : addDays(today(), 7),
              })
            }
          >
            {task.focus_dismissed_until && task.focus_dismissed_until > today()
              ? "Bring back to focus"
              : "Hide from focus for a week"}
          </button>
        )}
      </div>
    </details>
  );
}
