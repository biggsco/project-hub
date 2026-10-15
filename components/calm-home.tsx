"use client";
import type { Task, Project } from "@/lib/model";
import type { Team } from "@/lib/people";
import { needsAttention, resumeWork } from "@/lib/productivity";
export default function CalmHome({
  tasks,
  projects,
  teams,
  onOpen,
  onComplete,
  onTeam,
  onProject,
}: {
  tasks: Task[];
  projects: Project[];
  teams: Team[];
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
  onTeam: (id: string) => void;
  onProject: (p: Project) => void;
}) {
  const attention = needsAttention(tasks, undefined, 4),
    recent = resumeWork(tasks, projects);
  const row = (t: Task) => (
    <div className="calm-row" key={t.id}>
      <button
        className="calm-check"
        aria-label={`Complete ${t.title}`}
        onClick={() => onComplete(t)}
      >
        ○
      </button>
      <button className="calm-title" onClick={() => onOpen(t)}>
        <strong>{t.title}</strong>
        {t.next_action && <small>{t.next_action}</small>}
        {t.follow_up_date && <small>Follow up {t.follow_up_date}</small>}
      </button>
    </div>
  );
  return (
    <div className="calm-home">
      <section>
        <h2>Needs your attention</h2>
        {attention.map(row)}
        {!attention.length && (
          <p className="muted">
            Nothing pressing. Capture something or pick up your work below.
          </p>
        )}
      </section>
      <section>
        <h2>Pick up where you left off</h2>
        {recent.tasks
          .filter((t) => !attention.some((a) => a.id === t.id))
          .slice(0, 3)
          .map(row)}
        {recent.projects.slice(0, 2).map((p) => (
          <button
            className="calm-title"
            key={p.id}
            onClick={() => onProject(p)}
          >
            <strong>{p.name}</strong>
            {p.next_action && <small>{p.next_action}</small>}
          </button>
        ))}
      </section>
      <section>
        <h2>People</h2>
        <div className="inline-actions">
          {teams
            .filter((t) => !t.archived)
            .slice(0, 4)
            .map((t) => (
              <button
                className="secondary"
                key={t.id}
                onClick={() => onTeam(t.id)}
              >
                {t.name}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
