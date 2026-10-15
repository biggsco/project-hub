"use client";
import { useState } from "react";
import { orderedBuckets, type Bucket } from "@/lib/organisation";
export default function BucketPicker({
  buckets,
  value,
  onChange,
  onCreate,
  recent = [],
  compact = false,
}: {
  buckets: Bucket[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (name: string) => Promise<Bucket | null>;
  recent?: string[];
  compact?: boolean;
}) {
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const choices = orderedBuckets(buckets, recent);
  return (
    <div className={"bucket-picker " + (compact ? "compact" : "")}>
      <span className="field-label">Bucket</span>
      <div className="bucket-chips">
        {compact &&
          choices.slice(0, 5).map((b) => (
            <button
              type="button"
              aria-pressed={value === b.id}
              className={"chip " + (value === b.id ? "selected" : "")}
              key={b.id}
              onClick={() => onChange(value === b.id ? null : b.id)}
            >
              {b.name}
            </button>
          ))}
        <select
          aria-label="Select bucket"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">No bucket</option>
          {choices.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          {value && buckets.find((b) => b.id === value)?.archived && (
            <option value={value}>
              {buckets.find((b) => b.id === value)?.name} (archived)
            </option>
          )}
        </select>
        <button
          type="button"
          className="text-button"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          New bucket
        </button>
      </div>
      {adding && (
        <div className="inline-create">
          <input
            aria-label="New bucket name"
            maxLength={100}
            value={name}
            placeholder="Bucket name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>("button")
                  ?.click();
              }
            }}
          />
          <button
            type="button"
            className="secondary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              const b = await onCreate(name);
              setBusy(false);
              if (b) {
                onChange(b.id);
                setName("");
                setAdding(false);
              }
            }}
          >
            Create bucket
          </button>
        </div>
      )}
    </div>
  );
}
