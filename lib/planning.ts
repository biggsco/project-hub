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
