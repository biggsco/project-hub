import { z } from "zod";
export const statuses = [
  "Inbox",
  "To Do",
  "In Progress",
  "Waiting",
  "Blocked",
  "Completed",
] as const;
export const priorities = ["Low", "Medium", "High", "Critical"] as const;
export const projectStatuses = [
  "Planned",
  "Active",
  "On Hold",
  "Completed",
  "Archived",
] as const;
const date = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
        "Invalid date",
      ),
  ])
  .transform((s) => s || null)
  .nullable();
const id = z.string().uuid().nullable();
const datePreferences = z.record(z.string(), z.literal("Someday")).default({});
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20000).default(""),
  notes: z.string().max(20000).default(""),
  status: z.enum(statuses).default("Inbox"),
  priority: z.enum(priorities).default("Medium"),
  project_id: id.default(null),
  parent_id: id.default(null),
  bucket_id: id.default(null),
  start_date: date.default(null),
  due_date: date.default(null),
  person: z.string().max(255).default(""),
  classification: z.enum(["Inbox", "Downtime", "Ongoing"]).default("Inbox"),
  assigned_to: z.string().trim().max(255).default(""),
  date_assigned: date.default(null),
  assignment_notes: z.string().max(20000).default(""),
  follow_up_date: date.default(null),
  effort_minutes: z
    .union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
      z.literal(120),
      z.literal(240),
      z.literal(960),
    ])
    .nullable()
    .default(null),
  snoozed_until: date.default(null),
  next_action: z.string().max(2000).default(""),
  is_milestone: z.boolean().default(false),
  date_preferences: datePreferences,
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  archived: z.boolean().default(false),
});
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(20000).default(""),
  notes: z.string().max(20000).default(""),
  category: z.string().max(100).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  status: z.enum(projectStatuses).default("Active"),
  priority: z.enum(priorities).default("Medium"),
  start_date: date.default(null),
  target_date: date.default(null),
  actual_date: date.default(null),
  next_action: z.string().max(2000).default(""),
  date_preferences: datePreferences,
});
export type Task = z.output<typeof taskSchema> & {
  id: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Project = z.output<typeof projectSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};
export function today(now = new Date(), timezone = "Australia/Adelaide") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(s: string, n: number) {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function stats(tasks: Task[], projects: Project[], day = today()) {
  const open = tasks.filter(
    (t) =>
      !t.archived &&
      t.status !== "Completed" &&
      (!t.snoozed_until || t.snoozed_until <= day),
  );
  return {
    outstanding: open.length,
    today: open.filter((t) => t.due_date === day).length,
    overdue: open.filter(
      (t) => t.classification !== "Ongoing" && t.due_date && t.due_date < day,
    ).length,
    week: open.filter(
      (t) => t.due_date && t.due_date > day && t.due_date <= addDays(day, 7),
    ).length,
    high: open.filter((t) => ["High", "Critical"].includes(t.priority)).length,
    waiting: open.filter((t) => t.status === "Waiting" || !!t.assigned_to)
      .length,
    projects: projects.filter((p) => p.status === "Active").length,
  };
}
export function progress(tasks: Task[], id: string) {
  const rows = tasks.filter((t) => t.project_id === id && !t.archived);
  return rows.length
    ? Math.round(
        (rows.filter((t) => t.status === "Completed").length / rows.length) *
          100,
      )
    : null;
}

export const captureDefaultsSchema = z.object({
  bucket_id: id.optional(),
  classification: z.enum(["Inbox", "Downtime", "Ongoing"]).optional(),
  due_date: date.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  date_preferences: z.record(z.string(), z.literal("Someday")).optional(),
});
export type CaptureDefaults = z.output<typeof captureDefaultsSchema>;
