"use client";
import { useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/model";
import {
  planningBoard,
  planningLanes,
  planningPatch,
  type PlanningLane,
} from "@/lib/planning";
import type { WorkspaceLibrary } from "@/lib/workspace-style";
import TaskCard from "./task-card";
export default function SuggestedPlan({
  tasks,
  library,
  onPatch,
  onOpen,
  onComplete,
}: {
  tasks: Task[];
  library: WorkspaceLibrary;
  onPatch: (t: Task, p: Partial<Task>) => Promise<boolean>;
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
}) {
  const board = useMemo(() => planningBoard(tasks), [tasks]),
    [limit, setLimit] = useState(20),
    [pending, setPending] = useState<string[]>([]),
    lock = useRef(new Set<string>()),
    [message, setMessage] = useState("");
  async function move(id: string, lane: PlanningLane) {
    const task = tasks.find((t) => t.id === id);
    if (!task || lock.current.has(id)) return;
    lock.current.add(id);
    setPending([...lock.current]);
    try {
      const saved = await onPatch(task, planningPatch(lane));
      setMessage(
        saved
          ? `Moved to ${lane}. Deadline unchanged.`
          : "Could not move task. Please try again.",
      );
    } finally {
      lock.current.delete(id);
      setPending([...lock.current]);
    }
  }
  return (
    <section className="planning-workspace">
      <p className="muted">
        A flexible place to plan. Move unfinished work whenever you like; firm
        deadlines stay put.
      </p>
      <p className="planning-status" role="status">
        {message}
      </p>
      <div className="planning-board">
        {planningLanes.map((lane) => (
          <section
            className="planning-lane"
            key={lane}
            aria-label={`${lane} plan`}
            onDragOver={(e) => {
              if (
                e.dataTransfer.types.includes("application/x-project-hub-task")
              )
                e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void move(
                e.dataTransfer.getData("application/x-project-hub-task"),
                lane,
              );
            }}
          >
            <h2>
              {lane}
              <span>{board[lane].length}</span>
            </h2>
            {board[lane].slice(0, limit).map((task) => (
              <div
                key={task.id}
                className="planning-item"
                draggable={!pending.includes(task.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-project-hub-task",
                    task.id,
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <TaskCard
                  task={task}
                  tasks={tasks}
                  library={library}
                  onOpen={onOpen}
                  onComplete={onComplete}
                  busy={pending.includes(task.id)}
                />
                <label className="move-task">
                  Move to
                  <select
                    aria-label={`Move ${task.title}`}
                    value={lane}
                    disabled={pending.includes(task.id)}
                    onChange={(e) =>
                      void move(task.id, e.target.value as PlanningLane)
                    }
                  >
                    {planningLanes.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            {!board[lane].length && (
              <p className="lane-empty">
                Room to breathe. Move a task here when you’re ready.
              </p>
            )}
            {board[lane].length > limit && (
              <button
                className="secondary"
                onClick={() => setLimit((n) => n + 20)}
              >
                Show more {lane.toLowerCase()} tasks
              </button>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
