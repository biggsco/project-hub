"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Shuffle, SkipForward, Sparkles } from "lucide-react";
import { recommendTasks } from "@/lib/productivity";
import type { Task } from "@/lib/model";
export default function NextChoice({
  tasks,
  onOpen,
  onPatch,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onPatch: (t: Task, patch: Partial<Task>) => Promise<boolean>;
}) {
  const [skipped, setSkipped] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [minutes, setMinutes] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("hub-skipped-tasks") || "[]",
      );
      if (Array.isArray(saved))
        setSkipped(saved.filter((v) => typeof v === "string").slice(-1000));
    } catch {}
  }, []);
  function skip(id: string) {
    const values = [...new Set([...skipped, id])].slice(-1000);
    setSkipped(values);
    setIndex(0);
    try {
      sessionStorage.setItem("hub-skipped-tasks", JSON.stringify(values));
    } catch {}
  }
  const choices = useMemo(
    () => recommendTasks(tasks, { skipped, minutes: minutes || undefined }),
    [tasks, skipped, minutes],
  );
  const choice = choices[index % Math.max(choices.length, 1)];
  return (
    <section className="next-choice" aria-label="What's Next?">
      <div className="section-heading">
        <h2>
          <Sparkles size={18} /> What's Next?
        </h2>
        <select
          aria-label="Time for next task"
          value={minutes}
          onChange={(e) => {
            setMinutes(Number(e.target.value));
            setIndex(0);
          }}
        >
          <option value={0}>Any time</option>
          {[15, 30, 60, 120].map((n) => (
            <option key={n} value={n}>
              {n < 60 ? `${n} minutes` : `${n / 60} hour${n > 60 ? "s" : ""}`}
            </option>
          ))}
        </select>
      </div>
      {choice ? (
        <>
          <p className="muted">{choice.reason}</p>
          <button
            className="next-choice-title"
            onClick={() => onOpen(choice.task)}
          >
            {choice.task.title}
          </button>
          {choice.task.next_action && <p>{choice.task.next_action}</p>}
          <div className="inline-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (
                    choice.kind === "follow_up" ||
                    (await onPatch(choice.task, { status: "In Progress" }))
                  )
                    onOpen(choice.task);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Start <ArrowRight size={16} />
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                skip(choice.task.id);
              }}
            >
              <SkipForward size={15} /> Skip
            </button>
            <button
              className="text-button"
              disabled={busy || choices.length < 2}
              onClick={() => setIndex((i) => i + 1)}
            >
              <Shuffle size={15} /> Another
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            No suggestions right now. Your tasks are still in Work.
          </p>
          {skipped.length > 0 && (
            <button
              className="secondary"
              onClick={() => {
                setSkipped([]);
                setIndex(0);
                try {
                  sessionStorage.removeItem("hub-skipped-tasks");
                } catch {}
              }}
            >
              Show skipped tasks
            </button>
          )}
        </>
      )}
    </section>
  );
}
