"use client";
import { useState } from "react";
import { resolveDate } from "@/lib/capture";
import { today } from "@/lib/model";
const presets = [
  "Today",
  "Tomorrow",
  "This Friday",
  "Next Monday",
  "Next Friday",
  "1 week",
  "2 weeks",
  "1 month",
  "End of month",
  "Someday",
  "No deadline",
];
export default function SmartDate({
  label,
  value,
  someday = false,
  onChange,
  snooze = false,
}: {
  label: string;
  value: string | null;
  someday?: boolean;
  onChange: (date: string | null, someday?: boolean) => void;
  snooze?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  return (
    <div className="smart-date">
      <span className="field-label">{label}</span>
      <details>
        <summary
          aria-label={`${label}: ${value || (someday ? "Someday" : snooze ? "Not snoozed" : "No deadline")}`}
        >
          {value
            ? new Date(value + "T12:00:00Z").toLocaleDateString("en-AU", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : someday
              ? "Someday"
              : snooze
                ? "Not snoozed"
                : "No deadline"}
        </summary>
        <div className="date-presets">
          {(snooze
            ? ["Tomorrow", "Next week", "2 weeks", "1 month", "No deadline"]
            : presets
          ).map((p) => (
            <button
              key={p}
              type="button"
              onClick={(e) => {
                onChange(resolveDate(p, today()), p === "Someday");
                e.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              {p === "No deadline" && snooze ? "Wake now" : p}
            </button>
          ))}
          <button type="button" onClick={() => setCustom(true)}>
            Custom date
          </button>
        </div>
        {custom && (
          <label>
            Choose a date
            <input
              aria-label={label + " custom date"}
              type="date"
              value={value || ""}
              onChange={(e) => {
                onChange(e.target.value || null, false);
                if (e.target.value)
                  e.currentTarget.closest("details")?.removeAttribute("open");
              }}
            />
          </label>
        )}
      </details>
    </div>
  );
}
