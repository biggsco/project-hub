"use client";
import { useEffect, useState, type ReactNode } from "react";
import { type Task, type Project, today } from "@/lib/model";
import {
  needsAttention,
  recommendTasks,
  resumeWork,
  inFocus,
} from "@/lib/productivity";
import { suitableTasks, efforts } from "@/lib/capture";
import SmartDate from "./smart-date";
type Props = {
  tasks: Task[];
  projects: Project[];
  welcomeBack: boolean;
  renderTask: (task: Task, focus?: boolean) => ReactNode;
  onOpen: (task: Task) => void;
  onComplete: (task: Task) => void;
  onPatch: (task: Task, patch: Partial<Task>) => Promise<boolean>;
  onProject: (project: Project) => void;
  onNavigate: (section: string, filter?: string) => void;
};
export default function ProductivityDashboard({
  tasks,
  projects,
  welcomeBack,
  renderTask,
  onOpen,
  onComplete,
  onPatch,
  onProject,
  onNavigate,
}: Props) {
  const [deepWork, setDeepWork] = useState(false);
  const [minutes, setMinutes] = useState(30),
    [nextMinutes, setNextMinutes] = useState(0),
    [showNext, setShowNext] = useState(false),
    [timeMode, setTimeMode] = useState(false),
    [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.sessionStorage.getItem("hub-skipped-tasks") || "[]",
      );
      if (Array.isArray(saved))
        setSkipped(saved.filter((x) => typeof x === "string").slice(0, 1000));
    } catch {}
  }, []);
  function skip(id: string) {
    const values = [...new Set([...skipped, id])].slice(-1000);
    setSkipped(values);
    try {
      window.sessionStorage.setItem(
        "hub-skipped-tasks",
        JSON.stringify(values),
      );
    } catch {}
  }
  const day = today(),
    attention = needsAttention(tasks, day),
    resume = resumeWork(tasks, projects, day);
  const timeTasks = suitableTasks(tasks, minutes, day).filter(
    (t) =>
      inFocus(t, day) &&
      !skipped.includes(t.id) &&
      (!deepWork || (t.effort_minutes || 0) >= 60),
  );
  const recommendation = timeMode
    ? timeTasks[0]
      ? {
          task: timeTasks[0],
          kind: "work",
          reason: "Fits your available time; Downtime is prioritised",
        }
      : null
    : recommendTasks(tasks, {
        day,
        minutes: nextMinutes || undefined,
        skipped,
      })[0];
  return (
    <>
      {welcomeBack && (
        <section className="panel welcome-back">
          <h2>Welcome back</h2>
          <p>
            A few useful places to restart. Your backlog can wait; nothing needs
            cleaning up before you begin.
          </p>
        </section>
      )}
      <section className="panel next-panel">
        <div className="section-heading">
          <div>
            <h2>What's Next?</h2>
            <p className="muted">
              One useful action, chosen with simple rules.
            </p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setTimeMode(false);
              setShowNext(true);
            }}
          >
            What's Next?
          </button>
        </div>
        {showNext && (
          <div aria-label="Task recommendation">
            <label className="inline-label">
              Available time
              <select
                aria-label="Recommendation available time"
                value={nextMinutes}
                onChange={(e) => {
                  setNextMinutes(Number(e.target.value));
                  setTimeMode(false);
                }}
              >
                <option value={0}>Any time</option>
                {efforts.slice(0, 5).map(([n, label]) => (
                  <option key={n} value={n}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {recommendation ? (
              <>
                <p className="muted">{recommendation.reason}</p>
                <h3>
                  {recommendation.kind === "follow_up" ? "Follow up: " : ""}
                  {recommendation.task.title}
                </h3>
                {recommendation.task.next_action && (
                  <p>Next action: {recommendation.task.next_action}</p>
                )}
                <div className="inline-actions">
                  <button
                    className="secondary"
                    onClick={() => onOpen(recommendation.task)}
                  >
                    Open task
                  </button>
                  <button
                    className="secondary"
                    onClick={() => onComplete(recommendation.task)}
                  >
                    {recommendation.kind === "follow_up"
                      ? "Mark resolved"
                      : "Mark complete"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => skip(recommendation.task.id)}
                  >
                    Skip / show another
                  </button>
                </div>
                <SmartDate
                  label="Snooze suggestion until"
                  snooze
                  value={recommendation.task.snoozed_until}
                  onChange={(snoozed_until) =>
                    onPatch(recommendation.task, { snoozed_until })
                  }
                />
              </>
            ) : (
              <p className="empty">
                No more suitable tasks with these settings. Skipped tasks stay
                out for this session.
              </p>
            )}
          </div>
        )}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Needs your attention</h2>
            <small>Up to 6 items</small>
          </div>
          {attention.map((t) => renderTask(t, true))}
          {!attention.length && (
            <p className="empty">
              Nothing pressing. Choose something useful below.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Pick up where you left off</h2>
          {resume.tasks
            .filter((t) => !attention.some((a) => a.id === t.id))
            .map((t) => renderTask(t, true))}
          {resume.projects.map((p) => (
            <button
              className="resume-project"
              key={p.id}
              onClick={() => onProject(p)}
            >
              <strong>{p.name}</strong>
              <small>
                {p.next_action
                  ? "Next: " + p.next_action
                  : "Recently active project"}
              </small>
            </button>
          ))}
          {!resume.tasks.length && !resume.projects.length && (
            <p className="empty">
              Capture a task or create a project to get started.
            </p>
          )}
        </section>
      </div>
      <section className="panel time-panel">
        <div className="section-heading">
          <h2>Got some spare time?</h2>
          <select
            aria-label="Available time"
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setDeepWork(false);
            }}
          >
            {efforts.slice(0, 5).map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="inline-actions">
          <button
            className="secondary"
            onClick={() => onNavigate("My Tasks", "quick")}
          >
            Quick Wins
          </button>
          <button className="secondary" onClick={() => onNavigate("Downtime")}>
            Downtime
          </button>
          <button
            className="secondary"
            onClick={() => {
              setDeepWork(true);
              setMinutes(240);
              setTimeMode(true);
              setShowNext(true);
            }}
          >
            Deep Work
          </button>
          <button
            className="secondary"
            onClick={() => onNavigate("Downtime", "delegate")}
          >
            Available to Delegate
          </button>
          <button
            className="primary"
            disabled={!timeTasks.length}
            onClick={() => {
              setTimeMode(true);
              setShowNext(true);
              document
                .querySelector(".next-panel")
                ?.scrollIntoView({ block: "center" });
            }}
          >
            Pick something for me
          </button>
        </div>
        <h3>{deepWork ? "Deep Work — 1 to 4 hours" : "I've got some time"}</h3>
        <p className="muted">
          Actionable work with an estimate that fits. Downtime comes first.
        </p>
        {timeTasks.slice(0, 4).map((t) => renderTask(t))}
        {!timeTasks.length && (
          <p className="empty">No estimated tasks fit this time yet.</p>
        )}
      </section>
    </>
  );
}
