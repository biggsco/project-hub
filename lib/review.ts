import { type Task, type Project, today, addDays, priorities } from "./model";
import { type Directory, inPeopleScope } from "./people";
import { openTask, inFocus } from "./productivity";
export function followUpRadar(tasks: Task[], day = today()) {
  const rows = tasks
    .filter(
      (t) =>
        openTask(t) &&
        (!t.snoozed_until || t.snoozed_until <= day) &&
        (t.follow_up_date ||
          t.assigned_to ||
          t.status === "Waiting" ||
          ["Follow Up", "Delegated"].includes(t.task_type) ||
          t.awaiting_decision),
    )
    .toSorted(
      (a, b) =>
        (a.follow_up_date || "9999").localeCompare(
          b.follow_up_date || "9999",
        ) || a.id.localeCompare(b.id),
    );
  return {
    overdue: rows.filter((t) => t.follow_up_date && t.follow_up_date < day),
    today: rows.filter((t) => t.follow_up_date === day),
    upcoming: rows.filter((t) => t.follow_up_date && t.follow_up_date > day),
    decisions: rows.filter((t) => t.awaiting_decision),
    unscheduled: rows.filter((t) => !t.follow_up_date),
  };
}
export function weeklyReset(tasks: Task[], projects: Project[], day = today()) {
  const open = tasks.filter((t) => inFocus(t, day));
  const candidates: { task: Task; reason: string }[] = [];
  const seen = new Set<string>();
  function add(rows: Task[], reason: string) {
    for (const task of rows.slice(0, 3)) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        candidates.push({ task, reason });
      }
    }
  }
  add(
    open
      .filter(
        (t) =>
          t.classification !== "Ongoing" &&
          t.due_date &&
          t.due_date < day &&
          ["High", "Critical"].includes(t.priority),
      )
      .toSorted(
        (a, b) =>
          priorities.indexOf(b.priority) - priorities.indexOf(a.priority),
      ),
    "Important overdue work",
  );
  add(
    open
      .filter((t) => t.follow_up_date && t.follow_up_date <= day)
      .toSorted((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!)),
    "Outstanding follow-up",
  );
  add(
    open
      .filter(
        (t) => t.due_date && t.due_date >= day && t.due_date <= addDays(day, 7),
      )
      .toSorted((a, b) => a.due_date!.localeCompare(b.due_date!)),
    "Upcoming deadline",
  );
  add(
    open.filter(
      (t) =>
        t.status === "In Progress" &&
        t.updated_at.slice(0, 10) <= addDays(day, -14),
    ),
    "Stale in-progress task",
  );
  add(
    open
      .filter(
        (t) =>
          t.status === "Inbox" &&
          !t.project_id &&
          !t.bucket_id &&
          !t.team_id &&
          !t.person_id,
      )
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    "Unorganised Inbox",
  );
  return {
    items: candidates.slice(0, 12),
    projects: projects
      .filter((p) => p.status === "Active")
      .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3),
  };
}
export function conversationHistory(
  tasks: Task[],
  directory: Directory,
  teamId: string | null,
  personId: string | null,
  day = today(),
) {
  const scoped = tasks.filter(
    (t) =>
      !t.archived &&
      inPeopleScope(t, directory.teams, directory.people, teamId, personId),
  );
  const discussions = scoped
    .flatMap((t) =>
      (t.progress_entries || [])
        .filter((n) => n.kind === "discussion")
        .map((n) => ({ task: t, entry: n })),
    )
    .toSorted((a, b) => b.entry.created_at.localeCompare(a.entry.created_at))
    .slice(0, 4);
  return {
    discussions,
    completed: scoped
      .filter(
        (t) =>
          t.content_type === "Task" &&
          t.status === "Completed" &&
          t.completed_at,
      )
      .toSorted((a, b) => b.completed_at!.localeCompare(a.completed_at!))
      .slice(0, 3),
    followups: scoped
      .filter((t) => openTask(t) && !!t.follow_up_date)
      .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3),
    decisions: scoped
      .filter((t) => openTask(t) && t.awaiting_decision)
      .slice(0, 4),
    unresolved: scoped
      .filter((t) => openTask(t) && t.task_type === "Discuss")
      .slice(0, 4),
  };
}
export type AchievementFilters = {
  from: string;
  to: string;
  project: string;
  bucket: string;
  team: string;
  type: string;
};
export function achievements(
  tasks: Task[],
  filters: AchievementFilters,
  directory: Directory,
) {
  return tasks
    .filter(
      (t) =>
        t.content_type === "Task" &&
        t.status === "Completed" &&
        !!t.completed_at &&
        (!filters.from || today(new Date(t.completed_at)) >= filters.from) &&
        (!filters.to || today(new Date(t.completed_at)) <= filters.to) &&
        (!filters.project || t.project_id === filters.project) &&
        (!filters.bucket || t.bucket_id === filters.bucket) &&
        (!filters.team ||
          inPeopleScope(
            t,
            directory.teams,
            directory.people,
            filters.team,
            null,
          )) &&
        (!filters.type || t.task_type === filters.type),
    )
    .toSorted(
      (a, b) =>
        b.completed_at!.localeCompare(a.completed_at!) ||
        a.id.localeCompare(b.id),
    );
}
