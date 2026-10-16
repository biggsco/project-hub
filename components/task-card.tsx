"use client";
import { Check, Repeat2 } from "lucide-react";
import type { Task } from "@/lib/model";
import {
  taskDate,
  taskWorkspace,
  workspaceStyle,
  type WorkspaceLibrary,
} from "@/lib/workspace-style";
export default function TaskCard({
  task,
  tasks,
  library,
  onOpen,
  onComplete,
  busy = false,
}: {
  task: Task;
  tasks: Task[];
  library: WorkspaceLibrary;
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
  busy?: boolean;
}) {
  const workspace = taskWorkspace(task, library),
    date = taskDate(task);
  const children = tasks.filter((t) => t.parent_id === task.id && !t.archived),
    done = children.filter((t) => t.status === "Completed").length;
  return (
    <article
      className={
        "task-card " + (task.status === "Completed" ? "is-complete" : "")
      }
      style={workspaceStyle(
        workspace.name,
        "aliases" in workspace ? workspace.aliases : [],
      )}
    >
      <button
        className="card-check"
        aria-label={`${task.status === "Completed" ? "Reopen" : "Complete"} ${task.title}`}
        aria-busy={busy}
        disabled={busy}
        onClick={() => onComplete(task)}
      >
        {task.status === "Completed" && <Check size={15} />}
      </button>
      <button className="card-body" onClick={() => onOpen(task)}>
        <span className="workspace-label">
          <i />
          {workspace.name}
          {task.recurrence_series_id && (
            <Repeat2 size={13} aria-label="Recurring task" />
          )}
        </span>
        <strong>{task.title}</strong>
        {date && (
          <small
            className={
              date.label === "Flexible" ? "flexible-date" : "firm-date"
            }
          >
            {date.label} ·{" "}
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              month: "short",
              timeZone: "Australia/Adelaide",
            }).format(new Date(`${date.date}T12:00:00+09:30`))}
          </small>
        )}
        {children.length > 0 && (
          <span className="subtask-progress">
            <progress
              value={done}
              max={children.length}
              aria-label={`Checklist for ${task.title}`}
            />
            <small>
              {done}/{children.length} steps
            </small>
          </span>
        )}
      </button>
    </article>
  );
}
