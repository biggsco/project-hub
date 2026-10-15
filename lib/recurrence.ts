import { z } from "zod";
export const recurrenceSchema = z
  .object({
    mode: z.enum(["fixed", "after_completion"]).default("fixed"),
    frequency: z.enum([
      "daily",
      "weekdays",
      "weekly",
      "fortnightly",
      "monthly",
      "quarterly",
      "custom",
      "nth_weekday",
    ]),
    interval: z.number().int().min(1).max(365).default(1),
    unit: z.enum(["days", "weeks", "months"]).default("days"),
    weekday: z.number().int().min(0).max(6).optional(),
    ordinal: z.number().int().min(1).max(4).optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
        "Invalid start date",
      ),
  })
  .refine(
    (v) =>
      v.frequency !== "nth_weekday" ||
      (v.weekday !== undefined && v.ordinal !== undefined),
    "Choose an ordinal and weekday",
  );
export type Recurrence = z.output<typeof recurrenceSchema>;
export const isoAdd = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function monthDate(anchor: string, months: number) {
  const d = new Date(anchor + "T12:00:00Z"),
    n = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(n, last));
  return d.toISOString().slice(0, 10);
}
function nth(
  day: string,
  monthOffset: number,
  weekday: number,
  ordinal: number,
) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthOffset);
  d.setUTCDate(1 + ((weekday - d.getUTCDay() + 7) % 7) + (ordinal - 1) * 7);
  return d.toISOString().slice(0, 10);
}
/** Calendar-only Adelaide dates; never add milliseconds across DST. */
export function nextOccurrence(rule: Recurrence, after: string): string {
  if (rule.frequency === "weekdays") {
    let n = isoAdd(after, 1);
    while ([0, 6].includes(new Date(n + "T12:00:00Z").getUTCDay()))
      n = isoAdd(n, 1);
    return n;
  }
  if (rule.frequency === "nth_weekday") {
    let n = nth(after, 0, rule.weekday!, rule.ordinal!);
    if (n <= after) n = nth(after, 1, rule.weekday!, rule.ordinal!);
    return n;
  }
  const months =
    rule.frequency === "monthly"
      ? 1
      : rule.frequency === "quarterly"
        ? 3
        : rule.frequency === "custom" && rule.unit === "months"
          ? rule.interval
          : 0;
  if (months) {
    const anchor = rule.mode === "after_completion" ? after : rule.start_date;
    const a = new Date(anchor + "T12:00:00Z"),
      b = new Date(after + "T12:00:00Z");
    let count = Math.max(
      0,
      Math.floor(
        ((b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
          b.getUTCMonth() -
          a.getUTCMonth()) /
          months,
      ),
    );
    let n = monthDate(anchor, count * months);
    while (n <= after) n = monthDate(anchor, ++count * months);
    return n;
  }
  const days =
    rule.frequency === "weekly"
      ? 7
      : rule.frequency === "fortnightly"
        ? 14
        : rule.frequency === "custom"
          ? rule.interval * (rule.unit === "weeks" ? 7 : 1)
          : 1;
  if (rule.mode === "after_completion") return isoAdd(after, days);
  const elapsed = Math.floor(
    (Date.parse(after + "T12:00:00Z") -
      Date.parse(rule.start_date + "T12:00:00Z")) /
      86400000,
  );
  return isoAdd(
    rule.start_date,
    (Math.max(0, Math.floor(elapsed / days)) + 1) * days,
  );
}
export function firstOccurrence(rule: Recurrence) {
  if (rule.frequency === "weekdays") {
    const d = new Date(rule.start_date + "T12:00:00Z").getUTCDay();
    return d === 0 || d === 6
      ? nextOccurrence(rule, isoAdd(rule.start_date, -1))
      : rule.start_date;
  }
  if (rule.frequency === "nth_weekday")
    return nextOccurrence(rule, isoAdd(rule.start_date, -1));
  return rule.start_date;
}
export function parseRecurrence(
  text: string,
  day: string,
): { text: string; rule: Recurrence | null; first: string | null } {
  const m = text.match(
    /\s+(every (?:day|weekday|week|fortnight|month|quarter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[1-9]\d? (?:days?|weeks?|months?))|(?:first|second|third|fourth) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday) of each month)$/i,
  );
  if (!m) return { text, rule: null, first: null };
  const title = text.slice(0, m.index).trim();
  if (!title || /\b(?:or|maybe|not|if)\b/i.test(title))
    return { text, rule: null, first: null };
  const s = m[1].toLowerCase(),
    names = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
  let first = day,
    rule: any = {
      mode: "fixed",
      frequency: "daily",
      interval: 1,
      unit: "days",
      start_date: day,
    };
  const ord = s.match(/^(first|second|third|fourth) (\w+) of each month$/);
  if (ord) {
    rule.frequency = "nth_weekday";
    rule.weekday = names.indexOf(ord[2]);
    rule.ordinal = ["first", "second", "third", "fourth"].indexOf(ord[1]) + 1;
    first = nth(day, 0, rule.weekday, rule.ordinal);
    if (first < day) first = nth(day, 1, rule.weekday, rule.ordinal);
  } else if (names.includes(s.slice(6))) {
    rule.frequency = "weekly";
    rule.weekday = names.indexOf(s.slice(6));
    first = isoAdd(
      day,
      (rule.weekday - new Date(day + "T12:00:00Z").getUTCDay() + 7) % 7,
    );
  } else if (s === "every weekday") {
    rule.frequency = "weekdays";
    while ([0, 6].includes(new Date(first + "T12:00:00Z").getUTCDay()))
      first = isoAdd(first, 1);
  } else {
    const presets: Record<string, string> = {
      "every day": "daily",
      "every week": "weekly",
      "every fortnight": "fortnightly",
      "every month": "monthly",
      "every quarter": "quarterly",
    };
    if (presets[s]) rule.frequency = presets[s];
    else {
      const n = s.match(/^every (\d+) (days?|weeks?|months?)$/)!;
      rule.frequency = "custom";
      rule.interval = Number(n[1]);
      rule.unit = n[2].startsWith("week")
        ? "weeks"
        : n[2].startsWith("month")
          ? "months"
          : "days";
    }
  }
  rule.start_date = first;
  return { text: title, rule: recurrenceSchema.parse(rule), first };
}
