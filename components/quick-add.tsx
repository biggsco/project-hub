"use client";
import { useEffect, useRef, useState } from "react";
import { parseCapture, previewBulk } from "@/lib/capture";
import type { Task } from "@/lib/model";
type Submission = { request_id: string; lines: string[] };
export default function QuickAdd({
  onCreated,
}: {
  onCreated: (records: Task[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const bulkLock = useRef(false);
  const [text, setText] = useState("");
  const [bulk, setBulk] = useState(false);
  const [dump, setDump] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [receipt, setReceipt] = useState<Submission | null>(null);
  const [failed, setFailed] = useState<Submission[]>([]);
  const [saving, setSaving] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const parsed = parseCapture(text);
  const preview = previewBulk(dump);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const editing = (e.target as HTMLElement).matches(
        "input,textarea,select,[contenteditable=true]",
      );
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (!editing && e.key === "q" && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
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
    setSaving((n) => n + 1);
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "capture", ...submission }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to capture tasks.");
      onCreated(b.records);
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
  return (
    <section className="quick-add" aria-label="Quick Add">
      <form
        className="capture"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const submission = {
            request_id: crypto.randomUUID(),
            lines: [text.trim()],
          };
          setText("");
          setError("");
          input.current?.focus();
          if (!(await send(submission)))
            setFailed((items) => [...items, submission]);
        }}
      >
        <input
          ref={input}
          aria-label="Quick Add task"
          autoComplete="off"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
          placeholder="What's on your mind? Type a task and press Enter…"
        />
        <button className="primary" disabled={!text.trim()}>
          Add task
        </button>
      </form>
      <div className="capture-hint">
        <span>
          {text.trim()
            ? `${parsed.classification}${parsed.due_date ? " · Due " + parsed.due_date : " · No deadline"}`
            : "Capture first, organise later. Focus with Ctrl / ⌘ K or Q."}
        </span>
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
            {preview.length} tasks · Dates use Australia/Adelaide. Specific
            dates: DD/MM/YYYY or YYYY-MM-DD.
          </p>
          <div className="capture-preview">
            {preview.map((p, i) => (
              <div key={i}>
                <strong>{p.title}</strong>
                <small>
                  {p.classification} · {p.due_date || "No deadline"}
                </small>
              </div>
            ))}
          </div>
          <button
            className="primary"
            disabled={
              bulkBusy ||
              !preview.length ||
              preview.length > 200 ||
              preview.some((p) => !p.title || p.title.length > 255)
            }
            onClick={async () => {
              if (bulkLock.current) return;
              bulkLock.current = true;
              setBulkBusy(true);
              setError("");
              const submission = receipt || {
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
            {bulkBusy ? "Creating…" : `Create ${preview.length} tasks`}
          </button>
          {preview.length > 200 && (
            <p role="alert">Paste up to 200 tasks at a time.</p>
          )}
        </div>
      )}
    </section>
  );
}
