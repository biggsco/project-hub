"use client";
import { useEffect, useRef, useState } from "react";
import type { Task, Project } from "@/lib/model";
import type { Bucket } from "@/lib/organisation";
import type { Directory } from "@/lib/people";
export default function CommandBar({
  tasks,
  projects,
  buckets,
  directory,
  onTask,
  onProject,
  onBucket,
  onContact,
  onNavigate,
  recentKey,
}: {
  tasks: Task[];
  projects: Project[];
  buckets: Bucket[];
  directory: Directory;
  onTask: (t: Task) => void;
  onProject: (p: Project) => void;
  onBucket: (id: string) => void;
  onContact: (team: string | null, person: string | null) => void;
  onNavigate: (s: string) => void;
  recentKey: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    [recent, setRecent] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    prior = useRef<HTMLElement | null>(null);
  function close() {
    dialog.current?.close();
    setOpen(false);
    prior.current?.focus();
  }
  function launch() {
    prior.current = document.activeElement as HTMLElement;
    setOpen(true);
    setQuery("");
    setIndex(0);
    try {
      setRecent(
        JSON.parse(localStorage.getItem(recentKey) || "[]")
          .filter((x: unknown) => typeof x === "string")
          .slice(0, 10),
      );
    } catch {}
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        launch();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      input.current?.focus();
    }
  }, [open]);
  const q = query.trim().toLowerCase(),
    results: { id: string; label: string; run: () => void }[] = [];
  results.push({
    id: "add",
    label: q ? `Add task: ${query.trim()}` : "Add task",
    run: () => {
      close();
      if (query.trim())
        window.dispatchEvent(
          new CustomEvent("hub-quick-capture", { detail: query.trim() }),
        );
      const e = document.querySelector<HTMLInputElement>(
        '[aria-label="Quick Add task"]',
      );
      e?.focus();
      e?.scrollIntoView({ block: "center" });
    },
  });
  const matched = q
    ? tasks
        .filter((t) =>
          [t.title, t.description, t.next_action, ...t.tags]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 12)
    : (recent
        .map((id) => tasks.find((t) => t.id === id))
        .filter(Boolean) as Task[]);
  for (const t of matched)
    results.push({
      id: t.id,
      label: `${q ? "Task" : "Recent"}: ${t.title}`,
      run: () => onTask(t),
    });
  if (q) {
    for (const p of projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 5))
      results.push({
        id: p.id,
        label: `Project: ${p.name}`,
        run: () => onProject(p),
      });
    for (const b of buckets
      .filter(
        (b) =>
          !b.archived &&
          [b.name, ...b.aliases].some((n) => n.toLowerCase().includes(q)),
      )
      .slice(0, 5))
      results.push({
        id: b.id,
        label: `Bucket: ${b.name}`,
        run: () => onBucket(b.id),
      });
    for (const t of directory.teams
      .filter((t) => !t.archived && t.name.toLowerCase().includes(q))
      .slice(0, 5))
      results.push({
        id: t.id,
        label: `Team: ${t.name}`,
        run: () => onContact(t.id, null),
      });
    for (const p of directory.people
      .filter((p) => !p.archived && p.name.toLowerCase().includes(q))
      .slice(0, 5))
      results.push({
        id: p.id,
        label: `Person: ${p.name}`,
        run: () => onContact(null, p.id),
      });
  }
  for (const s of [
    "Dashboard",
    "Inbox",
    "My Tasks",
    "Suggested Plan",
    "Focus tools",
    "Projects",
    "Downtime",
    "People & Teams",
    "Calendar",
    "Follow-up Radar",
    "Weekly Reset",
    "Achievements",
    "Ideas & Notes",
  ]) {
    const label =
      s === "Dashboard"
        ? "Home"
        : s === "People & Teams"
          ? "People"
          : s === "My Tasks"
            ? "Work"
            : s;
    if (!q || label.toLowerCase().includes(q) || s.toLowerCase().includes(q))
      results.push({
        id: s,
        label: `Go to ${label}`,
        run: () => onNavigate(s),
      });
  }
  function run(i: number) {
    const result = results[i];
    if (!result) return;
    close();
    result.run();
  }
  return (
    <>
      <button className="secondary command-launch" onClick={launch}>
        Search / commands <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label="Search and commands"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="section-heading">
          <h2>Search & commands</h2>
          <button onClick={close} aria-label="Close commands">
            Close
          </button>
        </div>
        <input
          ref={input}
          value={query}
          aria-label="Command search"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={`command-${Math.min(index, results.length - 1)}`}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => (i + 1) % results.length);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => (i + results.length - 1) % results.length);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              run(index);
            }
          }}
        />
        <div id="command-results" role="listbox" aria-label="Command results">
          {results.map((r, i) => (
            <button
              id={`command-${i}`}
              role="option"
              aria-selected={i === index}
              className={i === index ? "selected" : ""}
              key={r.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}
