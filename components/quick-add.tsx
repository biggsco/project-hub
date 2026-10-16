"use client";
import { taskWorkspaceStyle } from "@/lib/workspace-style";
import { recoverCaptures, recoverDraft } from "@/lib/capture-drafts";
import { taskTypes, type Team, type Person } from "@/lib/people";
import PeoplePicker from "./people-picker";
import { useEffect, useRef, useState } from "react";
import {
  parseTaskInput,
  boundedPreview,
  captureContextDefaults,
} from "@/lib/capture";
import { today, type Task, type CaptureDefaults } from "@/lib/model";
import { type Bucket, type Tag } from "@/lib/organisation";
import BucketPicker from "./bucket-picker";
import TagPicker from "./tag-picker";
import SmartDate from "./smart-date";
type Submission = {
  request_id: string;
  lines: string[];
  defaults: CaptureDefaults;
};
export default function QuickAdd({
  onCreated,
  draftKey,
  compact = false,
  buckets,
  tags,
  onCreateBucket,
  contextBucket,
  contextSection = "Dashboard",
  contextKey,
  contextProject = null,
  projectName,
  teams,
  people,
  contextTeam = null,
  contextPerson = null,
  meeting = false,
}: {
  draftKey?: string;
  compact?: boolean;
  buckets: Bucket[];
  tags: Tag[];
  onCreateBucket: (name: string) => Promise<Bucket | null>;
  contextBucket?: string | null;
  contextSection?: string;
  contextKey: string;
  contextProject?: string | null;
  projectName?: string;
  teams: Team[];
  people: Person[];
  contextTeam?: string | null;
  contextPerson?: string | null;
  meeting?: boolean;
  onCreated: (
    records: Task[],
    tags: Tag[],
    directory?: { teams: Team[]; people: Person[] },
  ) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const bulkLock = useRef(false);
  const [text, setText] = useState("");
  const [literal, setLiteral] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [contentType, setContentType] = useState<Task["content_type"]>("Task");
  const [bulk, setBulk] = useState(false);
  const [dump, setDump] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [receipt, setReceipt] = useState<Submission | null>(null);
  const [failed, setFailed] = useState<Submission[]>([]);
  const [saving, setSaving] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [classification, setClassification] =
    useState<Task["classification"]>("Standard");
  const [projectId, setProjectId] = useState<string | null>(contextProject);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [someday, setSomeday] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string | null>(contextTeam);
  const [personId, setPersonId] = useState<string | null>(contextPerson);
  const [taskType, setTaskType] = useState<Task["task_type"]>("To Do");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const defaults: CaptureDefaults = {
    ...(literal ? { literal: true } : {}),
    content_type: contentType,
    bucket_id: bucketId,
    team_id: teamId,
    person_id: personId,
    task_type: taskType,
    follow_up_date: followUp,
    classification,
    project_id: projectId,
    due_date: dueDate,
    tags: selectedTags,
    date_preferences: someday ? { due_date: "Someday" } : {},
  };
  const parsed = parseTaskInput(text, buckets, tags, today(), defaults, {
    teams,
    people,
  });
  const { count: previewCount, items: preview } = boundedPreview(
    dump,
    buckets,
    tags,
    today(),
    defaults,
    { teams, people },
  );
  useEffect(() => {
    try {
      setRecent(
        JSON.parse(localStorage.getItem("hub-recent-buckets") || "[]")
          .filter((x: unknown) => typeof x === "string")
          .slice(0, 10),
      );
    } catch {}
  }, []);
  function applyDefaults(values: CaptureDefaults) {
    setLiteral(false);
    setContentType(values.content_type || "Task");
    setBucketId(values.bucket_id || null);
    setTeamId(values.team_id || null);
    setPersonId(values.person_id || null);
    setTaskType(values.task_type || "To Do");
    setFollowUp(null);
    setProjectId(values.project_id || null);
    setClassification(values.classification || "Standard");
    setDueDate(null);
    setSomeday(false);
    setSelectedTags([]);
    setReceipt(null);
  }
  useEffect(() => {
    applyDefaults(
      captureContextDefaults(
        contextSection,
        contextBucket || null,
        contextProject,
        { team_id: contextTeam, person_id: contextPerson, meeting },
      ),
    );
  }, [
    contextKey,
    contextSection,
    contextBucket,
    contextProject,
    contextTeam,
    contextPerson,
    meeting,
  ]);
  useEffect(() => {
    if (teamId && teams.find((t) => t.id === teamId)?.archived) setTeamId(null);
    if (personId && people.find((p) => p.id === personId)?.archived)
      setPersonId(null);
  }, [teams, people, teamId, personId]);
  useEffect(() => {
    if (bucketId && buckets.find((b) => b.id === bucketId)?.archived)
      setBucketId(null);
  }, [buckets, bucketId]);
  useEffect(() => {
    setReceipt(null);
  }, [
    bucketId,
    classification,
    dueDate,
    someday,
    selectedTags,
    projectId,
    teamId,
    personId,
    taskType,
    followUp,
    contentType,
  ]);
  useEffect(() => {
    if (draftKey) {
      try {
        setText(recoverDraft(localStorage.getItem(draftKey + ":draft")));
        setFailed(recoverCaptures(localStorage.getItem(draftKey + ":pending")));
      } catch {}
    }
    setDraftLoaded(true);
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && draftLoaded) {
      try {
        localStorage.setItem(draftKey + ":draft", text);
      } catch {}
    }
  }, [text, draftKey, draftLoaded]);
  function persistPending(submission: Submission, remove = false) {
    if (!draftKey) return;
    try {
      const pending = recoverCaptures(
        localStorage.getItem(draftKey + ":pending"),
      ).filter((s) => s.request_id !== submission.request_id);
      if (!remove) pending.push(submission);
      localStorage.setItem(draftKey + ":pending", JSON.stringify(pending));
    } catch {
      setError(
        "Device storage is unavailable. Keep this page open until the save is confirmed.",
      );
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const editing =
        e.target instanceof HTMLElement &&
        e.target.matches(
          "input,textarea,select,button,a,summary,[role=combobox],[contenteditable=true]",
        );
      if (!editing && e.key === "q" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        input.current?.focus();
        input.current?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function send(submission: Submission) {
    persistPending(submission);
    setSaving((n) => n + 1);
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "capture", ...submission }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to capture tasks.");
      onCreated(b.records, b.tags || [], {
        teams: b.teams || teams,
        people: b.people || people,
      });
      persistPending(submission, true);
      setError("");
      const used = b.records
        .map((t: Task) => t.bucket_id)
        .filter(Boolean) as string[];
      setRecent((previous) => {
        const next = [...new Set([...used, ...previous])].slice(0, 10);
        try {
          localStorage.setItem("hub-recent-buckets", JSON.stringify(next));
        } catch {}
        return next;
      });
      setFailed((items) =>
        items.filter((item) => item.request_id !== submission.request_id),
      );
      setNotice(
        `${submission.lines.length === 1 ? "Task" : submission.lines.length + " tasks"} added`,
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving((n) => n - 1);
    }
  }
  useEffect(() => {
    function capture(e: Event) {
      const title = (e as CustomEvent<string>).detail?.trim();
      if (!title) return;
      const submission = {
        request_id: crypto.randomUUID(),
        lines: [title],
        defaults,
      };
      setText("");
      input.current?.focus();
      send(submission).then((ok) => {
        if (!ok)
          setFailed((items) => [
            ...items.filter((s) => s.request_id !== submission.request_id),
            submission,
          ]);
      });
    }
    window.addEventListener("hub-quick-capture", capture);
    return () => window.removeEventListener("hub-quick-capture", capture);
  });
  return (
    <section
      className={"quick-add" + (compact ? " compact-capture" : "")}
      aria-label="Quick Add"
      onKeyDown={(e) => {
        if (e.key === "Escape")
          e.currentTarget
            .querySelectorAll("details[open]")
            .forEach((d) => d.removeAttribute("open"));
      }}
    >
      <form
        className="capture"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const submission = {
            request_id: crypto.randomUUID(),
            lines: [text.trim()],
            defaults,
          };
          setText("");
          setError("");
          input.current?.focus();
          if (!(await send(submission)))
            setFailed((items) => [
              ...items.filter((s) => s.request_id !== submission.request_id),
              submission,
            ]);
        }}
      >
        <input
          ref={input}
          aria-label="Quick Add task"
          autoComplete="off"
          value={text}
          maxLength={1000}
          onChange={(e) => {
            setText(e.target.value);
            setLiteral(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
          placeholder="What's on your mind? Type a task and press Enter…"
        />
        <button className="primary" disabled={!text.trim()}>
          {contentType === "Task"
            ? "Add task"
            : "Save " + contentType.toLowerCase()}
        </button>
      </form>
      <details className="capture-options">
        <summary>Options</summary>
        <div className="capture-controls">
          <label className="compact">
            Capture as
            <select
              aria-label="Capture content type"
              value={contentType}
              onChange={(e) =>
                setContentType(e.target.value as Task["content_type"])
              }
            >
              {["Task", "Idea", "Note"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <PeoplePicker
            compact
            teams={teams}
            people={people}
            teamId={teamId}
            personId={personId}
            onChange={(value) => {
              setTeamId(value.team_id);
              setPersonId(value.person_id);
            }}
          />
          <div className="compact">
            <span className="field-label">Task type</span>
            <select
              aria-label="Quick Add task type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as Task["task_type"])}
            >
              {taskTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <BucketPicker
            compact
            buckets={buckets}
            value={bucketId}
            onChange={setBucketId}
            onCreate={onCreateBucket}
            recent={recent}
          />
          <div className="compact">
            <span className="field-label">Work style</span>
            <select
              aria-label="Quick Add classification"
              value={classification}
              onChange={(e) =>
                setClassification(e.target.value as Task["classification"])
              }
            >
              {["Standard", "Downtime", "Ongoing"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <SmartDate
            label="Quick Add due date"
            value={dueDate}
            someday={someday}
            onChange={(date, some) => {
              setDueDate(date);
              setSomeday(!!some);
            }}
            natural
          />
          {["Follow Up", "Delegated"].includes(taskType) && (
            <SmartDate
              label="Quick Add follow-up date"
              value={followUp}
              onChange={setFollowUp}
              natural
            />
          )}
          <TagPicker
            compact
            value={selectedTags}
            tags={tags}
            onChange={setSelectedTags}
          />
        </div>
        <div className="capture-context">
          {projectId && (
            <span className="chip">
              Project: {projectName || "Selected project"}
            </span>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              applyDefaults(captureContextDefaults("Inbox"));
              input.current?.focus();
            }}
          >
            Reset to Inbox
          </button>
        </div>
      </details>
      <div
        className="capture-hint"
        style={taskWorkspaceStyle(parsed as Task, {
          buckets,
          teams,
          projects: [],
        })}
      >
        <span>
          {text.trim()
            ? [
                parsed.team_id &&
                  teams.find((t) => t.id === parsed.team_id)?.name,
                parsed.bucket_id &&
                  buckets.find((b) => b.id === parsed.bucket_id)?.name,
                parsed.task_type !== "To Do" && parsed.task_type,
                parsed.follow_up_date && `Follow up ${parsed.follow_up_date}`,
                parsed.due_date && `Due ${parsed.due_date}`,
                "suggested_start" in parsed &&
                  parsed.suggested_start &&
                  `Flexible ${parsed.suggested_start}–${parsed.suggested_end}`,
                "recurrence_rule" in parsed &&
                  parsed.recurrence_rule &&
                  "Repeats",
                parsed.tags.length > 0 && parsed.tags.join(", "),
              ]
                .filter(Boolean)
                .join(" · ")
            : "Capture first. Organise later."}
        </span>
        {text.trim() && parsed.title !== text.trim() && (
          <button
            type="button"
            className="text-button"
            onClick={() => setLiteral(true)}
          >
            Use original text
          </button>
        )}
        <button
          className="text-button"
          onClick={() => setBulk(!bulk)}
          aria-expanded={bulk}
        >
          Brain Dump
        </button>
        <span role="status">{saving ? "Saving…" : notice}</span>
      </div>
      {error && (
        <p role="alert" className="late">
          {error}{" "}
          {failed.length ? "Your entries are kept below for retry." : ""}
        </p>
      )}
      {failed.map((item) => (
        <div className="capture-failed" key={item.request_id}>
          <span>{item.lines.join(" · ")}</span>
          <button disabled={saving > 0} onClick={() => send(item)}>
            Retry save
          </button>
          <button
            onClick={() => {
              setText(item.lines[0]);
              setFailed((f) => f.filter((x) => x !== item));
              input.current?.focus();
            }}
          >
            Edit
          </button>
        </div>
      ))}
      {bulk && (
        <div className="brain-dump">
          <label>
            One task per line
            <textarea
              rows={5}
              maxLength={100000}
              value={dump}
              disabled={bulkBusy}
              onChange={(e) => {
                setDump(e.target.value);
                setReceipt(null);
                setError("");
              }}
              placeholder={
                "Review technology quoting template\nFollow up with Sarah next Friday\nDowntime - update AV documentation"
              }
            />
          </label>
          <p className="muted">
            {previewCount} tasks · Dates use Australia/Adelaide. Specific dates:
            DD/MM/YYYY or YYYY-MM-DD.
          </p>
          <div className="capture-preview">
            {preview.map((p, i) => (
              <div key={i}>
                <strong>{p.title}</strong>
                <small>
                  {p.task_type} · {p.classification} ·{" "}
                  {teams.find((t) => t.id === p.team_id)?.name}{" "}
                  {p.follow_up_date ? " · Follow up " + p.follow_up_date : ""} ·{" "}
                  {buckets.find((b) => b.id === p.bucket_id)?.name ||
                    "No bucket"}{" "}
                  · {p.due_date || "No deadline"} {p.tags.join(", ")}
                </small>
              </div>
            ))}
          </div>
          <button
            className="primary"
            disabled={
              bulkBusy ||
              !preview.length ||
              previewCount > 200 ||
              preview.some((p) => !p.title || p.title.length > 255)
            }
            onClick={async () => {
              if (bulkLock.current) return;
              bulkLock.current = true;
              setBulkBusy(true);
              setError("");
              const submission = receipt || {
                defaults,
                request_id: crypto.randomUUID(),
                lines: dump
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              setReceipt(submission);
              if (await send(submission)) {
                setDump("");
                setReceipt(null);
                setBulk(false);
                input.current?.focus();
              }
              bulkLock.current = false;
              setBulkBusy(false);
            }}
          >
            {bulkBusy ? "Creating…" : `Create ${previewCount} tasks`}
          </button>
          {previewCount > 200 && (
            <p role="alert">Paste up to 200 tasks at a time.</p>
          )}
        </div>
      )}
    </section>
  );
}
