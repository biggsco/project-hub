import { taskTypes, type Directory } from "./people";
import { canonicalTags, nameKey, type Bucket, type Tag } from "./organisation";
import {
  addDays,
  today,
  taskSchema,
  type Task,
  priorities,
  type CaptureDefaults,
} from "./model";

export const classifications = ["Standard", "Downtime", "Ongoing"] as const;
export const efforts = [
  [15, "15 minutes"],
  [30, "30 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
  [240, "Half day"],
  [960, "Multi-day"],
] as const;
const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
export function addMonths(day: string, count: number) {
  const d = new Date(day + "T12:00:00Z");
  const date = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + count);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(date, last));
  return d.toISOString().slice(0, 10);
}
/** Bare weekdays include today; next weekdays belong to the following Mon–Sun week. */
export function resolveDate(expression: string, day = today()): string | null {
  const s = expression.trim().toLowerCase();
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  if (s === "today") return day;
  if (s === "tomorrow") return addDays(day, 1);
  if (s === "next week") return addDays(day, 7 - mondayOffset);
  if (s === "end of week") return addDays(day, (5 - weekday + 7) % 7);
  if (s === "end of month") {
    const d = new Date(day + "T12:00:00Z");
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
  }
  const w = s.match(
    /^(?:(next|this) )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (w) {
    const target = weekdays.indexOf(w[2]);
    return addDays(
      day,
      w[1] === "next"
        ? 7 - mondayOffset + ((target + 6) % 7)
        : (target - weekday + 7) % 7,
    );
  }
  const relative = s.match(/^(?:in )?([1-9]\d{0,2}) (days?|weeks?|months?)$/);
  if (relative) {
    const n = Number(relative[1]);
    return relative[2].startsWith("month")
      ? addMonths(day, n)
      : addDays(day, n * (relative[2].startsWith("week") ? 7 : 1));
  }
  // Only ISO and explicit Australian day/month/year dates are accepted. No year guessing.
  let specific = s;
  const au = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (au)
    specific = `${au[3]}-${au[2].padStart(2, "0")}-${au[1].padStart(2, "0")}`;
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(specific) &&
    taskSchema.safeParse({ title: "date", due_date: specific }).success
  )
    return specific;
  return null;
}
export function parseCapture(input: string, day = today()) {
  const original = input.trim();
  let title = original;
  let classification: (typeof classifications)[number] = "Standard";
  const prefix = title.match(/^(downtime|ongoing)\s*[-:]\s*(.+)$/i);
  if (prefix) {
    classification =
      prefix[1].toLowerCase() === "downtime" ? "Downtime" : "Ongoing";
    title = prefix[2].trim();
  }
  // Dates must be a suffix. Multiple expressions and conditional phrases are preserved.
  const suffix = title.match(
    /\s+(?:(?:due|on)\s+)?(today|tomorrow|(?:(?:next|this) )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next week|in [1-9]\d{0,2} (?:days?|weeks?|months?)|end of (?:week|month)|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/i,
  );
  let due_date: string | null = null;
  if (suffix) {
    const candidate = title.slice(0, suffix.index).trim();
    const ambiguous =
      /\b(?:or|and|not|if|maybe|before|after|until|by|from|every)\b|\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        candidate,
      );
    const date = resolveDate(suffix[1], day);
    if (candidate && !ambiguous && date) {
      title = candidate;
      due_date = date;
    }
  }
  return { title, classification, due_date };
}
export function previewBulk(text: string, day = today()) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseCapture(s, day));
}
export function actionable(t: Task, day = today()) {
  return (
    (t.content_type || "Task") === "Task" &&
    !t.archived &&
    t.status !== "Completed" &&
    t.status !== "Waiting" &&
    t.status !== "Blocked" &&
    !t.assigned_to &&
    !["Discuss", "Delegated"].includes(t.task_type) &&
    (t.task_type !== "Follow Up" ||
      !t.follow_up_date ||
      t.follow_up_date <= day) &&
    (!t.snoozed_until || t.snoozed_until <= day) &&
    (!t.start_date || t.start_date <= day) &&
    t.date_preferences.due_date !== "Someday"
  );
}
export function suitableTasks(tasks: Task[], minutes: number, day = today()) {
  return tasks
    .filter(
      (t) =>
        actionable(t, day) && t.effort_minutes && t.effort_minutes <= minutes,
    )
    .sort(
      (a, b) =>
        Number(b.classification === "Downtime") -
          Number(a.classification === "Downtime") ||
        priorities.indexOf(b.priority) - priorities.indexOf(a.priority) ||
        (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
}
export function assignmentChange(
  previous: Pick<
    Task,
    "assigned_to" | "date_assigned" | "follow_up_date" | "assignment_notes"
  >,
  name: string,
  day = today(),
) {
  const assigned_to = name.trim();
  return {
    assigned_to,
    date_assigned: assigned_to
      ? assigned_to === previous.assigned_to
        ? previous.date_assigned || day
        : day
      : null,
    follow_up_date: assigned_to ? previous.follow_up_date : null,
    assignment_notes: assigned_to ? previous.assignment_notes : "",
  };
}

/** Explicit metadata prefixes may be removed; incidental bucket words always remain. */
export function parseTaskInput(
  input: string,
  buckets: Bucket[] = [],
  tags: Tag[] = [],
  day = today(),
  defaults: CaptureDefaults = {},
  directory: Directory = { teams: [], people: [] },
) {
  let text = input.trim();
  let bucket_id = defaults.bucket_id || null;
  let classification = defaults.classification || "Standard";
  let task_type = defaults.task_type || "To Do";
  let team_id = defaults.team_id || null,
    person_id = defaults.person_id || null;
  const teams = directory.teams.filter((t) => !t.archived),
    people = directory.people.filter((p) => !p.archived);
  const active = buckets.filter((b) => !b.archived);
  const matches = (name: string) =>
    active.filter((b) =>
      [b.name, ...b.aliases].some((a) => nameKey(a) === nameKey(name)),
    );
  // Up to one classification and one bucket prefix, in either order.
  let gotClass = false,
    gotBucket = false;
  for (let i = 0; i < 5; i++) {
    const prefix =
      text.match(/^(.+?)\s+[-:]\s*(.+)$/) || text.match(/^([^:]+):\s*(.+)$/);
    if (!prefix) break;
    const key = nameKey(prefix[1]);
    const type = taskTypes.find((t) => nameKey(t) === key.replace(/-/g, " "));
    if (type) {
      task_type = type;
      text = prefix[2].trim();
      continue;
    }
    const matchingTeams = teams.filter((t) =>
      [t.name, ...t.aliases].some((n) => nameKey(n) === key),
    );
    if (matchingTeams.length === 1) team_id = matchingTeams[0].id;
    const matchingPeople = people.filter((p) => nameKey(p.name) === key);
    if (matchingPeople.length === 1) {
      person_id = matchingPeople[0].id;
      text = prefix[2].trim();
      continue;
    }

    if (
      !gotClass &&
      ["standard", "downtime", "ongoing", "inbox"].includes(key)
    ) {
      classification =
        key === "downtime"
          ? "Downtime"
          : key === "ongoing"
            ? "Ongoing"
            : "Standard";
      gotClass = true;
      text = prefix[2].trim();
      continue;
    }
    const found = matches(prefix[1]);
    if (!gotBucket && found.length === 1) {
      bucket_id = found[0].id;
      gotBucket = true;
      text = prefix[2].trim();
      continue;
    }
    if (matchingTeams.length === 1) {
      text = prefix[2].trim();
      continue;
    }
    break;
  }
  if (/^discuss\b/i.test(text) && task_type === "To Do") task_type = "Discuss";
  const mentions = (names: string[], haystack: string) =>
    names.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        "(^|[^\\p{L}\\p{N}])" + escaped + "(?=$|[^\\p{L}\\p{N}])",
        "iu",
      ).test(haystack);
    });
  const mentionedTeams = teams.filter((t) =>
    mentions([t.name, ...t.aliases], text),
  );
  if (!team_id && mentionedTeams.length === 1) team_id = mentionedTeams[0].id;
  const withPerson = text.match(
    /\bwith\s+(.+?)(?=\s+(?:today|tomorrow|next|in \d)|$)/i,
  );
  const mentionedPeople = withPerson
    ? people.filter((p) => nameKey(p.name) === nameKey(withPerson[1]))
    : [];
  if (!person_id && mentionedPeople.length === 1)
    person_id = mentionedPeople[0].id;
  const hashtagNames: string[] = [];
  const withoutTags = text
    .replace(
      /(^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]{0,59})(?=\s|$)/gu,
      (whole, space, tag) => {
        const known = tags.find(
          (t) =>
            nameKey(t.name).replace(/[ _-]+/g, "-") ===
            nameKey(tag).replace(/[ _-]+/g, "-"),
        );
        hashtagNames.push(known?.name || tag);
        return space;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
  if (withoutTags) text = withoutTags;
  else hashtagNames.length = 0;
  const parsed =
    defaults.content_type && defaults.content_type !== "Task"
      ? { title: text, classification, due_date: null }
      : parseCapture(text, day);
  // parseCapture handles tight class prefixes as well (e.g. Ongoing-task).
  if (parsed.classification !== "Standard")
    classification = parsed.classification;
  if (!gotBucket) {
    const mentions = active.filter((b) =>
      [b.name, ...b.aliases].some((alias) => {
        if (alias.length < 3) return false;
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(
          "(^|[^\\p{L}\\p{N}])" + escaped + "(?=$|[^\\p{L}\\p{N}])",
          "iu",
        ).test(parsed.title);
      }),
    );
    if (mentions.length === 1) bucket_id = mentions[0].id;
  }
  const isChase = task_type === "Follow Up" || task_type === "Delegated";
  const due_date =
    defaults.content_type && defaults.content_type !== "Task"
      ? null
      : (!isChase && parsed.due_date) || defaults.due_date || null;
  const follow_up_date =
    (isChase && parsed.due_date) || defaults.follow_up_date || null;
  const date_preferences = { ...defaults.date_preferences };
  if (parsed.due_date && !isChase) delete date_preferences.due_date;
  return {
    title: parsed.title,
    ...(defaults.content_type ? { content_type: defaults.content_type } : {}),
    classification,
    bucket_id,
    project_id: defaults.project_id || null,
    task_type,
    team_id,
    person_id,
    follow_up_date,
    due_date,
    date_preferences,
    tags: canonicalTags([...(defaults.tags || []), ...hashtagNames], tags),
  };
}
export function boundedPreview(
  text: string,
  buckets: Bucket[],
  tags: Tag[],
  day = today(),
  defaults: CaptureDefaults = {},
  directory: Directory = { teams: [], people: [] },
) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    count: lines.length,
    items: lines
      .slice(0, 200)
      .map((line) =>
        parseTaskInput(line, buckets, tags, day, defaults, directory),
      ),
  };
}

export function captureContextDefaults(
  section: string,
  bucket_id: string | null = null,
  project_id: string | null = null,
  contacts: {
    team_id?: string | null;
    person_id?: string | null;
    meeting?: boolean;
  } = {},
): CaptureDefaults {
  return {
    bucket_id,
    project_id,
    team_id: contacts.team_id || null,
    person_id: contacts.person_id || null,
    task_type:
      section === "People & Teams" && contacts.meeting ? "Discuss" : "To Do",
    follow_up_date: null,
    classification:
      section === "Downtime"
        ? "Downtime"
        : section === "Ongoing"
          ? "Ongoing"
          : "Standard",
    due_date: null,
    tags: [],
    date_preferences: {},
  };
}
