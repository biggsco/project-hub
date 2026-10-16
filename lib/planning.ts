import type { Task } from "./model";
import { today, addDays } from "./model";
import { recommendTasks } from "./productivity";
export function suggestedPlan(
  tasks: Task[],
  day = today(),
  skipped: string[] = [],
) {
  const ranked = recommendTasks(tasks, { day, skipped })
    .filter(
      ({ task: t }) =>
        (!t.planned_for || t.planned_for <= addDays(day, 6)) &&
        (!t.suggested_start || t.suggested_start <= addDays(day, 6)),
    )
    .map((r) => ({
      ...r,
      score:
        r.score +
        (r.task.planned_for && r.task.planned_for <= day ? 70 : 0) +
        (r.task.suggested_start && r.task.suggested_start <= day ? 25 : 0),
    }))
    .toSorted(
      (a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id),
    );
  const todayTasks = ranked
    .filter(({ task: t }) =>
      t.planned_for
        ? t.planned_for <= day
        : !t.suggested_start || t.suggested_start <= day,
    )
    .slice(0, 3)
    .map((r) => r.task);
  return {
    today: todayTasks,
    week: ranked
      .filter((r) => !todayTasks.some((t) => t.id === r.task.id))
      .slice(0, 5)
      .map((r) => r.task),
  };
}

export const planningLanes = [
  "Today",
  "Tomorrow",
  "This Week",
  "Later",
] as const;
export type PlanningLane = (typeof planningLanes)[number];
/** Only personal work dates change. Firm deadlines and follow-ups are independent. */
export function planningPatch(
  lane: PlanningLane,
  day = today(),
): Pick<Task, "planned_for"> {
  return {
    planned_for:
      lane === "Today"
        ? day
        : addDays(day, lane === "Tomorrow" ? 1 : lane === "This Week" ? 2 : 7),
  };
}
export function planningBoard(tasks: Task[], day = today()) {
  const suggestions = suggestedPlan(tasks, day),
    todayIds = new Set(suggestions.today.map((t) => t.id));
  const board: Record<PlanningLane, Task[]> = {
    Today: [],
    Tomorrow: [],
    "This Week": [],
    Later: [],
  };
  for (const { task } of recommendTasks(tasks, { day })) {
    if (task.parent_id || (task.recurrence_date && task.recurrence_date > day))
      continue;
    const date = task.planned_for || task.suggested_start;
    const lane: PlanningLane = date
      ? date <= day
        ? "Today"
        : date === addDays(day, 1)
          ? "Tomorrow"
          : date <= addDays(day, 6)
            ? "This Week"
            : "Later"
      : todayIds.has(task.id)
        ? "Today"
        : "Later";
    board[lane].push(task);
  }
  return board;
}
