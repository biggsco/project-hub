import { type Task, type Project, today, addDays, priorities } from "./model";
import { actionable } from "./capture";
export const openTask = (t: Task) =>
  (t.content_type || "Task") === "Task" &&
  !t.archived &&
  t.status !== "Completed";
export const inFocus = (t: Task, day = today()) =>
  openTask(t) &&
  (!t.snoozed_until || t.snoozed_until <= day) &&
  (!t.focus_dismissed_until || t.focus_dismissed_until <= day);
export const dueFollowUp = (t: Task, day = today()) =>
  !!t.follow_up_date && t.follow_up_date <= day;
export function needsAttention(tasks: Task[], day = today(), limit = 6) {
  return tasks
    .filter(
      (t) =>
        inFocus(t, day) &&
        t.status !== "Blocked" &&
        (dueFollowUp(t, day) ||
          t.priority === "Critical" ||
          (t.classification !== "Ongoing" &&
            !!t.due_date &&
            t.due_date < day &&
            t.priority === "High") ||
          (!!t.due_date &&
            t.due_date >= day &&
            t.due_date <= addDays(day, 3) &&
            t.priority !== "Low")),
    )
    .toSorted(
      (a, b) =>
        Number(dueFollowUp(b, day)) - Number(dueFollowUp(a, day)) ||
        priorities.indexOf(b.priority) - priorities.indexOf(a.priority) ||
        (a.due_date || "9999").localeCompare(b.due_date || "9999") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
export function recommendTasks(
  tasks: Task[],
  options: { day?: string; minutes?: number; skipped?: string[] } = {},
) {
  const day = options.day || today(),
    skipped = new Set(options.skipped || []);
  return tasks
    .filter(
      (t) =>
        inFocus(t, day) &&
        (!t.depends_on_id ||
          tasks.some(
            (p) => p.id === t.depends_on_id && p.status === "Completed",
          )) &&
        !skipped.has(t.id) &&
        t.status !== "Blocked" &&
        (!t.start_date || t.start_date <= day) &&
        (actionable(t, day) || dueFollowUp(t, day)) &&
        (!options.minutes ||
          (!!t.effort_minutes && t.effort_minutes <= options.minutes)),
    )
    .map((t) => {
      const chase = dueFollowUp(t, day);
      let score = priorities.indexOf(t.priority) * 25;
      if (chase) score += 250;
      if (t.due_date && t.due_date <= day && t.classification !== "Ongoing")
        score += 200;
      else if (t.due_date && t.due_date >= day && t.due_date <= addDays(day, 3))
        score += 120;
      if (t.next_action) score += 20;
      if (t.updated_at.slice(0, 10) >= addDays(day, -3)) score += 15;
      if (options.minutes && t.classification === "Downtime") score += 30;
      if (t.effort_minutes && t.effort_minutes <= 30) score += 5;
      return {
        task: t,
        score,
        kind: chase ? "follow_up" : "work",
        reason: chase
          ? "Follow-up is due"
          : t.classification !== "Ongoing" && t.due_date && t.due_date <= day
            ? "Deadline needs attention"
            : t.priority === "Critical"
              ? "Critical priority"
              : t.next_action
                ? "A clear next action is ready"
                : "Actionable work you can move forward",
      };
    })
    .toSorted(
      (a, b) =>
        b.score - a.score ||
        (a.task.due_date || "9999").localeCompare(b.task.due_date || "9999") ||
        a.task.id.localeCompare(b.task.id),
    );
}
export function resumeWork(tasks: Task[], projects: Project[], day = today()) {
  return {
    tasks: tasks
      .filter(
        (t) => inFocus(t, day) && !t.assigned_to && t.task_type !== "Delegated",
      )
      .toSorted(
        (a, b) =>
          b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id),
      )
      .slice(0, 5),
    projects: projects
      .filter((p) => !["Completed", "Archived"].includes(p.status))
      .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3),
  };
}
export function isWelcomeBack(previous: string | null, now = new Date()) {
  return (
    !!previous && now.getTime() - new Date(previous).getTime() >= 7 * 86400000
  );
}
