"use client";
import type { Tag } from "@/lib/organisation";
export default function TagFilter({
  tags,
  value,
  onChange,
  label = "Filter tags",
}: {
  tags: Tag[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}) {
  return (
    <details
      className="tag-filter"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.currentTarget.removeAttribute("open");
      }}
    >
      <summary aria-label={label}>
        {value.length ? `Tags (${value.length})` : "All tags"}
      </summary>
      <div className="tag-filter-options">
        <small>Match all selected tags</small>
        {tags.map((tag) => (
          <label key={tag.id}>
            <input
              type="checkbox"
              checked={value.includes(tag.name)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, tag.name]
                    : value.filter((t) => t !== tag.name),
                )
              }
            />
            {tag.name}
          </label>
        ))}
        {!tags.length && <p>No tags yet. Add one while capturing a task.</p>}
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([])}
        >
          Clear tags
        </button>
      </div>
    </details>
  );
}
