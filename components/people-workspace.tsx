"use client";
import { useState, type ReactNode } from "react";
import { type Task, today, statuses } from "@/lib/model";
import {
  type Team,
  type Person,
  inPeopleScope,
  meetingItems,
  taskTypes,
} from "@/lib/people";
type Props = {
  teams: Team[];
  people: Person[];
  tasks: Task[];
  teamId: string | null;
  personId: string | null;
  onSelect: (teamId: string | null, personId: string | null) => void;
  meeting: boolean;
  onMeeting: (meeting: boolean) => void;
  renderTask: (task: Task) => ReactNode;
  manage: (input: Record<string, unknown>) => Promise<any>;
};
export default function PeopleWorkspace({
  teams,
  people,
  tasks,
  teamId,
  personId,
  onSelect,
  meeting,
  onMeeting,
  renderTask,
  manage,
}: Props) {
  const [type, setType] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const open = tasks.filter((t) => !t.archived && t.status !== "Completed");
  const team = teams.find((t) => t.id === teamId),
    person = people.find((p) => p.id === personId);
  const scoped = (
    meeting
      ? meetingItems(tasks, people, teamId, personId, today())
      : tasks.filter(
          (t) =>
            !t.archived && inPeopleScope(t, teams, people, teamId, personId),
        )
  ).filter(
    (t) =>
      (status ? t.status === status : t.status !== "Completed") &&
      (!type || t.task_type === type) &&
      [t.title, t.notes, t.assigned_to, t.next_action]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="people-workspace">
      <div className="section-heading">
        <div>
          <h2>{person?.name || team?.name || "People & Teams"}</h2>
          <p className="muted">
            {team?.description ||
              person?.notes ||
              "Your own discussion lists, follow-ups and delegated actions. No colleague accounts needed."}
          </p>
        </div>
        <button className="secondary" onClick={() => onSelect(null, null)}>
          All people & teams
        </button>
      </div>
      <div className="people-cards">
        {teams
          .filter((t) => showArchived || !t.archived)
          .map((t) => (
            <button
              className={"people-card " + (teamId === t.id ? "selected" : "")}
              key={t.id}
              onClick={() => onSelect(t.id, null)}
            >
              <strong>
                {t.name}
                {t.archived ? " (archived)" : ""}
              </strong>
              <small>
                {
                  open.filter((task) =>
                    inPeopleScope(task, teams, people, t.id, null),
                  ).length
                }{" "}
                outstanding
              </small>
            </button>
          ))}
      </div>
      <div className="person-chips">
        {people
          .filter(
            (p) =>
              (showArchived || !p.archived) &&
              (!teamId || p.team_ids.includes(teamId)),
          )
          .map((p) => (
            <button
              className={"chip " + (personId === p.id ? "selected" : "")}
              key={p.id}
              onClick={() => onSelect(teamId, p.id)}
            >
              {p.name}
              {p.archived ? " (archived)" : ""} (
              {
                open.filter((t) => inPeopleScope(t, teams, people, null, p.id))
                  .length
              }
              )
            </button>
          ))}
      </div>
      <div className="filters">
        <button className="secondary" onClick={() => onMeeting(!meeting)}>
          {meeting ? "All associated tasks" : "Meeting View"}
        </button>
        <select
          aria-label="Filter people task type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {taskTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Filter people task status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Outstanding</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="Search people tasks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an item…"
        />
      </div>
      {meeting && (
        <p className="muted">
          A checklist for this conversation. Unresolved items stay for next
          time. Quick Add above is ready for this team or person.
        </p>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>{meeting ? "Meeting checklist" : "Associated tasks"}</h2>
          <small>{scoped.length} items</small>
        </div>
        {scoped.map(renderTask)}
        {!scoped.length && (
          <p className="empty">
            Nothing here yet. Capture a task or discussion above.
          </p>
        )}
      </section>
      <details className="directory-manager panel">
        <summary>Manage people & teams</summary>
        <label className="between">
          Show archived
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
        </label>
        <div className="inline-actions">
          <button
            className="secondary"
            onClick={() =>
              setEditor({
                kind: "team",
                name: "",
                description: "",
                aliases: [],
                archived: false,
              })
            }
          >
            New team
          </button>
          <button
            className="secondary"
            onClick={() =>
              setEditor({
                kind: "person",
                name: "",
                notes: "",
                team_ids: teamId ? [teamId] : [],
                archived: false,
              })
            }
          >
            New person
          </button>
        </div>
        {teams.map((t) => (
          <div className="manage-row" key={t.id}>
            <span>
              {t.name}
              {t.archived ? " (archived)" : ""}
            </span>
            <button onClick={() => setEditor({ ...t, kind: "team" })}>
              Edit team
            </button>
          </div>
        ))}
        {people.map((p) => (
          <div className="manage-row" key={p.id}>
            <button
              className="text-button"
              onClick={() => onSelect(null, p.id)}
            >
              {p.name}
              {p.archived ? " (archived)" : ""}
            </button>
            <span>
              {p.team_ids
                .map((id) => teams.find((t) => t.id === id)?.name)
                .filter(Boolean)
                .join(", ")}
            </span>
            <button onClick={() => setEditor({ ...p, kind: "person" })}>
              Edit person
            </button>
          </div>
        ))}
        {editor && (
          <div className="contact-editor">
            <label>
              Name
              <input
                aria-label="Contact name"
                maxLength={255}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            {editor.kind === "team" ? (
              <>
                <label>
                  Description
                  <textarea
                    value={editor.description}
                    onChange={(e) =>
                      setEditor({ ...editor, description: e.target.value })
                    }
                  />
                </label>
                <label>
                  Aliases (comma separated)
                  <input
                    value={editor.aliases.join(",")}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        aliases: e.target.value.split(","),
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Notes
                  <textarea
                    value={editor.notes}
                    onChange={(e) =>
                      setEditor({ ...editor, notes: e.target.value })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Teams</legend>
                  {teams
                    .filter(
                      (t) => !t.archived || editor.team_ids.includes(t.id),
                    )
                    .map((t) => (
                      <label className="checkbox-label" key={t.id}>
                        <input
                          type="checkbox"
                          checked={editor.team_ids.includes(t.id)}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              team_ids: e.target.checked
                                ? [...editor.team_ids, t.id]
                                : editor.team_ids.filter(
                                    (id: string) => id !== t.id,
                                  ),
                            })
                          }
                        />
                        {t.name}
                      </label>
                    ))}
                </fieldset>
              </>
            )}
            <label className="between">
              Archived
              <input
                type="checkbox"
                checked={editor.archived}
                onChange={(e) =>
                  setEditor({ ...editor, archived: e.target.checked })
                }
              />
            </label>
            <button
              className="primary"
              disabled={busy || !editor.name.trim()}
              onClick={async () => {
                setBusy(true);
                const value = {
                  ...editor,
                  ...(editor.kind === "team"
                    ? {
                        aliases: editor.aliases
                          .map((a: string) => a.trim())
                          .filter(Boolean),
                      }
                    : {}),
                };
                const result = await manage({
                  action: editor.kind === "team" ? "team_save" : "person_save",
                  id: editor.id,
                  value,
                });
                setBusy(false);
                if (result) setEditor(null);
              }}
            >
              Save {editor.kind}
            </button>
            <button onClick={() => setEditor(null)}>Cancel</button>
          </div>
        )}
      </details>
    </div>
  );
}
