import { z } from "zod";
import type { Task } from "./model";
import { cleanName } from "./organisation";
const name = z.string().transform(cleanName).pipe(z.string().min(1).max(255));
export const teamSchema = z.object({
  name,
  description: z.string().max(4000).default(""),
  aliases: z.array(name).max(20).default([]),
  archived: z.boolean().default(false),
});
export const personSchema = z.object({
  name,
  notes: z.string().max(4000).default(""),
  team_ids: z.array(z.string().uuid()).max(50).default([]),
  archived: z.boolean().default(false),
});
export type Team = z.output<typeof teamSchema> & { id: string };
export type Person = z.output<typeof personSchema> & { id: string };
export type Directory = { teams: Team[]; people: Person[] };
export const taskTypes = [
  "To Do",
  "Discuss",
  "Follow Up",
  "Delegated",
] as const;
export function inPeopleScope(
  task: Task,
  teams: Team[],
  people: Person[],
  teamId: string | null,
  personId: string | null,
) {
  if (
    personId &&
    task.person_id !== personId &&
    task.assigned_person_id !== personId
  )
    return false;
  if (
    teamId &&
    task.team_id !== teamId &&
    !people.some(
      (p) =>
        (p.id === task.person_id || p.id === task.assigned_person_id) &&
        p.team_ids.includes(teamId),
    )
  )
    return false;
  return (
    !!(teamId || personId) ||
    !!(task.team_id || task.person_id) ||
    task.task_type !== "To Do" ||
    !!task.assigned_to
  );
}
export function meetingItems(
  tasks: Task[],
  people: Person[],
  teamId: string | null,
  personId: string | null,
  day: string,
) {
  return tasks
    .filter(
      (t) =>
        !t.archived &&
        t.status !== "Completed" &&
        inPeopleScope(t, [], people, teamId, personId) &&
        (!t.snoozed_until || t.snoozed_until <= day),
    )
    .toSorted(
      (a, b) =>
        Number(!!b.follow_up_date && b.follow_up_date <= day) -
          Number(!!a.follow_up_date && a.follow_up_date <= day) ||
        ["Discuss", "Follow Up", "Delegated", "To Do"].indexOf(a.task_type) -
          ["Discuss", "Follow Up", "Delegated", "To Do"].indexOf(b.task_type) ||
        b.created_at.localeCompare(a.created_at),
    );
}
