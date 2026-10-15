"use client";
import type { Directory } from "@/lib/people";
export default function PeoplePicker({
  teams,
  people,
  teamId,
  personId,
  onChange,
  compact = false,
}: {
  teams: Directory["teams"];
  people: Directory["people"];
  teamId: string | null;
  personId: string | null;
  onChange: (value: {
    team_id: string | null;
    person_id: string | null;
  }) => void;
  compact?: boolean;
}) {
  return (
    <div className={"people-picker " + (compact ? "compact" : "")}>
      <span className="field-label">People / Team</span>
      <div className="people-selectors">
        <select
          aria-label="Select team"
          value={teamId || ""}
          onChange={(e) =>
            onChange({ team_id: e.target.value || null, person_id: personId })
          }
        >
          <option value="">No team</option>
          {teams
            .filter((t) => !t.archived || t.id === teamId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.archived ? " (archived)" : ""}
              </option>
            ))}
        </select>
        <select
          aria-label="Select person"
          value={personId || ""}
          onChange={(e) =>
            onChange({ team_id: teamId, person_id: e.target.value || null })
          }
        >
          <option value="">No person</option>
          {people
            .filter((p) => !p.archived || p.id === personId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? " (archived)" : ""}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
