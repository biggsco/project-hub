"use client";
import { useMemo } from "react";
import { ArrowUpRight, Check, Layers } from "lucide-react";
import { today, addDays, type Task, type Project } from "@/lib/model";
import { suggestedPlan } from "@/lib/planning";
import { openTask } from "@/lib/productivity";
import { workspaceStyle, type WorkspaceLibrary } from "@/lib/workspace-style";
import TaskCard from "./task-card";
import NextChoice from "./next-choice";
export default function CalmHome({
  tasks,
  projects,
  teams,
  buckets,
  onOpen,
  onComplete,
  onPatch,
  onTeam,
  onProject,
  onBucket,
}: WorkspaceLibrary & {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
  onPatch: (t: Task, p: Partial<Task>) => Promise<boolean>;
  onTeam: (id: string) => void;
  onProject: (p: Project) => void;
  onBucket: (id: string) => void;
}) {
  const day = today(),
    library = { teams, projects, buckets };
  const plan = useMemo(() => suggestedPlan(tasks), [tasks]);
  const focus = plan.today;
  const open = tasks.filter((t) => openTask(t) && !t.parent_id);
  const upcoming = open
    .flatMap((task) => {
      const dates = [
        { label: "Deadline", date: task.due_date },
        { label: "Follow up", date: task.follow_up_date },
        { label: "Repeats", date: task.recurrence_date },
      ];
      return dates
        .filter(
          (d): d is { label: string; date: string } =>
            !!d.date && d.date >= day && d.date <= addDays(day, 14),
        )
        .map((d) => ({ task, ...d }));
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.task.id.localeCompare(b.task.id),
    )
    .filter(
      (entry, i, all) =>
        all.findIndex((a) => a.task.id === entry.task.id) === i,
    )
    .slice(0, 4);
  const spaces = [
    ...teams
      .filter((v) => !v.archived)
      .map((v) => ({
        ...v,
        key: `team-${v.id}`,
        count: open.filter((t) => t.team_id === v.id).length,
        open: () => onTeam(v.id),
      })),
    ...buckets
      .filter((v) => !v.archived)
      .map((v) => ({
        ...v,
        key: `bucket-${v.id}`,
        count: open.filter((t) => t.bucket_id === v.id).length,
        open: () => onBucket(v.id),
      })),
    ...projects
      .filter((v) => !["Completed", "Archived"].includes(v.status))
      .map((v) => ({
        ...v,
        key: `project-${v.id}`,
        count: open.filter((t) => t.project_id === v.id).length,
        open: () => onProject(v),
      })),
  ]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
  return (
    <div className="visual-home">
      <NextChoice tasks={tasks} onOpen={onOpen} onPatch={onPatch} />
      <section className="home-focus">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE FORWARD MOMENTUM</p>
            <h2>Today’s focus</h2>
          </div>
          <small>Suggestions, not commitments</small>
        </div>
        <div className="focus-cards">
          {focus.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              tasks={tasks}
              library={library}
              onOpen={onOpen}
              onComplete={onComplete}
            />
          ))}
        </div>
        {!focus.length && (
          <p className="empty">
            A little breathing room. Capture an idea above, or explore your
            workspaces.
          </p>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Your workspaces</h2>
          <Layers size={18} className="muted" />
        </div>
        <div className="workspace-tiles">
          {spaces.map((space) => (
            <button
              key={space.key}
              className="workspace-tile"
              style={workspaceStyle(
                space.name,
                "aliases" in space ? space.aliases : [],
              )}
              onClick={space.open}
            >
              <span className="workspace-monogram">
                {space.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <strong>{space.name}</strong>
              <small>{space.count} outstanding</small>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
        {!spaces.length && (
          <p className="empty">
            Your teams, buckets and projects will appear here as you create
            them.
          </p>
        )}
      </section>
      <section className="coming-up">
        <div className="section-heading">
          <h2>Coming up</h2>
          <small>Next two weeks</small>
        </div>
        {upcoming.map(({ task, label, date }) => (
          <button
            className="coming-row"
            key={task.id}
            onClick={() => onOpen(task)}
          >
            <span>
              <strong>{task.title}</strong>
              <small>{label}</small>
            </span>
            <time dateTime={date}>
              {new Intl.DateTimeFormat("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "Australia/Adelaide",
              }).format(new Date(`${date}T12:00:00+09:30`))}
            </time>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {!upcoming.length && (
          <p className="muted">
            No deadlines or follow-ups coming up. Flexible plans stay in your
            plan.
          </p>
        )}
      </section>
    </div>
  );
}
export function DailyMomentum({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter(
    (t) =>
      t.content_type === "Task" &&
      !t.parent_id &&
      t.status === "Completed" &&
      t.completed_at &&
      today(new Date(t.completed_at)) === today(),
  ).length;
  return (
    <div className="daily-momentum" role="status">
      <span className="momentum-check">
        <Check size={18} />
      </span>
      <span>
        <strong>
          {done ? `${done} completed today` : "A fresh space for today"}
        </strong>
        <small>
          {done ? "Every small step counts." : "One useful step is enough."}
        </small>
      </span>
    </div>
  );
}
