"use client";
import { today, type Task } from "@/lib/model";
import type { Recurrence } from "@/lib/recurrence";
export default function RecurrenceControls({
  task,
  onChange,
  series,
  onAction,
}: {
  task: Task;
  onChange: (rule: Recurrence | null) => void;
  series?: any;
  onAction?: (operation: string) => void;
}) {
  const rule = task.recurrence_rule;
  const update = (patch: Partial<Recurrence>) =>
    onChange({ ...rule!, ...patch });
  return (
    <fieldset className="recurrence-controls">
      <legend>Repeat</legend>
      <select
        aria-label="Repeat schedule"
        value={rule?.frequency || "none"}
        onChange={(e) =>
          onChange(
            e.target.value === "none"
              ? null
              : {
                  frequency: e.target.value as Recurrence["frequency"],
                  mode: "fixed",
                  interval: 1,
                  unit: "days",
                  start_date: task.due_date || today(),
                  ...(e.target.value === "nth_weekday"
                    ? { weekday: 5, ordinal: 1 }
                    : {}),
                },
          )
        }
      >
        {[
          ["none", "Does not repeat"],
          ["daily", "Daily"],
          ["weekdays", "Weekdays"],
          ["weekly", "Weekly"],
          ["fortnightly", "Fortnightly"],
          ["monthly", "Monthly"],
          ["quarterly", "Quarterly"],
          ["nth_weekday", "Weekday of each month"],
          ["custom", "Custom interval"],
        ].map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {rule && (
        <>
          <label>
            Repeats
            <select
              aria-label="Recurrence behaviour"
              value={rule.mode}
              onChange={(e) =>
                update({ mode: e.target.value as Recurrence["mode"] })
              }
            >
              <option value="fixed">On a fixed schedule</option>
              <option value="after_completion">After completion</option>
            </select>
          </label>
          <label>
            Schedule starts
            <input
              type="date"
              value={rule.start_date}
              onChange={(e) => update({ start_date: e.target.value })}
            />
          </label>
          {rule.frequency === "custom" && (
            <div className="two-cols">
              <label>
                Every
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={rule.interval}
                  onChange={(e) => update({ interval: Number(e.target.value) })}
                />
              </label>
              <label>
                Interval
                <select
                  value={rule.unit}
                  onChange={(e) =>
                    update({ unit: e.target.value as Recurrence["unit"] })
                  }
                >
                  {["days", "weeks", "months"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {rule.frequency === "nth_weekday" && (
            <div className="two-cols">
              <select
                aria-label="Ordinal"
                value={rule.ordinal}
                onChange={(e) => update({ ordinal: Number(e.target.value) })}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {["First", "Second", "Third", "Fourth"][n - 1]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Recurring weekday"
                value={rule.weekday}
                onChange={(e) => update({ weekday: Number(e.target.value) })}
              >
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="muted">
            Each occurrence has separate notes and history. Missed fixed dates
            are coalesced, with at most two open occurrences.
          </p>
          {task.recurrence_series_id && onAction && (
            <div className="inline-actions">
              <span>
                {series?.stopped
                  ? "Stopped"
                  : series?.paused
                    ? "Paused"
                    : "Active"}
                {series?.next_date ? ` · Next ${series.next_date}` : ""}
              </span>
              {!series?.stopped && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      onAction(series?.paused ? "resume" : "pause")
                    }
                  >
                    {series?.paused ? "Resume recurrence" : "Pause recurrence"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onAction("stop")}
                  >
                    Stop recurrence
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
