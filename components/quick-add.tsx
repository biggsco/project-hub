"use client";
import { useEffect, useRef, useState } from "react";
import { parseTaskInput, boundedPreview } from "@/lib/capture";
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
  buckets,
  tags,
  onCreateBucket,
  contextBucket,
  downtime = false,
}: {
  buckets: Bucket[];
  tags: Tag[];
  onCreateBucket: (name: string) => Promise<Bucket | null>;
  contextBucket?: string | null;
  downtime?: boolean;
  onCreated: (records: Task[], tags: Tag[]) => void;
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
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [classification, setClassification] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [someday, setSomeday] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const defaults: CaptureDefaults = {
    bucket_id: bucketId,
    classification: (classification ||
      (downtime ? "Downtime" : "Inbox")) as Task["classification"],
    due_date: dueDate,
    tags: selectedTags,
    date_preferences: someday ? { due_date: "Someday" } : {},
  };
  const parsed = parseTaskInput(text, buckets, tags, today(), defaults);
  const { count: previewCount, items: preview } = boundedPreview(
    dump,
    buckets,
    tags,
    today(),
    defaults,
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
  useEffect(() => {
    if (contextBucket !== undefined) setBucketId(contextBucket);
  }, [contextBucket]);
  useEffect(() => {
    if (bucketId && buckets.find((b) => b.id === bucketId)?.archived)
      setBucketId(null);
  }, [buckets, bucketId]);
  useEffect(() => {
    setReceipt(null);
  }, [bucketId, classification, dueDate, someday, selectedTags, downtime]);
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
      onCreated(b.records, b.tags || []);
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
            defaults,
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
      <div className="capture-controls">
        <BucketPicker
          compact
          buckets={buckets}
          value={bucketId}
          onChange={setBucketId}
          onCreate={onCreateBucket}
          recent={recent}
        />
        <div className="compact">
          <span className="field-label">Classification</span>
          <select
            aria-label="Quick Add classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
          >
            <option value="">
              {downtime ? "Downtime (this view)" : "Inbox (default)"}
            </option>
            {["Inbox", "Downtime", "Ongoing"].map((c) => (
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
        <TagPicker
          compact
          value={selectedTags}
          tags={tags}
          onChange={setSelectedTags}
        />
      </div>
      <div className="capture-hint">
        <span>
          {text.trim()
            ? `${parsed.classification}${parsed.bucket_id ? " · " + buckets.find((b) => b.id === parsed.bucket_id)?.name : ""}${parsed.due_date ? " · Due " + parsed.due_date : " · No deadline"}${parsed.tags.length ? " · " + parsed.tags.join(", ") : ""}`
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
            {previewCount} tasks · Dates use Australia/Adelaide. Specific dates:
            DD/MM/YYYY or YYYY-MM-DD.
          </p>
          <div className="capture-preview">
            {preview.map((p, i) => (
              <div key={i}>
                <strong>{p.title}</strong>
                <small>
                  {p.classification} ·{" "}
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
