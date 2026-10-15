"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  Inbox,
  ListTodo,
  FolderKanban,
  Clock,
  Archive,
  Settings,
  Plus,
  Search,
  ChevronRight,
  Check,
  PanelLeftClose,
  Menu,
  LogOut,
  X,
  CalendarDays,
} from "lucide-react";
import {
  Task,
  Project,
  statuses,
  priorities,
  projectStatuses,
  stats,
  progress,
  today,
  addDays,
} from "@/lib/model";
type Activity = {
  id: string;
  title: string;
  action: string;
  created_at: string;
  entity_id: string;
};
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Inbox", Inbox],
  ["My Tasks", ListTodo],
  ["Projects", FolderKanban],
  ["Waiting On", Clock],
  ["Completed / Archive", Archive],
  ["Settings", Settings],
] as const;
const emptyTask = {
  title: "",
  description: "",
  notes: "",
  status: "Inbox",
  priority: "Medium",
  project_id: null,
  parent_id: null,
  start_date: null,
  due_date: null,
  person: "",
  tags: [],
  archived: false,
};
const emptyProject = {
  name: "",
  description: "",
  notes: "",
  category: "",
  status: "Active",
  priority: "Medium",
  start_date: null,
  target_date: null,
  actual_date: null,
};
export default function Hub({
  email,
  initialProject,
}: {
  email: string;
  initialProject?: string;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const [sort, setSort] = useState("due");
  const [section, setSection] = useState(
      initialProject ? "Projects" : "Dashboard",
    ),
    [tasks, setTasks] = useState<Task[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [dateFilter, setDateFilter] = useState(""),
    [projectFilter, setProjectFilter] = useState(""),
    [selectedProject, setSelectedProject] = useState<string | null>(
      initialProject || null,
    ),
    [editor, setEditor] = useState<{
      table: "tasks" | "projects";
      id?: string;
      value: any;
    } | null>(null),
    [capture, setCapture] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [view, setView] = useState("List"),
    [selected, setSelected] = useState<string[]>([]),
    [dark, setDark] = useState(false),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
  useEffect(() => {
    if (!editor) return;
    const prior = document.activeElement as HTMLElement | null;
    const dialog = drawerRef.current;
    const selector =
      "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)";
    dialog?.querySelector<HTMLElement>(selector)?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditor(null);
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(
        dialog?.querySelectorAll<HTMLElement>(selector) || [],
      );
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = saved;
      prior?.focus();
    };
  }, [editor?.id, editor?.table]);
  useEffect(() => {
    function back() {
      const id = location.pathname.match(/^\/projects\/([^/]+)$/)?.[1];
      setSelectedProject(id || null);
      setSection(id ? "Projects" : "Dashboard");
    }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  async function load() {
    try {
      const r = await fetch("/api/data");
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setTasks(b.tasks);
      setProjects(b.projects);
      setActivity(b.activity);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const d = localStorage.getItem("hub-theme") === "dark";
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    if (new URLSearchParams(location.search).has("reset"))
      setSection("Settings");
  }, []);
  async function mutate(
    table: "tasks" | "projects",
    value: any,
    id?: string,
    action = "save",
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, action, value }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(s: string) {
    history.replaceState(null, "", "/");
    setSection(s);
    setSelectedProject(null);
    setStatus("");
    setPriority("");
    setDateFilter("");
    setProjectFilter("");
    setSelected([]);
    setMobile(false);
  }
  function edit(t: Task) {
    setEditor({ table: "tasks", id: t.id, value: { ...t } });
  }
  const day = today(),
    counts = stats(tasks, projects, day);
  const visible = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (section === "Completed / Archive") {
            if (!t.archived && t.status !== "Completed") return false;
          } else if (t.archived || t.status === "Completed") return false;
          if (section === "Inbox" && t.status !== "Inbox") return false;
          if (section === "Waiting On" && t.status !== "Waiting") return false;
          if (selectedProject && t.project_id !== selectedProject) return false;
          if (projectFilter && t.project_id !== projectFilter) return false;
          if (status && t.status !== status) return false;
          if (
            priority === "High+" &&
            !["High", "Critical"].includes(t.priority)
          )
            return false;
          if (priority && priority !== "High+" && t.priority !== priority)
            return false;
          if (dateFilter === "today" && t.due_date !== day) return false;
          if (dateFilter === "overdue" && (!t.due_date || t.due_date >= day))
            return false;
          if (
            dateFilter === "week" &&
            (!t.due_date || t.due_date <= day || t.due_date > addDays(day, 7))
          )
            return false;
          return [t.title, t.description, t.notes, t.person, ...t.tags]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
        })
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "priority"
              ? priorities.indexOf(b.priority) - priorities.indexOf(a.priority)
              : (a.due_date || "9999").localeCompare(b.due_date || "9999"),
        ),
    [
      tasks,
      section,
      selectedProject,
      projectFilter,
      status,
      priority,
      dateFilter,
      query,
      day,
      sort,
    ],
  );
  function taskRow(t: Task) {
    return (
      <div className="task-row" key={t.id}>
        <button
          disabled={busy}
          className={"check " + (t.status === "Completed" ? "checked" : "")}
          aria-label={
            t.status === "Completed"
              ? "Reopen " + t.title
              : "Complete " + t.title
          }
          onClick={() =>
            mutate(
              "tasks",
              {
                ...t,
                status: t.status === "Completed" ? "To Do" : "Completed",
              },
              t.id,
            )
          }
        >
          {t.status === "Completed" && <Check size={13} />}
        </button>
        <button className="task-title" onClick={() => edit(t)}>
          <strong>{t.title}</strong>
          <small>
            {projects.find((p) => p.id === t.project_id)?.name || "Personal"}
            {t.parent_id ? " · Subtask" : ""}
            {t.person ? " · " + t.person : ""}
          </small>
        </button>
        <span className={"badge p-" + t.priority}>{t.priority}</span>
        <select
          aria-label={"Status for " + t.title}
          value={t.status}
          disabled={busy}
          onChange={(e) =>
            mutate("tasks", { ...t, status: e.target.value }, t.id)
          }
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span
          className={
            "date " +
            (t.due_date && t.due_date < day && t.status !== "Completed"
              ? "late"
              : "")
          }
        >
          {t.due_date === day
            ? "Today"
            : t.due_date
              ? formatDate(t.due_date)
              : "No date"}
        </span>
      </div>
    );
  }
  function projectCard(p: Project) {
    const pc = progress(tasks, p.id),
      open = tasks.filter(
        (t) => t.project_id === p.id && !t.archived && t.status !== "Completed",
      );
    return (
      <button
        className="project-card"
        key={p.id}
        onClick={() => {
          go("Projects");
          history.pushState(null, "", "/projects/" + p.id);
          setSelectedProject(p.id);
        }}
      >
        <div className="between">
          <span className="project-icon">
            <FolderKanban size={20} />
          </span>
          <span className="badge">{p.status}</span>
        </div>
        <h3>{p.name}</h3>
        <p className="muted">
          {p.category || "General"} · {open.length} outstanding
        </p>
        <div className="progress">
          <i style={{ width: (pc || 0) + "%" }} />
        </div>
        <div className="between">
          <small>{pc === null ? "No tasks yet" : pc + "% complete"}</small>
          <small>
            {p.target_date ? formatDate(p.target_date) : "No target date"}
          </small>
        </div>
      </button>
    );
  }
  const project = projects.find((p) => p.id === selectedProject);
  const title = project?.name || section;
  return (
    <div className={"app " + (collapsed ? "collapsed" : "")}>
      <aside className={mobile ? "mobile-open" : ""}>
        <a className="brand" href="/" aria-label="Project Hub">
          <span className="brand-mark">P</span>
          <b>Project Hub</b>
        </a>
        <p className="eyebrow sidebar-label">MY WORKSPACE</p>
        <nav>
          {nav.map(([s, Icon]) => (
            <button
              key={s}
              className={section === s ? "active" : ""}
              onClick={() => go(s)}
            >
              <Icon size={19} />
              <span>{s}</span>
              {s === "Inbox" && (
                <small>
                  {
                    tasks.filter((t) => !t.archived && t.status === "Inbox")
                      .length
                  }
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setCollapsed(!collapsed)}>
            <PanelLeftClose size={18} />
            <span>Collapse sidebar</span>
          </button>
          <div className="user">
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <div>
              <b>Personal workspace</b>
              <small>{email}</small>
            </div>
            <button
              aria-label="Sign out"
              onClick={async () => {
                await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                location.reload();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button
            className="mobile-menu"
            aria-label="Navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} /> {title}
          </div>
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search tasks and projects"
              placeholder="Search your workspace…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (section === "Dashboard") setSection("My Tasks");
              }}
            />
          </div>
          <button
            className="primary"
            onClick={() =>
              setEditor({
                table: "tasks",
                value: { ...emptyTask, project_id: selectedProject },
              })
            }
          >
            <Plus size={17} />
            New Task
          </button>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {section === "Dashboard"
                  ? new Intl.DateTimeFormat("en-AU", {
                      timeZone: "Australia/Adelaide",
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date())
                  : "YOUR WORKSPACE"}
              </p>
              <h1>{section === "Dashboard" ? "Your day, in focus." : title}</h1>
              <p className="muted">
                {section === "Dashboard"
                  ? "A clear view of what matters and what comes next."
                  : project?.description || descriptions[section]}
              </p>
            </div>
            {section === "Projects" && (
              <button
                className="secondary"
                onClick={() =>
                  setEditor({
                    table: "projects",
                    id: project?.id,
                    value: project ? { ...project } : { ...emptyProject },
                  })
                }
              >
                <Plus size={16} />
                {project ? "Edit project" : "New project"}
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty">Loading your workspace…</div>
          ) : section === "Settings" ? (
            <div className="panel settings">
              <h2>Workspace settings</h2>
              <label>
                Account
                <input value={email} readOnly />
              </label>
              <label>
                Timezone
                <input value="Australia/Adelaide" readOnly />
              </label>
              <label className="between">
                Dark appearance
                <input
                  type="checkbox"
                  checked={dark}
                  onChange={(e) => {
                    const d = e.target.checked;
                    setDark(d);
                    localStorage.setItem("hub-theme", d ? "dark" : "light");
                    document.documentElement.dataset.theme = d
                      ? "dark"
                      : "light";
                  }}
                />
              </label>
              <h3>Change password</h3>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <p className="muted">Use at least 12 characters.</p>
              <input
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="primary"
                disabled={password.length < 12 || !currentPassword}
                onClick={async () => {
                  const r = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "password",
                      password,
                      currentPassword,
                    }),
                  });
                  const b = await r.json();
                  if (r.ok) {
                    setPassword("");
                    setCurrentPassword("");
                    alert("Password updated");
                  } else setError(b.error);
                }}
              >
                Update password
              </button>
              <h3>Backup</h3>
              <p className="muted">
                Download your loaded tasks, projects and recent activity as
                JSON.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob(
                      [
                        JSON.stringify(
                          {
                            version: 1,
                            exported_at: new Date().toISOString(),
                            tasks,
                            projects,
                            activity,
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                  );
                  a.download = "project-hub-backup.json";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                Export data
              </button>
            </div>
          ) : section === "Dashboard" ? (
            <>
              <div className="stats">
                {[
                  ["Outstanding", counts.outstanding, "all"],
                  ["Due today", counts.today, "today"],
                  ["Overdue", counts.overdue, "overdue"],
                  ["Next 7 days", counts.week, "week"],
                  ["High priority", counts.high, "high"],
                  ["Waiting on", counts.waiting, "waiting"],
                  ["Active projects", counts.projects, "projects"],
                ].map(([label, n, f]) => (
                  <button
                    className={
                      "stat " +
                      (f === "overdue" && Number(n) > 0 ? "attention" : "")
                    }
                    key={f}
                    onClick={() => {
                      go(
                        f === "projects"
                          ? "Projects"
                          : f === "waiting"
                            ? "Waiting On"
                            : "My Tasks",
                      );
                      if (["today", "overdue", "week"].includes(String(f)))
                        setDateFilter(String(f));
                      if (f === "high") setPriority("High+");
                    }}
                  >
                    <span>{label}</span>
                    <strong>{n}</strong>
                    <small>
                      View {f === "projects" ? "projects" : "tasks"}{" "}
                      <ChevronRight size={12} />
                    </small>
                  </button>
                ))}
              </div>
              <form
                className="capture"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await mutate("tasks", { ...emptyTask, title: capture }))
                    setCapture("");
                }}
              >
                <Plus size={20} />
                <input
                  aria-label="Quick task capture"
                  value={capture}
                  onChange={(e) => setCapture(e.target.value)}
                  placeholder="Something on your mind? Add it to your Inbox."
                  required
                />
                <button disabled={busy || !capture.trim()}>
                  Add to Inbox <ChevronRight size={15} />
                </button>
              </form>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Today's priorities</h2>
                    <span className="badge">Focus</span>
                  </div>
                  {tasks
                    .filter(
                      (t) =>
                        !t.archived &&
                        t.status !== "Completed" &&
                        (t.due_date === day ||
                          ["High", "Critical"].includes(t.priority)),
                    )
                    .slice(0, 8)
                    .map(taskRow)}
                  {!tasks.some(
                    (t) =>
                      !t.archived &&
                      t.status !== "Completed" &&
                      (t.due_date === day ||
                        ["High", "Critical"].includes(t.priority)),
                  ) && <Empty text="Nothing urgent. Space to make progress." />}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Upcoming deadlines</h2>
                    <CalendarDays size={18} />
                  </div>
                  {tasks
                    .filter(
                      (t) =>
                        !t.archived &&
                        t.status !== "Completed" &&
                        t.due_date &&
                        t.due_date >= day,
                    )
                    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
                    .slice(0, 5)
                    .map((t) => (
                      <button
                        className="deadline"
                        key={t.id}
                        onClick={() => edit(t)}
                      >
                        <span className="date-block">
                          {t.due_date?.slice(8)}
                          <small>
                            {new Date(
                              t.due_date + "T12:00:00",
                            ).toLocaleDateString("en-AU", { month: "short" })}
                          </small>
                        </span>
                        <span>
                          <b>{t.title}</b>
                          <small>
                            {projects.find((p) => p.id === t.project_id)
                              ?.name || "Personal"}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  {!tasks.some(
                    (t) =>
                      !t.archived &&
                      t.status !== "Completed" &&
                      t.due_date &&
                      t.due_date >= day,
                  ) && <Empty text="No upcoming deadlines." />}
                </section>
              </div>
              <div className="section-heading">
                <h2>Active projects</h2>
                <button className="text-button" onClick={() => go("Projects")}>
                  View all <ChevronRight size={14} />
                </button>
              </div>
              <div className="projects-grid">
                {projects
                  .filter((p) => p.status === "Active")
                  .slice(0, 6)
                  .map(projectCard)}
              </div>
              {!projects.some((p) => p.status === "Active") && (
                <div className="panel">
                  <Empty text="Create a project to give your work a home." />
                  <button
                    className="secondary"
                    onClick={() =>
                      setEditor({
                        table: "projects",
                        value: { ...emptyProject },
                      })
                    }
                  >
                    Create your first project
                  </button>
                </div>
              )}
              <div className="dashboard-grid lower">
                <section className="panel">
                  <h2>Waiting on</h2>
                  {tasks
                    .filter((t) => !t.archived && t.status === "Waiting")
                    .slice(0, 5)
                    .map(taskRow)}
                  {!counts.waiting && (
                    <Empty text="No outstanding responses." />
                  )}
                </section>
                <section className="panel">
                  <h2>Recent activity</h2>
                  {activity.slice(0, 6).map((a) => (
                    <div className="activity" key={a.id}>
                      <span className="activity-dot" />
                      <div>
                        <b>{a.title}</b>
                        <small>
                          {a.action === "insert"
                            ? "Created"
                            : a.action === "delete"
                              ? "Deleted"
                              : "Updated"}{" "}
                          ·{" "}
                          {new Date(a.created_at).toLocaleString("en-AU", {
                            timeZone: "Australia/Adelaide",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!activity.length && (
                    <Empty text="Your progress will appear here." />
                  )}
                </section>
              </div>
            </>
          ) : section === "Projects" && !selectedProject ? (
            <div className="projects-grid">
              {projects
                .filter((p) =>
                  [p.name, p.description, p.notes, p.category]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map(projectCard)}
              {!projects.length && (
                <Empty text="No projects yet. Create your first one." />
              )}
            </div>
          ) : (
            <>
              {project && (
                <div className="panel overview">
                  <span className="badge">{project.status}</span>
                  <p>
                    {progress(tasks, project.id) === null
                      ? "No tasks yet"
                      : progress(tasks, project.id) + "% complete"}{" "}
                    · Target:{" "}
                    {project.target_date
                      ? formatDate(project.target_date)
                      : "Not set"}
                  </p>
                  <p className="muted">{project.notes}</p>
                  <div className="progress">
                    <i
                      style={{
                        width: (progress(tasks, project.id) || 0) + "%",
                      }}
                    />
                  </div>
                </div>
              )}
              {query && section !== "Projects" && (
                <div className="projects-grid">
                  {projects
                    .filter((p) =>
                      [p.name, p.description, p.notes, p.category]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map(projectCard)}
                </div>
              )}
              <div className="filters">
                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">All priorities</option>
                  <option value="High+">High and Critical</option>
                  {priorities.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter project"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter due date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="">All dates</option>
                  <option value="today">Due today</option>
                  <option value="overdue">Overdue</option>
                  <option value="week">Next 7 days</option>
                </select>
                <select
                  aria-label="Sort tasks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="due">Due date</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                </select>
                <button
                  className="secondary"
                  onClick={() => setView(view === "List" ? "Kanban" : "List")}
                >
                  {view === "List" ? "Kanban view" : "List view"}
                </button>
              </div>
              {selected.length > 0 && (
                <div className="bulk">
                  {selected.length} selected
                  <button
                    disabled={busy}
                    onClick={async () => {
                      for (const id of selected) {
                        const t = tasks.find((t) => t.id === id)!;
                        if (
                          !(await mutate(
                            "tasks",
                            { ...t, status: "Completed" },
                            id,
                          ))
                        )
                          break;
                      }
                      setSelected([]);
                    }}
                  >
                    Complete selected
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      for (const id of selected) {
                        const t = tasks.find((t) => t.id === id)!;
                        if (
                          !(await mutate("tasks", { ...t, archived: true }, id))
                        )
                          break;
                      }
                      setSelected([]);
                    }}
                  >
                    Archive selected
                  </button>
                </div>
              )}
              {view === "Kanban" ? (
                <div className="kanban">
                  {statuses.map((s) => (
                    <section key={s}>
                      <h3>
                        {s}{" "}
                        <small>
                          {visible.filter((t) => t.status === s).length}
                        </small>
                      </h3>
                      {visible
                        .filter((t) => t.status === s)
                        .map((t) => (
                          <button
                            key={t.id}
                            className="kanban-card"
                            onClick={() => edit(t)}
                          >
                            <strong>{t.title}</strong>
                            <span className={"badge p-" + t.priority}>
                              {t.priority}
                            </span>
                            <small>
                              {t.due_date ? formatDate(t.due_date) : "No date"}
                            </small>
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel task-list">
                  <div className="section-heading">
                    <h2>{visible.length} tasks</h2>
                    <span className="muted">
                      Sorted by {sort === "due" ? "due date" : sort}
                    </span>
                  </div>
                  {visible.map((t) => (
                    <div className="select-row" key={t.id}>
                      <input
                        type="checkbox"
                        aria-label={"Select " + t.title}
                        checked={selected.includes(t.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, t.id]
                              : selected.filter((id) => id !== t.id),
                          )
                        }
                      />
                      {taskRow(t)}
                    </div>
                  ))}
                  {!visible.length && (
                    <Empty text="No tasks match this view." />
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
      {editor && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setEditor(null)}
        >
          <section
            ref={drawerRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={
              editor.table === "tasks" ? "Task details" : "Project details"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>
                {editor.id ? "Edit" : "New"}{" "}
                {editor.table === "tasks" ? "task" : "project"}
              </h2>
              <button
                aria-label="Close details"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutate(editor.table, editor.value, editor.id))
                  setEditor(null);
              }}
            >
              {editor.table === "tasks" ? (
                <>
                  <Field
                    name="Title"
                    field="title"
                    editor={editor}
                    set={setEditor}
                    required
                  />
                  <Field
                    name="Description"
                    field="description"
                    editor={editor}
                    set={setEditor}
                    area
                  />
                  <div className="two-cols">
                    <Select
                      label="Status"
                      field="status"
                      choices={statuses}
                      editor={editor}
                      set={setEditor}
                    />
                    <Select
                      label="Priority"
                      field="priority"
                      choices={priorities}
                      editor={editor}
                      set={setEditor}
                    />
                  </div>
                  <label>
                    Project
                    <select
                      value={editor.value.project_id || ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            project_id: e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Parent task
                    <select
                      value={editor.value.parent_id || ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            parent_id: e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">No parent</option>
                      {tasks
                        .filter((t) => t.id !== editor.id && !t.archived)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="two-cols">
                    <Field
                      name="Start date"
                      field="start_date"
                      editor={editor}
                      set={setEditor}
                      type="date"
                    />
                    <Field
                      name="Due date"
                      field="due_date"
                      editor={editor}
                      set={setEditor}
                      type="date"
                    />
                  </div>
                  <Field
                    name="Person / organisation"
                    field="person"
                    editor={editor}
                    set={setEditor}
                  />
                  <label>
                    Tags (comma separated)
                    <input
                      defaultValue={editor.value.tags.join(", ")}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            tags: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </label>
                  <Field
                    name="Notes"
                    field="notes"
                    editor={editor}
                    set={setEditor}
                    area
                  />
                  <label className="between">
                    Archived
                    <input
                      type="checkbox"
                      checked={editor.value.archived}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            archived: e.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  {editor.id && (
                    <>
                      <h3>Subtasks</h3>
                      {tasks
                        .filter((t) => t.parent_id === editor.id)
                        .map((t) => (
                          <button
                            className="subtask"
                            key={t.id}
                            type="button"
                            onClick={() => edit(t)}
                          >
                            {t.title} · {t.status}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setEditor({
                            table: "tasks",
                            value: {
                              ...emptyTask,
                              status: "To Do",
                              parent_id: editor.id,
                              project_id: editor.value.project_id,
                            },
                          })
                        }
                      >
                        Add subtask
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Field
                    name="Project name"
                    field="name"
                    editor={editor}
                    set={setEditor}
                    required
                  />
                  <Field
                    name="Description"
                    field="description"
                    editor={editor}
                    set={setEditor}
                    area
                  />
                  <Field
                    name="Category"
                    field="category"
                    editor={editor}
                    set={setEditor}
                  />
                  <div className="two-cols">
                    <Select
                      label="Status"
                      field="status"
                      choices={projectStatuses}
                      editor={editor}
                      set={setEditor}
                    />
                    <Select
                      label="Priority"
                      field="priority"
                      choices={priorities}
                      editor={editor}
                      set={setEditor}
                    />
                  </div>
                  <Field
                    name="Start date"
                    field="start_date"
                    editor={editor}
                    set={setEditor}
                    type="date"
                  />
                  <Field
                    name="Target completion"
                    field="target_date"
                    editor={editor}
                    set={setEditor}
                    type="date"
                  />
                  <Field
                    name="Actual completion"
                    field="actual_date"
                    editor={editor}
                    set={setEditor}
                    type="date"
                  />
                  <Field
                    name="Notes"
                    field="notes"
                    editor={editor}
                    set={setEditor}
                    area
                  />
                </>
              )}
              {error && (
                <p role="alert" className="late">
                  {error}
                </p>
              )}
              <div className="drawer-actions">
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                {editor.id && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        confirm(
                          "Permanently delete this " +
                            (editor.table === "tasks" ? "task" : "project") +
                            "? Records with linked tasks must be unlinked first.",
                        ) &&
                        (await mutate(editor.table, {}, editor.id, "delete"))
                      )
                        setEditor(null);
                    }}
                  >
                    Delete
                  </button>
                )}
                {editor.id && editor.table === "tasks" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setEditor({
                        table: "tasks",
                        value: {
                          ...editor.value,
                          title: editor.value.title + " (copy)",
                          status: "Inbox",
                          parent_id: null,
                          archived: false,
                        },
                      })
                    }
                  >
                    Duplicate
                  </button>
                )}
              </div>
            </form>
            {editor.id && (
              <>
                <h3>Recent activity</h3>
                {activity
                  .filter((a) => a.entity_id === editor.id)
                  .slice(0, 5)
                  .map((a) => (
                    <p className="muted" key={a.id}>
                      {a.action} ·{" "}
                      {new Date(a.created_at).toLocaleString("en-AU", {
                        timeZone: "Australia/Adelaide",
                      })}
                    </p>
                  ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ListTodo size={25} />
      <p>{text}</p>
    </div>
  );
}
function formatDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}
const descriptions: Record<string, string> = {
  Inbox: "Capture first. Organise when you’re ready.",
  "My Tasks": "Your next steps, organised in one place.",
  Projects: "Give every piece of work a clear direction.",
  "Waiting On": "Keep track of the responses you need.",
  "Completed / Archive": "A record of what you’ve achieved.",
  Settings: "Make this workspace yours.",
};
function Field({
  name,
  field,
  editor,
  set,
  required = false,
  area = false,
  type = "text",
}: any) {
  const props = {
    value: editor.value[field] || "",
    required,
    onChange: (e: any) =>
      set({
        ...editor,
        value: {
          ...editor.value,
          [field]: type === "date" ? e.target.value || null : e.target.value,
        },
      }),
  };
  return (
    <label>
      {name}
      {area ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} type={type} />
      )}
    </label>
  );
}
function Select({ label, field, choices, editor, set }: any) {
  return (
    <label>
      {label}
      <select
        value={editor.value[field]}
        onChange={(e) =>
          set({
            ...editor,
            value: { ...editor.value, [field]: e.target.value },
          })
        }
      >
        {choices.map((s: string) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}
