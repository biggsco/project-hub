"use client";
import { useId, useState } from "react";
import { canonicalTags, type Tag } from "@/lib/organisation";
export default function TagPicker({
  value,
  tags,
  onChange,
  compact = false,
}: {
  value: string[];
  tags: Tag[];
  onChange: (tags: string[]) => void;
  compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  function add(name = text) {
    if (!name.trim()) return;
    onChange(canonicalTags([...value, name], tags).slice(0, 20));
    setText("");
  }
  return (
    <div className={"tag-picker " + (compact ? "compact" : "")}>
      <span className="field-label">Tags</span>
      <div className="tag-chips">
        {value.map((name) => (
          <button
            type="button"
            className="chip selected"
            aria-label={"Remove tag " + name}
            key={name}
            onClick={() => onChange(value.filter((t) => t !== name))}
          >
            {name} ×
          </button>
        ))}
        <input
          aria-label="Add tags"
          list={id}
          placeholder="Add tag…"
          value={text}
          maxLength={60}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" || e.key === ",") &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="text-button"
          disabled={!text.trim() || value.length >= 20}
          onClick={() => add()}
        >
          Add
        </button>
      </div>
      <datalist id={id}>
        {tags
          .filter((t) => !value.includes(t.name))
          .map((t) => (
            <option key={t.id} value={t.name} />
          ))}
      </datalist>
    </div>
  );
}
