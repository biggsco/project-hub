"use client";
import BucketPicker from "./bucket-picker";
import TagFilter from "./tag-filter";
import TagPicker from "./tag-picker";
import OrganisationManager from "./organisation-manager";
import {
  nameKey,
  matchesTags,
  type Bucket,
  type Tag,
} from "@/lib/organisation";
import QuickAdd from "./quick-add";
import SmartDate from "./smart-date";
import {
  classifications,
  efforts,
  suitableTasks,
  actionable,
  assignmentChange,
} from "@/lib/capture";
import { taskSchema, projectSchema } from "@/lib/model";
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
  ["Ongoing", ListTodo],
  ["Downtime", Clock],
  ["Delegated / Waiting On", Clock],
  ["Calendar", CalendarDays],
  ["Completed / Archive", Archive],
  ["Settings", Settings],
] as const;
const emptyTask = taskSchema.parse({ title: "New task" });
emptyTask.title = "";
const emptyProject = projectSchema.parse({ name: "New project" });
emptyProject.name = "";
export default function Hub({
  email,
  initialProject,
}: {
  email: string;
  initialProject?: string;
}) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [bucketFilter, setBucketFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [grouped, setGrouped] = useState(true);
  const pendingTaskIds = useRef(new Set<string>());
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const drawerRef = useRef<HTMLElement>(null);
  const [effortFilter, setEffortFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [availableTime, setAvailableTime] = useState(30);
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
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
      setTasks((current) =>
        b.tasks.map((t: Task) =>
          pendingTaskIds.current.has(t.id)
            ? current.find((row) => row.id === t.id) || t
            : t,
        ),
      );
      setProjects(b.projects);
      setActivity(b.activity);
      setBuckets(b.buckets || []);
      const nextTags: Tag[] = b.tags || [];
      setTagFilter((current) =>
        current.flatMap((name) => {
          const previous = tags.find(
            (tag) => nameKey(tag.name) === nameKey(name),
          );
          const next = nextTags.find((tag) =>
            previous
              ? tag.id === previous.id
              : nameKey(tag.name) === nameKey(name),
          );
          return next ? [next.name] : [];
        }),
      );
      setTags(nextTags);
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
  async function completeTask(t: Task) {
    if (pendingTaskIds.current.has(t.id)) return;
    pendingTaskIds.current.add(t.id);
    setPendingTasks([...pendingTaskIds.current]);
    setError("");
    const optimistic = {
      ...t,
      status: (t.status === "Completed"
        ? "To Do"
        : "Completed") as Task["status"],
      completed_at: t.status === "Completed" ? null : new Date().toISOString(),
    };
    setTasks((current) =>
      current.map((row) => (row.id === t.id ? optimistic : row)),
    );
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "tasks",
          id: t.id,
          action: "save",
          value: optimistic,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to update task.");
      setTasks((current) =>
        current.map((row) => (row.id === t.id ? b.record : row)),
      );
      setActivity((current) =>
        [
          {
            id: crypto.randomUUID(),
            entity_id: t.id,
            title: b.record.title,
            action: "update",
            created_at: b.record.updated_at,
          },
          ...current,
        ].slice(0, 100),
      );
    } catch (e) {
      setTasks((current) => current.map((row) => (row.id === t.id ? t : row)));
      setError(
        (e as Error).message + " The task's previous status has been restored.",
      );
    } finally {
      pendingTaskIds.current.delete(t.id);
      setPendingTasks([...pendingTaskIds.current]);
    }
  }
  async function manage(input: Record<string, unknown>) {
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      await load();
      return b.record || true;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }
  async function createBucket(name: string): Promise<Bucket | null> {
    return await manage({ action: "bucket_save", value: { name } });
  }
  function go(s: string) {
    history.replaceState(null, "", "/");
    setSection(s);
    setSelectedProject(null);
    setStatus("");
    setPriority("");
    setDateFilter("");
    setSort(s === "Delegated / Waiting On" ? "followup" : "due");
    setProjectFilter("");
    setSelected([]);
    setBucketFilter("");
    setTagFilter([]);
    setEffortFilter("");
    setAssignmentFilter("");
    setClassificationFilter("");
    setShowSnoozed(false);
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
          if (!query) {
            if (section === "Completed / Archive") {
              if (!t.archived && t.status !== "Completed") return false;
            } else if (t.archived || t.status === "Completed") return false;
          }
          if (
            section === "Inbox" &&
            (t.classification !== "Standard" ||
              t.status !== "Inbox" ||
              !!t.assigned_to)
          )
            return false;
          if (
            section === "Delegated / Waiting On" &&
            t.status !== "Waiting" &&
            !t.assigned_to
          )
            return false;
          if (
            ["Downtime", "Ongoing"].includes(section) &&
            t.classification !== section
          )
            return false;
          if (classificationFilter && t.classification !== classificationFilter)
            return false;
          if (
            effortFilter &&
            (!t.effort_minutes ||
              t.effort_minutes >
                (effortFilter === "quick" ? 30 : Number(effortFilter)))
          )
            return false;
          if (effortFilter === "quick" && !actionable(t, day)) return false;
          if (
            assignmentFilter === "unassigned" &&
            (t.assigned_to || (section === "Downtime" && !actionable(t, day)))
          )
            return false;
          if (
            assignmentFilter &&
            assignmentFilter !== "unassigned" &&
            t.assigned_to !== assignmentFilter
          )
            return false;
          if (
            !showSnoozed &&
            !query &&
            !selectedProject &&
            !bucketFilter &&
            section !== "Completed / Archive" &&
            t.snoozed_until &&
            t.snoozed_until > day
          )
            return false;
          if (selectedProject && t.project_id !== selectedProject) return false;
          if (projectFilter && t.project_id !== projectFilter) return false;
          if (bucketFilter === "none" && t.bucket_id) return false;
          if (
            bucketFilter &&
            bucketFilter !== "none" &&
            t.bucket_id !== bucketFilter
          )
            return false;
          if (!matchesTags(t.tags, tagFilter)) return false;
          if (status && t.status !== status) return false;
          if (
            priority === "High+" &&
            !["High", "Critical"].includes(t.priority)
          )
            return false;
          if (priority && priority !== "High+" && t.priority !== priority)
            return false;
          if (dateFilter === "today" && t.due_date !== day) return false;
          if (
            dateFilter === "overdue" &&
            (t.classification === "Ongoing" || !t.due_date || t.due_date >= day)
          )
            return false;
          if (
            dateFilter === "week" &&
            (!t.due_date || t.due_date <= day || t.due_date > addDays(day, 7))
          )
            return false;
          return [
            t.title,
            t.description,
            t.notes,
            t.person,
            t.assigned_to,
            t.assignment_notes,
            t.classification,
            t.next_action,
            buckets.find((b) => b.id === t.bucket_id)?.name || "",
            ...t.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
        })
        .sort((a, b) =>
          sort === "effort"
            ? (a.effort_minutes ?? 99999) - (b.effort_minutes ?? 99999)
            : sort === "assignment"
              ? a.assigned_to.localeCompare(b.assigned_to)
              : sort === "status"
                ? statuses.indexOf(a.status) - statuses.indexOf(b.status)
                : sort === "tags"
                  ? a.tags.join(", ").localeCompare(b.tags.join(", "))
                  : sort === "followup"
                    ? (a.follow_up_date || "9999").localeCompare(
                        b.follow_up_date || "9999",
                      )
                    : sort === "title"
                      ? a.title.localeCompare(b.title)
                      : sort === "priority"
                        ? priorities.indexOf(b.priority) -
                          priorities.indexOf(a.priority)
                        : (a.due_date || "9999").localeCompare(
                            b.due_date || "9999",
                          ),
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
      effortFilter,
      assignmentFilter,
      classificationFilter,
      showSnoozed,
      buckets,
      bucketFilter,
      tagFilter,
    ],
  );
  function taskRow(t: Task) {
    return (
      <div className="task-row" key={t.id}>
        <button
          disabled={busy || pendingTasks.includes(t.id)}
          className={"check " + (t.status === "Completed" ? "checked" : "")}
          aria-label={
            t.status === "Completed"
              ? "Reopen " + t.title
              : "Complete " + t.title
          }
          aria-busy={pendingTasks.includes(t.id)}
          onClick={() => completeTask(t)}
        >
          {t.status === "Completed" && <Check size={13} />}
        </button>
        <button
          className="task-title"
          disabled={pendingTasks.includes(t.id)}
          onClick={() => edit(t)}
        >
          <strong>{t.title}</strong>
          <small>
            {projects.find((p) => p.id === t.project_id)?.name || "Personal"}
            {t.parent_id ? " · Subtask" : ""}
            {t.person ? " · " + t.person : ""}
            {t.bucket_id
              ? " · " +
                (buckets.find((b) => b.id === t.bucket_id)?.name || "Bucket")
              : ""}
            {t.tags.length ? " · " + t.tags.join(", ") : ""}
            {t.classification !== "Standard" ? " · " + t.classification : ""}
            {t.assigned_to ? " · Waiting on " + t.assigned_to : ""}
            {t.effort_minutes
              ? " · " + efforts.find(([n]) => n === t.effort_minutes)?.[1]
              : ""}
            {t.is_milestone ? " · Milestone" : ""}
            {t.snoozed_until && t.snoozed_until > day
              ? " · Snoozed until " + formatDate(t.snoozed_until)
              : ""}
            {t.next_action ? " · Next: " + t.next_action : ""}
            {t.follow_up_date && t.assigned_to
              ? " · Follow up " + formatDate(t.follow_up_date)
              : ""}
          </small>
        </button>
        {t.priority !== "None" && (
          <span className={"badge p-" + t.priority}>{t.priority}</span>
        )}
        <select
          aria-label={"Status for " + t.title}
          value={t.status}
          disabled={busy || pendingTasks.includes(t.id)}
          onChange={(e) =>
            mutate("tasks", { ...t, status: e.target.value }, t.id)
          }
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div
          className={
            "date " +
            (t.classification !== "Ongoing" &&
            t.status !== "Completed" &&
            !t.archived &&
            t.due_date &&
            t.due_date < day
              ? "late"
              : "")
          }
        >
          <SmartDate
            label={"Deadline for " + t.title}
            value={t.due_date}
            someday={t.date_preferences.due_date === "Someday"}
            disabled={busy || pendingTasks.includes(t.id)}
            onChange={(due_date, someday) => {
              const date_preferences = { ...t.date_preferences };
              delete date_preferences.due_date;
              if (someday) date_preferences.due_date = "Someday";
              mutate("tasks", { ...t, due_date, date_preferences }, t.id);
            }}
          />
        </div>
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
        {p.next_action && <p className="muted">Next: {p.next_action}</p>}
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
                    tasks.filter(
                      (t) =>
                        !t.archived &&
                        t.status === "Inbox" &&
                        t.classification === "Standard" &&
                        !t.assigned_to,
                    ).length
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
                if (
                  e.target.value &&
                  (section !== "My Tasks" || selectedProject)
                )
                  go("My Tasks");
              }}
            />
          </div>
          <button
            className="primary"
            onClick={() => {
              document
                .querySelector<HTMLInputElement>(
                  '[aria-label="Quick Add task"]',
                )
                ?.focus();
              document
                .querySelector('[aria-label="Quick Add"]')
                ?.scrollIntoView({ block: "center" });
            }}
          >
            <Plus size={17} />
            Quick Add
          </button>
        </header>
        <div className="content">
          <QuickAdd
            buckets={buckets}
            tags={tags}
            onCreateBucket={createBucket}
            contextSection={section}
            contextKey={`${section}:${selectedProject || ""}:${bucketFilter}`}
            contextProject={selectedProject}
            projectName={project?.name}
            contextBucket={
              bucketFilter === "none" ? null : bucketFilter || undefined
            }
            onCreated={(records, libraryTags) => {
              setTags((current) => [
                ...libraryTags,
                ...current.filter(
                  (t) => !libraryTags.some((n) => n.id === t.id),
                ),
              ]);
              setTasks((current) => [
                ...records,
                ...current.filter((t) => !records.some((r) => r.id === t.id)),
              ]);
              setActivity((current) =>
                [
                  ...records.map((t) => ({
                    id: "capture-" + t.id,
                    title: t.title,
                    action: "insert",
                    created_at: t.created_at,
                    entity_id: t.id,
                  })),
                  ...current.filter(
                    (a) =>
                      !records.some(
                        (t) => a.entity_id === t.id && a.action === "insert",
                      ),
                  ),
                ].slice(0, 100),
              );
            }}
          />
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
          {section === "Projects" && !selectedProject && (
            <div className="filters">
              <TagFilter
                tags={tags}
                value={tagFilter}
                onChange={setTagFilter}
                label="Filter project tag"
              />
            </div>
          )}
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
              <OrganisationManager
                tasks={tasks}
                buckets={buckets}
                tags={tags}
                manage={manage}
              />
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
                            buckets,
                            tags,
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
                  ["Due today", counts.today, "today"],
                  ["Overdue", counts.overdue, "overdue"],
                  ["Next 7 days", counts.week, "week"],
                  ["Waiting on", counts.waiting, "waiting"],
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
                            ? "Delegated / Waiting On"
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
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Today's priorities</h2>
                    <span className="badge">Focus</span>
                  </div>
                  {tasks
                    .filter(
                      (t) =>
                        actionable(t, day) &&
                        (t.due_date === day ||
                          ["High", "Critical"].includes(t.priority)),
                    )
                    .slice(0, 8)
                    .map(taskRow)}
                  {!tasks.some(
                    (t) =>
                      actionable(t, day) &&
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
                        actionable(t, day) && t.due_date && t.due_date >= day,
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
                      actionable(t, day) && t.due_date && t.due_date >= day,
                  ) && <Empty text="No upcoming deadlines." />}
                </section>
              </div>
              <section className="panel time-panel">
                <div className="section-heading">
                  <h2>I've got some time</h2>
                  <select
                    aria-label="Available time"
                    value={availableTime}
                    onChange={(e) => setAvailableTime(Number(e.target.value))}
                  >
                    {efforts.slice(0, 4).map(([n, label]) => (
                      <option key={n} value={n}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="muted">
                  Downtime and quick wins that fit. Add an effort estimate in
                  task details.
                </p>
                {suitableTasks(tasks, availableTime, day)
                  .slice(0, 5)
                  .map(taskRow)}
                {!suitableTasks(tasks, availableTime, day).length && (
                  <Empty text="No tasks with an estimate fit this time yet." />
                )}
              </section>
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
                    .filter(
                      (t) =>
                        !t.archived &&
                        t.status !== "Completed" &&
                        (t.status === "Waiting" || !!t.assigned_to) &&
                        (!t.snoozed_until || t.snoozed_until <= day),
                    )
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
          ) : section === "Calendar" ? (
            <section className="panel calendar-panel">
              <div className="section-heading">
                <h2>Deadlines and follow-ups</h2>
                <input
                  aria-label="Calendar month"
                  type="month"
                  value={calendarMonth}
                  onChange={(e) =>
                    setCalendarMonth(e.target.value || day.slice(0, 7))
                  }
                />
              </div>
              <div className="calendar-grid">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <b key={d}>{d}</b>
                ))}
                {Array.from(
                  {
                    length:
                      (new Date(calendarMonth + "-01T12:00:00Z").getUTCDay() +
                        6) %
                      7,
                  },
                  (_, i) => (
                    <div key={"blank" + i} />
                  ),
                )}
                {Array.from(
                  {
                    length: new Date(
                      Number(calendarMonth.slice(0, 4)),
                      Number(calendarMonth.slice(5)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => {
                    const date =
                      calendarMonth + "-" + String(i + 1).padStart(2, "0");
                    return (
                      <div
                        className={
                          "calendar-day " +
                          (date === day ? "calendar-today" : "")
                        }
                        key={date}
                      >
                        <b>{i + 1}</b>
                        {tasks
                          .filter(
                            (t) =>
                              !t.archived &&
                              t.status !== "Completed" &&
                              (t.due_date === date ||
                                t.follow_up_date === date),
                          )
                          .map((t) => (
                            <button key={t.id} onClick={() => edit(t)}>
                              {t.follow_up_date === date
                                ? "Follow up: "
                                : t.is_milestone
                                  ? "Milestone: "
                                  : ""}
                              {t.title}
                            </button>
                          ))}
                        {projects
                          .filter(
                            (p) =>
                              p.target_date === date &&
                              !["Completed", "Archived"].includes(p.status),
                          )
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                go("Projects");
                                setSelectedProject(p.id);
                              }}
                            >
                              Project: {p.name}
                            </button>
                          ))}
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          ) : section === "Projects" && !selectedProject ? (
            <div className="projects-grid">
              {projects
                .filter((p) => matchesTags(p.tags, tagFilter))
                .filter((p) =>
                  [
                    p.name,
                    p.description,
                    p.notes,
                    p.category,
                    p.next_action,
                    ...p.tags,
                  ]
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
              {section === "Downtime" && (
                <>
                  <div
                    className="downtime-buckets"
                    aria-label="Downtime buckets"
                  >
                    <button
                      className={"chip " + (!bucketFilter ? "selected" : "")}
                      onClick={() => setBucketFilter("")}
                    >
                      All Downtime (
                      {
                        tasks.filter(
                          (t) =>
                            t.classification === "Downtime" &&
                            !t.archived &&
                            t.status !== "Completed",
                        ).length
                      }
                      )
                    </button>
                    {buckets
                      .filter(
                        (b) =>
                          !b.archived ||
                          tasks.some(
                            (t) =>
                              t.bucket_id === b.id &&
                              t.classification === "Downtime" &&
                              !t.archived &&
                              t.status !== "Completed",
                          ),
                      )
                      .toSorted((a, b) => a.position - b.position)
                      .map((b) => (
                        <button
                          className={
                            "chip " + (bucketFilter === b.id ? "selected" : "")
                          }
                          key={b.id}
                          onClick={() => setBucketFilter(b.id)}
                          title={b.description}
                        >
                          {b.name}
                          {b.archived ? " (archived)" : ""} (
                          {
                            tasks.filter(
                              (t) =>
                                t.bucket_id === b.id &&
                                t.classification === "Downtime" &&
                                !t.archived &&
                                t.status !== "Completed",
                            ).length
                          }
                          )
                        </button>
                      ))}
                    <button
                      className={
                        "chip " + (bucketFilter === "none" ? "selected" : "")
                      }
                      onClick={() => setBucketFilter("none")}
                    >
                      Uncategorised (
                      {
                        tasks.filter(
                          (t) =>
                            !t.bucket_id &&
                            t.classification === "Downtime" &&
                            !t.archived &&
                            t.status !== "Completed",
                        ).length
                      }
                      )
                    </button>
                    <button
                      className={
                        "chip " +
                        (assignmentFilter === "unassigned" ? "selected" : "")
                      }
                      onClick={() =>
                        setAssignmentFilter(
                          assignmentFilter === "unassigned" ? "" : "unassigned",
                        )
                      }
                    >
                      Available to Delegate
                    </button>
                    <button
                      className={
                        "chip " + (effortFilter === "quick" ? "selected" : "")
                      }
                      onClick={() =>
                        setEffortFilter(effortFilter === "quick" ? "" : "quick")
                      }
                    >
                      Quick Wins
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setGrouped(!grouped);
                        setView("List");
                      }}
                    >
                      {grouped ? "Flat list" : "Grouped list"}
                    </button>
                  </div>
                  <OrganisationManager
                    tasks={tasks}
                    buckets={buckets}
                    tags={tags}
                    manage={manage}
                  />
                </>
              )}
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
                  {project.next_action && (
                    <p>
                      Next action: <strong>{project.next_action}</strong>
                    </p>
                  )}
                  <button
                    className="secondary"
                    onClick={() =>
                      setEditor({
                        table: "tasks",
                        value: {
                          ...emptyTask,
                          project_id: project.id,
                          status: "To Do",
                        },
                      })
                    }
                  >
                    Add project task
                  </button>{" "}
                  <button
                    className="secondary"
                    onClick={() =>
                      setEditor({
                        table: "tasks",
                        value: {
                          ...emptyTask,
                          project_id: project.id,
                          is_milestone: true,
                          status: "To Do",
                        },
                      })
                    }
                  >
                    Add milestone
                  </button>
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
                      [
                        p.name,
                        p.description,
                        p.notes,
                        p.category,
                        p.next_action,
                        ...p.tags,
                      ]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map(projectCard)}
                </div>
              )}
              <div className="filters">
                <select
                  aria-label="Filter bucket"
                  value={bucketFilter}
                  onChange={(e) => setBucketFilter(e.target.value)}
                >
                  <option value="">All buckets</option>
                  <option value="none">Uncategorised</option>
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.archived ? " (archived)" : ""}
                    </option>
                  ))}
                </select>
                <TagFilter
                  tags={tags}
                  value={tagFilter}
                  onChange={setTagFilter}
                  label="Filter tag"
                />
                <select
                  aria-label="Filter classification"
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                >
                  <option value="">All classifications</option>
                  {classifications.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter effort"
                  value={effortFilter}
                  onChange={(e) => setEffortFilter(e.target.value)}
                >
                  <option value="">Any effort</option>
                  <option value="quick">Quick Wins (up to 30 min)</option>
                  {efforts.map(([n, label]) => (
                    <option key={n} value={n}>
                      Up to {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter assignment"
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value)}
                >
                  <option value="">Any assignment</option>
                  <option value="unassigned">
                    {section === "Downtime"
                      ? "Available to Delegate"
                      : "Unassigned"}
                  </option>
                  {Array.from(
                    new Set(tasks.map((t) => t.assigned_to).filter(Boolean)),
                  )
                    .sort()
                    .map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                </select>
                <label className="snooze-filter">
                  <input
                    type="checkbox"
                    checked={showSnoozed}
                    onChange={(e) => setShowSnoozed(e.target.checked)}
                  />
                  Show snoozed
                </label>
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
                  <option value="followup">Follow-up date</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                  <option value="effort">Effort</option>
                  <option value="assignment">Assignment</option>
                  <option value="status">Status</option>
                  <option value="tags">Tags</option>
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
                            {t.priority !== "None" && (
                              <span className={"badge p-" + t.priority}>
                                {t.priority}
                              </span>
                            )}
                            <small>
                              {t.due_date
                                ? formatDate(t.due_date)
                                : t.date_preferences.due_date === "Someday"
                                  ? "Someday"
                                  : "No deadline"}
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
                  {section === "Downtime" && grouped
                    ? [
                        ...buckets
                          .toSorted((a, b) => a.position - b.position)
                          .map((b) => ({
                            id: b.id,
                            name: b.name + (b.archived ? " (archived)" : ""),
                            description: b.description,
                            archived: b.archived,
                          })),
                        {
                          id: null,
                          name: "Uncategorised",
                          description: "",
                          archived: false,
                        },
                      ].map((bucket) => {
                        const rows = visible.filter(
                          (t) => t.bucket_id === bucket.id,
                        );
                        if (!rows.length) return null;
                        return (
                          <section
                            className="bucket-group"
                            key={bucket.id || "none"}
                          >
                            <div className="section-heading">
                              <div>
                                <h3>
                                  {bucket.name} <small>{rows.length}</small>
                                </h3>
                                {bucket.description && (
                                  <p className="muted">{bucket.description}</p>
                                )}
                              </div>
                              <button
                                className="text-button"
                                disabled={bucket.archived}
                                onClick={() => {
                                  setBucketFilter(bucket.id || "none");
                                  document
                                    .querySelector<HTMLInputElement>(
                                      '[aria-label="Quick Add task"]',
                                    )
                                    ?.focus();
                                }}
                              >
                                Add here
                              </button>
                            </div>
                            {rows.map(taskRow)}
                          </section>
                        );
                      })
                    : visible.map((t) => (
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
                  <BucketPicker
                    buckets={buckets}
                    value={editor.value.bucket_id}
                    onChange={(bucket_id) =>
                      setEditor({
                        ...editor,
                        value: { ...editor.value, bucket_id },
                      })
                    }
                    onCreate={createBucket}
                  />
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
                  <Select
                    label="Classification"
                    field="classification"
                    choices={classifications}
                    editor={editor}
                    set={setEditor}
                  />
                  <label>
                    Effort estimate
                    <select
                      value={editor.value.effort_minutes || ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            effort_minutes: Number(e.target.value) || null,
                          },
                        })
                      }
                    >
                      <option value="">Not estimated</option>
                      {efforts.map(([n, label]) => (
                        <option value={n} key={n}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    name="Next action"
                    field="next_action"
                    editor={editor}
                    set={setEditor}
                  />
                  <label>
                    Assigned to
                    <input
                      list="assignee-names"
                      value={editor.value.assigned_to}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          value: {
                            ...editor.value,
                            ...assignmentChange(editor.value, e.target.value),
                            assigned_to: e.target.value,
                          },
                        })
                      }
                      placeholder="Type a name — no account needed"
                    />
                  </label>
                  <datalist id="assignee-names">
                    {Array.from(
                      new Set(tasks.map((t) => t.assigned_to).filter(Boolean)),
                    )
                      .sort()
                      .map((name) => (
                        <option key={name} value={name} />
                      ))}
                  </datalist>
                  {editor.value.assigned_to && (
                    <>
                      <Field
                        name="Date assigned"
                        field="date_assigned"
                        editor={editor}
                        set={setEditor}
                        type="date"
                      />
                      <Field
                        name="Assignment notes"
                        field="assignment_notes"
                        editor={editor}
                        set={setEditor}
                        area
                      />
                      <Field
                        name="Follow-up date"
                        field="follow_up_date"
                        editor={editor}
                        set={setEditor}
                        type="date"
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setEditor({
                            ...editor,
                            value: {
                              ...editor.value,
                              ...assignmentChange(editor.value, ""),
                              status: "To Do",
                            },
                          })
                        }
                      >
                        Return to my workload
                      </button>
                    </>
                  )}
                  <SmartDate
                    label="Snooze until"
                    snooze
                    value={editor.value.snoozed_until}
                    onChange={(snoozed_until) =>
                      setEditor({
                        ...editor,
                        value: { ...editor.value, snoozed_until },
                      })
                    }
                  />
                  {editor.value.project_id && (
                    <label className="between">
                      Project milestone
                      <input
                        type="checkbox"
                        checked={editor.value.is_milestone}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            value: {
                              ...editor.value,
                              is_milestone: e.target.checked,
                            },
                          })
                        }
                      />
                    </label>
                  )}
                  <Field
                    name="Person / organisation"
                    field="person"
                    editor={editor}
                    set={setEditor}
                  />
                  <TagPicker
                    value={editor.value.tags}
                    tags={tags}
                    onChange={(tags) =>
                      setEditor({ ...editor, value: { ...editor.value, tags } })
                    }
                  />
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
                    name="Next action"
                    field="next_action"
                    editor={editor}
                    set={setEditor}
                  />
                  <TagPicker
                    value={editor.value.tags}
                    tags={tags}
                    onChange={(tags) =>
                      setEditor({ ...editor, value: { ...editor.value, tags } })
                    }
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
  "Delegated / Waiting On": "Work you have delegated and responses you need.",
  Downtime: "Useful work for when capacity becomes available.",
  Ongoing: "Continuing responsibilities, improvements and next actions.",
  Calendar: "Deadlines, milestones and follow-ups at a glance.",
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
  if (type === "date")
    return (
      <SmartDate
        natural
        label={name}
        value={editor.value[field]}
        someday={editor.value.date_preferences?.[field] === "Someday"}
        onChange={(date, someday) => {
          const date_preferences = { ...editor.value.date_preferences };
          delete date_preferences[field];
          if (someday) date_preferences[field] = "Someday";
          set({
            ...editor,
            value: { ...editor.value, [field]: date, date_preferences },
          });
        }}
      />
    );
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
