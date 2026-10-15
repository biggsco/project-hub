"use client";
import { useEffect, useState } from "react";
import type { Task, Project } from "@/lib/model";
import type { Bucket } from "@/lib/organisation";
import type { Directory } from "@/lib/people";
import {
  promptContext,
  generatePrompt,
  promptModes,
  parseSteps,
  type PromptMode,
} from "@/lib/workbench";
type Props = {
  task: Task;
  tasks: Task[];
  projects: Project[];
  buckets: Bucket[];
  directory: Directory;
  onPatch: (t: Task, p: Partial<Task>) => Promise<boolean>;
  onAction: (input: Record<string, unknown>) => Promise<any>;
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
};
export default function TaskWorkbench({
  task,
  tasks,
  projects,
  buckets,
  directory,
  onPatch,
  onAction,
  onOpen,
  onComplete,
}: Props) {
  const children = tasks
    .filter((t) => t.parent_id === task.id && !t.archived)
    .toSorted(
      (a, b) =>
        a.subtask_position - b.subtask_position ||
        a.created_at.localeCompare(b.created_at),
    );
  const [next, setNext] = useState(task.next_action),
    [note, setNote] = useState(""),
    [kind, setKind] = useState("progress"),
    [step, setStep] = useState(""),
    [url, setUrl] = useState(""),
    [linkTitle, setLinkTitle] = useState(""),
    [linkId, setLinkId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [paste, setPaste] = useState(false),
    [source, setSource] = useState(""),
    [steps, setSteps] = useState<{ title: string; selected: boolean }[]>([]),
    [receipt, setReceipt] = useState<string | null>(null);
  const [promptDirty, setPromptDirty] = useState(false);
  const [prompts, setPrompts] = useState(false),
    [mode, setMode] = useState<PromptMode>("Break into Steps"),
    [constraints, setConstraints] = useState(""),
    [included, setIncluded] = useState<string[]>([]),
    [preview, setPreview] = useState("");
  const [noteReceipt, setNoteReceipt] = useState(() => crypto.randomUUID());
  useEffect(() => {
    setNext(task.next_action);
  }, [task.next_action]);
  useEffect(() => {
    setNote("");
    setSource("");
    setSteps([]);
    setPaste(false);
    setPrompts(false);
    setMessage("");
    setError("");
    setLinkId(null);
    setUrl("");
    setLinkTitle("");
  }, [task.id]);
  const parts = promptContext(
    task,
    children,
    projects.find((p) => p.id === task.project_id),
    buckets.find((b) => b.id === task.bucket_id),
    directory,
  );
  async function action(input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      return await onAction({ task_id: task.id, ...input });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(preview);
      setMessage("Prompt copied");
    } catch {
      setError(
        "Copy unavailable. Select the prompt below and copy it manually.",
      );
    }
  }
  function develop() {
    const ids = parts.map((p) => p.id);
    setIncluded(ids);
    setPreview(generatePrompt(mode, parts, ids, constraints));
    setPromptDirty(false);
    setPrompts(true);
  }
  async function importSteps(titles: string[], id: string) {
    const result = await action({
      action: "steps_import",
      request_id: id,
      titles,
    });
    if (result) {
      setMessage(
        `${result.records.length} steps added${result.skipped ? `; ${result.skipped} already present` : ""}`,
      );
      setSteps([]);
      setSource("");
      setReceipt(null);
      setStep("");
      setPaste(false);
    }
  }
  const last = task.progress_entries.at(-1);
  return (
    <div className="task-workbench" key={task.id}>
      <section className="resume-work panel">
        <h3>Resume work</h3>
        <p className="muted">
          {task.content_type} · {task.status}
          {task.due_date ? ` · Due ${task.due_date}` : ""}
        </p>
        {last && (
          <p>
            <strong>Last update:</strong> {last.text}{" "}
            <small>
              {new Date(last.created_at).toLocaleString("en-AU", {
                timeZone: "Australia/Adelaide",
              })}
            </small>
          </p>
        )}
        <p className="muted">
          {[
            projects.find((p) => p.id === task.project_id)?.name,
            buckets.find((b) => b.id === task.bucket_id)?.name,
            directory.teams.find((t) => t.id === task.team_id)?.name,
            directory.people.find((p) => p.id === task.person_id)?.name,
            ...task.tags,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {task.description && <p className="task-note">{task.description}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onPatch(task, { next_action: next }))
              setMessage("Next action saved");
          }}
        >
          <label>
            Next Action
            <input
              aria-label="Workbench Next Action"
              value={next}
              maxLength={2000}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Smallest useful next step…"
            />
          </label>
          <button
            className="secondary"
            disabled={busy || next === task.next_action}
          >
            Save next action
          </button>
        </form>
        <p>
          {children.filter((t) => t.status !== "Completed").length} outstanding
          subtasks
        </p>
        {children.some((t) => t.status !== "Completed") && (
          <p className="muted">
            Next steps:{" "}
            {children
              .filter((t) => t.status !== "Completed")
              .slice(0, 3)
              .map((t) => t.title)
              .join(" · ")}
          </p>
        )}
        {task.reference_links.slice(-3).map((l) => (
          <a
            key={l.id}
            className="reference-shortcut"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {l.title}
          </a>
        ))}
      </section>
      {task.content_type !== "Task" && (
        <button
          className="primary"
          onClick={() =>
            onPatch(task, { content_type: "Task", status: "Inbox" })
          }
        >
          Convert to task
        </button>
      )}
      <label className="context-choice">
        <input
          type="checkbox"
          checked={task.awaiting_decision}
          onChange={(e) =>
            onPatch(task, { awaiting_decision: e.target.checked })
          }
        />
        Awaiting a decision
      </label>
      <section>
        <h3>Progress</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await action({
              action: "progress_add",
              text: note,
              kind,
              request_id: noteReceipt,
            });
            if (r) {
              setNote("");
              setNoteReceipt(crypto.randomUUID());
              setMessage("Progress recorded");
            }
          }}
        >
          <div className="inline-actions">
            <input
              aria-label="Quick progress note"
              placeholder="Where did you get to?"
              value={note}
              maxLength={4000}
              required
              onChange={(e) => {
                setNote(e.target.value);
                setNoteReceipt(crypto.randomUUID());
              }}
            />
            <select
              aria-label="Progress note kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setNoteReceipt(crypto.randomUUID());
              }}
            >
              <option value="progress">Progress update</option>
              <option value="discussion">Actually discussed</option>
            </select>
            <button className="primary" disabled={busy || !note.trim()}>
              Add progress
            </button>
          </div>
        </form>
        <details>
          <summary>Progress history ({task.progress_entries.length})</summary>
          {task.progress_entries.toReversed().map((n) => (
            <p className="task-note" key={n.id}>
              <small>
                {n.kind} ·{" "}
                {new Date(n.created_at).toLocaleString("en-AU", {
                  timeZone: "Australia/Adelaide",
                })}
              </small>
              <br />
              {n.text}
            </p>
          ))}
        </details>
      </section>
      <section>
        <div className="section-heading">
          <h3>Subtasks</h3>
          <button className="secondary" onClick={() => setPaste(!paste)}>
            Paste Steps
          </button>
        </div>
        {children.map((s, i) => (
          <div className="workbench-subtask" key={s.id}>
            <input
              type="checkbox"
              aria-label={`Complete subtask ${s.title}`}
              checked={s.status === "Completed"}
              onChange={() => onComplete(s)}
            />
            <input
              aria-label={`Edit subtask ${s.title}`}
              defaultValue={s.title}
              key={s.id + s.title}
              maxLength={255}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (title && title !== s.title) onPatch(s, { title });
                else e.target.value = s.title;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <button
              aria-label={`Move ${s.title} up`}
              disabled={busy || i === 0}
              onClick={() => {
                const ids = children.map((t) => t.id);
                [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                action({ action: "subtasks_reorder", ids });
              }}
            >
              ↑
            </button>
            <button
              aria-label={`Move ${s.title} down`}
              disabled={busy || i === children.length - 1}
              onClick={() => {
                const ids = children.map((t) => t.id);
                [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                action({ action: "subtasks_reorder", ids });
              }}
            >
              ↓
            </button>
            <button className="text-button" onClick={() => onOpen(s)}>
              Open
            </button>
          </div>
        ))}
        <form
          className="inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            importSteps([step.trim()], receipt || crypto.randomUUID());
          }}
        >
          <input
            aria-label="New subtask"
            placeholder="Next step…"
            value={step}
            maxLength={255}
            onChange={(e) => {
              setStep(e.target.value);
              setReceipt(crypto.randomUUID());
            }}
          />
          <button className="secondary" disabled={busy || !step.trim()}>
            Add step
          </button>
        </form>
        {paste && (
          <div className="paste-steps">
            <label>
              Paste numbered steps, Markdown checklist or JSON
              <textarea
                aria-label="Paste steps source"
                value={source}
                maxLength={60000}
                rows={5}
                onChange={(e) => {
                  setSource(e.target.value);
                  setSteps([]);
                  setReceipt(null);
                }}
              />
            </label>
            <button
              className="secondary"
              onClick={() => {
                try {
                  const titles = parseSteps(source);
                  setSteps(titles.map((title) => ({ title, selected: true })));
                  setReceipt(crypto.randomUUID());
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Preview steps
            </button>
            {steps.map((s, i) => (
              <div className="inline-actions" key={i}>
                <input
                  type="checkbox"
                  aria-label={`Import step ${i + 1}`}
                  checked={s.selected}
                  onChange={(e) => {
                    setSteps((v) =>
                      v.map((a, j) =>
                        j === i ? { ...a, selected: e.target.checked } : a,
                      ),
                    );
                    setReceipt(crypto.randomUUID());
                  }}
                />
                <input
                  aria-label={`Step ${i + 1} title`}
                  value={s.title}
                  maxLength={255}
                  onChange={(e) => {
                    setSteps((v) =>
                      v.map((a, j) =>
                        j === i ? { ...a, title: e.target.value } : a,
                      ),
                    );
                    setReceipt(crypto.randomUUID());
                  }}
                />
              </div>
            ))}
            {!!steps.length && (
              <button
                className="primary"
                disabled={
                  busy ||
                  !steps.some((s) => s.selected) ||
                  steps.some((s) => s.selected && !s.title.trim())
                }
                onClick={() =>
                  importSteps(
                    steps.filter((s) => s.selected).map((s) => s.title.trim()),
                    receipt!,
                  )
                }
              >
                Import selected steps
              </button>
            )}
          </div>
        )}
      </section>
      <section>
        <h3>Links & references</h3>
        {task.reference_links.map((l) => (
          <div className="reference-row" key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.title}
            </a>
            <button
              className="text-button"
              onClick={() => {
                setLinkId(l.id);
                setLinkTitle(l.title);
                setUrl(l.url);
              }}
            >
              Edit
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                action({ action: "reference_delete", reference_id: l.id })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action({
                action: "reference_save",
                reference_id: linkId || crypto.randomUUID(),
                title: linkTitle,
                url,
              })
            ) {
              setUrl("");
              setLinkTitle("");
              setLinkId(null);
              setMessage("Reference saved");
            }
          }}
        >
          <div className="two-cols">
            <label>
              Link title
              <input
                value={linkTitle}
                maxLength={255}
                required
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </label>
            <label>
              URL
              <input
                type="url"
                placeholder="https://…"
                value={url}
                maxLength={2000}
                required
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          </div>
          <button className="secondary" disabled={busy}>
            {linkId ? "Save reference" : "Add reference"}
          </button>
        </form>
      </section>
      <section>
        <button className="primary" onClick={develop}>
          Develop with ChatGPT
        </button>
        {prompts && (
          <div className="prompt-builder">
            <p className="muted">
              Nothing is sent automatically. Choose exactly what to include,
              then regenerate, review and copy.
            </p>
            <label>
              Prompt mode
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as PromptMode);
                  setPromptDirty(true);
                }}
              >
                {promptModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <details open>
              <summary>Included context ({included.length})</summary>
              {parts.map((p) => (
                <label className="context-choice" key={p.id}>
                  <input
                    type="checkbox"
                    checked={included.includes(p.id)}
                    onChange={(e) => (
                      setPromptDirty(true),
                      setIncluded((v) =>
                        e.target.checked
                          ? [...v, p.id]
                          : v.filter((x) => x !== p.id),
                      )
                    )}
                  />
                  <span>
                    {p.label}: {p.text.slice(0, 160)}
                    {p.text.length > 160 ? "…" : ""}
                  </span>
                </label>
              ))}
            </details>
            <label>
              Constraints
              <textarea
                value={constraints}
                maxLength={10000}
                onChange={(e) => {
                  setConstraints(e.target.value);
                  setPromptDirty(true);
                }}
                placeholder="Only include constraints you want to share"
              />
            </label>
            <button
              className="secondary"
              onClick={() => (
                setPreview(generatePrompt(mode, parts, included, constraints)),
                setPromptDirty(false)
              )}
            >
              Regenerate preview
            </button>
            <label>
              Editable prompt preview
              <textarea
                aria-label="ChatGPT prompt preview"
                rows={12}
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
              />
            </label>
            {promptDirty && (
              <p role="status">
                Regenerate the preview to apply your context selections before
                copying.
              </p>
            )}
            <button className="primary" disabled={promptDirty} onClick={copy}>
              Copy Prompt
            </button>
          </div>
        )}
      </section>
      <p role="status" className="muted">
        {message}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
