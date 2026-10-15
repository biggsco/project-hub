import { parseRecurrence, isoAdd } from "./recurrence";
import type { Recurrence } from "./recurrence";
/** Only explicit, bounded patterns. No interpretation of conditional or alternative dates. */
export function captureIntent(
  text: string,
  day: string,
  taskType: string,
  resolve: (s: string, d?: string) => string | null,
) {
  let title = text,
    recurrence: Recurrence | null = null,
    recurrenceDate: string | null = null;
  const repeat = parseRecurrence(title, day);
  if (repeat.rule) {
    title = repeat.text;
    recurrence = repeat.rule;
    recurrenceDate = repeat.first;
  }
  const flex = title.match(/\s+(sometime next week|eventually)$/i);
  if (flex) {
    const candidate = title.slice(0, flex.index).trim();
    if (candidate && !/\b(?:maybe|or|not|if)\b/i.test(candidate)) {
      const monday = resolve("next week", day)!;
      return {
        title: candidate,
        kind: "suggested" as const,
        date: null,
        start: flex[1].toLowerCase() === "eventually" ? null : monday,
        end: flex[1].toLowerCase() === "eventually" ? null : isoAdd(monday, 4),
        someday: flex[1].toLowerCase() === "eventually",
        recurrence,
        recurrenceDate,
      };
    }
  }
  const firm = title.match(/\s+(?:by|deadline)\s+(.+)$/i);
  if (firm) {
    const candidate = title.slice(0, firm.index).trim(),
      date = resolve(firm[1], day);
    if (
      candidate &&
      date &&
      !/\b(?:or|maybe|not|if|tomorrow|next week)\b/i.test(candidate)
    )
      return {
        title: candidate,
        kind: "deadline" as const,
        date,
        start: null,
        end: null,
        someday: false,
        recurrence,
        recurrenceDate,
      };
    return {
      title: text,
      kind: null,
      date: null,
      start: null,
      end: null,
      someday: false,
      recurrence: null,
      recurrenceDate: null,
    };
  }
  const chase =
    /^(?:chase\b|follow[ -]?up\b)/i.test(title) ||
    ["Follow Up", "Delegated"].includes(taskType);
  return {
    title,
    kind: chase ? ("follow_up" as const) : null,
    date: null,
    start: null,
    end: null,
    someday: false,
    recurrence,
    recurrenceDate,
  };
}
