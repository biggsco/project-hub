import type { CSSProperties } from "react";
import type { Task, Project } from "./model";
import type { Bucket } from "./organisation";
import type { Team } from "./people";
export type WorkspaceLibrary = {
  teams: Team[];
  buckets: Bucket[];
  projects: Project[];
};
const palette = [
  "#4768cc",
  "#167e81",
  "#8960b5",
  "#bb641f",
  "#6062bc",
  "#33805a",
];
/** Stable across views and devices; aliases share their workspace identity. */
export function workspaceColour(name: string, aliases: string[] = []) {
  const names = [name, ...aliases].map((s) => s.trim().toLowerCase());
  const defaults = [
    ["tp", "technology planning"],
    ["systems", "technology systems"],
    ["gm"],
    ["vwx", "vectorworks", "vectorworks (vwx)"],
    ["momentus"],
    ["myavm", "myavm / sharepoint", "sharepoint"],
  ];
  const index = defaults.findIndex((group) =>
    group.some((s) => names.includes(s)),
  );
  const hash = [...names[0]].reduce(
    (value, c) => (value * 31 + c.charCodeAt(0)) >>> 0,
    0,
  );
  return palette[index < 0 ? hash % palette.length : index];
}
export function workspaceStyle(
  name: string,
  aliases: string[] = [],
): CSSProperties {
  return {
    "--workspace-colour": workspaceColour(name, aliases),
  } as CSSProperties;
}
export function taskWorkspace(task: Task, library: WorkspaceLibrary) {
  return (
    library.buckets.find((v) => v.id === task.bucket_id) ||
    library.teams.find((v) => v.id === task.team_id) ||
    library.projects.find((v) => v.id === task.project_id) || {
      name: "Personal",
      aliases: [],
    }
  );
}
export function taskDate(task: Task) {
  if (
    task.follow_up_date &&
    (!task.due_date || task.follow_up_date < task.due_date)
  )
    return { label: "Follow up", date: task.follow_up_date };
  if (task.due_date) return { label: "Deadline", date: task.due_date };
  if (task.planned_for) return { label: "Flexible", date: task.planned_for };
  return null;
}

export function taskWorkspaceStyle(task: Task, library: WorkspaceLibrary) {
  const space = taskWorkspace(task, library);
  return workspaceStyle(space.name, "aliases" in space ? space.aliases : []);
}
