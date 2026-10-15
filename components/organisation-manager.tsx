"use client";
import type { Task } from "@/lib/model";
import { useState } from "react";
import { orderedBuckets, type Bucket, type Tag } from "@/lib/organisation";
type Manage = (input: Record<string, unknown>) => Promise<any>;
export default function OrganisationManager({
  buckets,
  tags,
  manage,
  tasks,
}: {
  tasks: Task[];
  buckets: Bucket[];
  tags: Tag[];
  manage: Manage;
}) {
  const [editing, setEditing] = useState<Bucket | null>(null),
    [tagId, setTagId] = useState(""),
    [tagName, setTagName] = useState(""),
    [mergeTo, setMergeTo] = useState(""),
    [busy, setBusy] = useState(false);
  const active = orderedBuckets(buckets);
  async function run(input: Record<string, unknown>) {
    setBusy(true);
    try {
      return await manage(input);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="organisation-manager panel">
      <summary>Manage buckets & tags</summary>
      <h3>Buckets</h3>
      <p className="muted">
        Archiving keeps existing tasks. Names and aliases are recognised during
        capture.
      </p>
      {buckets
        .toSorted(
          (a, b) =>
            Number(a.archived) - Number(b.archived) || a.position - b.position,
        )
        .map((b) => (
          <div className="manage-row" key={b.id}>
            <span>
              {b.name} (
              {
                tasks.filter(
                  (t) =>
                    t.bucket_id === b.id &&
                    !t.archived &&
                    t.status !== "Completed",
                ).length
              }
              ){b.archived ? " (archived)" : ""}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing({ ...b })}
            >
              Edit
            </button>
            {!b.archived &&
              [
                [-1, "Move up"],
                [1, "Move down"],
              ].map(([delta, label]) => (
                <button
                  type="button"
                  aria-label={label + " " + b.name}
                  key={label}
                  disabled={
                    busy ||
                    active.indexOf(b) + Number(delta) < 0 ||
                    active.indexOf(b) + Number(delta) >= active.length
                  }
                  onClick={() => {
                    const ids = active.map((x) => x.id),
                      i = ids.indexOf(b.id),
                      j = i + Number(delta);
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                    run({ action: "bucket_reorder", ids });
                  }}
                >
                  {label}
                </button>
              ))}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run({
                  action: "bucket_save",
                  id: b.id,
                  value: { ...b, archived: !b.archived },
                })
              }
            >
              {b.archived ? "Restore" : "Archive"}
            </button>
          </div>
        ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setEditing({
            id: "",
            name: "",
            description: "",
            aliases: [],
            position: active.length,
            archived: false,
          })
        }
      >
        New bucket
      </button>
      {editing && (
        <div className="bucket-edit">
          <label>
            Bucket name
            <input
              maxLength={100}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              rows={2}
              value={editing.description}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
          </label>
          <label>
            Aliases (comma separated)
            <input
              value={editing.aliases.join(",")}
              onChange={(e) =>
                setEditing({ ...editing, aliases: e.target.value.split(",") })
              }
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={busy || !editing.name.trim()}
            onClick={async () => {
              const value = {
                ...editing,
                aliases: editing.aliases.map((a) => a.trim()).filter(Boolean),
              };
              if (
                await run({
                  action: "bucket_save",
                  id: editing.id || undefined,
                  value,
                })
              )
                setEditing(null);
            }}
          >
            Save bucket
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      )}
      <h3>Tags</h3>
      <p className="muted">
        Create tags as you capture tasks. Rename or merge here; changes apply to
        every tagged task and project.
      </p>
      <div className="manage-row">
        <select
          aria-label="Tag to manage"
          value={tagId}
          onChange={(e) => {
            setTagId(e.target.value);
            setTagName(tags.find((t) => t.id === e.target.value)?.name || "");
            setMergeTo("");
          }}
        >
          <option value="">Choose a tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {tagId && (
          <>
            <input
              aria-label="Rename tag"
              maxLength={60}
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !tagName.trim()}
              onClick={() =>
                run({ action: "tag_save", id: tagId, value: { name: tagName } })
              }
            >
              Rename
            </button>
            <select
              aria-label="Merge into tag"
              value={mergeTo}
              onChange={(e) => setMergeTo(e.target.value)}
            >
              <option value="">Merge into…</option>
              {tags
                .filter((t) => t.id !== tagId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={busy || !mergeTo}
              onClick={async () => {
                if (
                  await run({
                    action: "tag_save",
                    id: tagId,
                    merge_to: mergeTo,
                  })
                ) {
                  setTagId("");
                  setMergeTo("");
                }
              }}
            >
              Merge tags
            </button>
          </>
        )}
      </div>
    </details>
  );
}
