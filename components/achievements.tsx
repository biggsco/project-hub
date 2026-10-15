"use client";
import { useEffect, useState } from "react";
import { type Task, type Project, today, addDays } from "@/lib/model";
import { type Directory, taskTypes } from "@/lib/people";
import { type Bucket } from "@/lib/organisation";
import { achievements } from "@/lib/review";
import {
  achievementSummary,
  achievementCsv,
  achievementPrompt,
  type ProjectCompletion,
} from "@/lib/achievement-export";
export default function Achievements({
  tasks,
  projects,
  buckets,
  directory,
  onOpen,
}: {
  tasks: Task[];
  projects: Project[];
  buckets: Bucket[];
  directory: Directory;
  onOpen: (t: Task) => void;
}) {
  const [filters, setFilters] = useState({
      from: addDays(today(), -30),
      to: today(),
      project: "",
      bucket: "",
      team: "",
      type: "",
    }),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [prompt, setPrompt] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [events, setEvents] = useState<ProjectCompletion[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/data?history=1")
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to load project completion activity.");
        const b = await r.json();
        if (active) setEvents(b.project_completions || []);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const rows = achievements(tasks, filters, directory),
    projectRows = events.filter(
      (e) =>
        (!filters.project || e.entity_id === filters.project) &&
        !filters.bucket &&
        !filters.team &&
        !filters.type &&
        (!filters.from || today(new Date(e.created_at)) >= filters.from) &&
        (!filters.to || today(new Date(e.created_at)) <= filters.to),
    );
  const chosen = rows.filter((t) => selected.includes(t.id)),
    chosenEvents = projectRows.filter((e) => selected.includes(e.id));
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied");
    } catch {
      setPrompt(text);
      setNotice("Select the text below and copy manually.");
    }
  }
  function filter(key: string, value: string) {
    setFilters((v) => ({ ...v, [key]: value }));
    setSelected([]);
    setPage(0);
    setPrompt(null);
  }
  function check(id: string, value: boolean) {
    setSelected((v) => (value ? [...v, id] : v.filter((x) => x !== id)));
    setPrompt(null);
  }
  const empty = !chosen.length && !chosenEvents.length;
  return (
    <section className="panel achievements">
      <h2>Achievements history</h2>
      <p className="muted">
        Recorded task completions and the most recent 500 project completion
        events. Choose exactly what to copy; notes and private progress are
        excluded.
      </p>
      <div className="filters">
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => filter("from", e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => filter("to", e.target.value)}
          />
        </label>
        {(
          [
            ["project", "Project", projects.map((p) => [p.id, p.name])],
            ["bucket", "Bucket", buckets.map((b) => [b.id, b.name])],
            ["team", "Team", directory.teams.map((t) => [t.id, t.name])],
            ["type", "Task type", taskTypes.map((t) => [t, t])],
          ] as [string, string, string[][]][]
        ).map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              value={filters[key as keyof typeof filters]}
              onChange={(e) => filter(key, e.target.value)}
            >
              <option value="">All</option>
              {options.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {filters.from && filters.to && filters.from > filters.to && (
        <p role="alert">The start date must be before the end date.</p>
      )}
      <div className="inline-actions">
        <button
          className="secondary"
          onClick={() => {
            setSelected([
              ...rows.slice(0, 200).map((t) => t.id),
              ...projectRows.slice(0, 50).map((e) => e.id),
            ]);
            setPrompt(null);
          }}
        >
          Select filtered items (up to 250)
        </button>
        <button
          className="text-button"
          onClick={() => {
            setSelected([]);
            setPrompt(null);
          }}
        >
          Clear selection
        </button>
        <span>{chosen.length + chosenEvents.length} selected</span>
      </div>
      {rows.slice(page * 50, page * 50 + 50).map((t) => (
        <div className="achievement-row" key={t.id}>
          <input
            type="checkbox"
            aria-label={`Include achievement ${t.title}`}
            checked={selected.includes(t.id)}
            onChange={(e) => check(t.id, e.target.checked)}
          />
          <button className="task-title" onClick={() => onOpen(t)}>
            <strong>{t.title}</strong>
            <small>
              {today(new Date(t.completed_at!))} · {t.task_type}
            </small>
          </button>
        </div>
      ))}
      {!rows.length && (
        <p className="muted">
          No recorded task completions match these filters.
        </p>
      )}
      {rows.length > 50 && (
        <div className="inline-actions">
          <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.ceil(rows.length / 50)}
          </span>
          <button
            disabled={(page + 1) * 50 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      {!!projectRows.length && (
        <details>
          <summary>Project completion activity ({projectRows.length})</summary>
          {projectRows.map((e) => (
            <label className="context-choice" key={e.id}>
              <input
                type="checkbox"
                checked={selected.includes(e.id)}
                onChange={(v) => check(e.id, v.target.checked)}
              />
              <span>
                {today(new Date(e.created_at))} — Project marked completed:{" "}
                {e.title}
              </span>
            </label>
          ))}
        </details>
      )}
      <div className="inline-actions">
        <button
          className="secondary"
          disabled={empty}
          onClick={() =>
            copy(achievementSummary(chosen, projects, chosenEvents))
          }
        >
          Copy Summary
        </button>
        <button
          className="secondary"
          disabled={empty}
          onClick={() =>
            copy(achievementSummary(chosen, projects, chosenEvents, true))
          }
        >
          Copy as Markdown
        </button>
        <button
          className="secondary"
          disabled={empty}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([achievementCsv(chosen, projects, chosenEvents)], {
                type: "text/csv;charset=utf-8",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "project-hub-achievements.csv";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export CSV
        </button>
        <button
          className="primary"
          disabled={empty}
          onClick={() =>
            setPrompt(
              achievementPrompt(
                achievementSummary(chosen, projects, chosenEvents, true),
              ),
            )
          }
        >
          Generate ChatGPT Summary Prompt
        </button>
      </div>
      {prompt !== null && (
        <div>
          <p className="muted">
            Review or edit before copying. Nothing is sent automatically.
          </p>
          <label>
            Summary prompt
            <textarea
              aria-label="Achievements summary prompt"
              rows={10}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <button className="primary" onClick={() => copy(prompt)}>
            Copy prompt
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
