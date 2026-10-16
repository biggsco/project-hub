"use client";
import NotificationSettingsPanel from "./notification-settings";
import SuggestedPlan from "./suggested-plan";
import RecurrenceControls from "./recurrence-controls";
import CalmHome, { DailyMomentum } from "./calm-home";
import TaskCard from "./task-card";
import {
  taskWorkspace,
  taskWorkspaceStyle,
  workspaceStyle,
} from "@/lib/workspace-style";
import Achievements from "./achievements";
import FollowUpRadar from "./follow-up-radar";
import WeeklyReset from "./weekly-reset";
import ConversationHistory from "./conversation-history";
import CommandBar from "./command-bar";
import TaskWorkbench from "./task-workbench";
import PeopleWorkspace from "./people-workspace";
import PeoplePicker from "./people-picker";
import TaskTools from "./task-tools";
import ProductivityDashboard from "./productivity-dashboard";
import { taskTypes, type Team, type Person } from "@/lib/people";
import { isWelcomeBack } from "@/lib/productivity";
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
  Users,
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
  ["People & Teams", Users],
  ["Delegated / Waiting On", Clock],
  ["Calendar", CalendarDays],
  ["Completed / Archive", Archive],
  ["Ideas & Notes", ListTodo],
  ["Follow-up Radar", Clock],
  ["Weekly Reset", ListTodo],
  ["Achievements", Archive],
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
  const [series, setSeries] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]),
    [people, setPeople] = useState<Person[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null),
    [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [meeting, setMeeting] = useState(false),
    [typeFilter, setTypeFilter] = useState("");
  const [inboxScope, setInboxScope] = useState("all");
  const [delegationFilter, setDelegationFilter] = useState("");
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [bucketFilter, setBucketFilter] = useState("");
  const [bulkBucket, setBulkBucket] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  useEffect(() => {
    if (completionNotice) {
      const timeout = setTimeout(() => setCompletionNotice(""), 3500);
      return () => clearTimeout(timeout);
    }
  }, [completionNotice]);
  const [bulkNotice, setBulkNotice] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [grouped, setGrouped] = useState(true);
  const pendingTaskIds = useRef(new Set<string>());
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const drawerRef = useRef<HTMLElement>(null);
  const openedTaskLink = useRef<string | null>(null);
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
      if (document.querySelector(".command-dialog[open]")) return;
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
  useEffect(() => {
    if (loading) return;
    const id = new URLSearchParams(location.search).get("task");
    if (id && openedTaskLink.current !== id) {
      const task = tasks.find((t) => t.id === id);
      openedTaskLink.current = id;
      if (task) edit(task);
    }
  }, [loading, tasks]);
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
      setSeries(b.series || []);
      setTeams(b.teams || []);
      setPeople(b.people || []);
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
  useEffect(() => {
    let active = true,
      lastVisit = 0;
    async function visit() {
      if (Date.now() - lastVisit < 3600000) return;
      lastVisit = Date.now();
      try {
        const r = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "visit" }),
        });
        if (r.ok) {
          const b = await r.json();
          if (active && isWelcomeBack(b.previous)) setWelcomeBack(true);
        }
      } catch {}
    }
    visit();
    const focus = () => {
      if (document.visibilityState === "visible") visit();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  async function patchTask(t: Task, patch: Partial<Task>) {
    if (pendingTaskIds.current.has(t.id)) return false;
    pendingTaskIds.current.add(t.id);
    setPendingTasks([...pendingTaskIds.current]);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.keys(patch).length === 1 && "planned_for" in patch
            ? { action: "task_plan", id: t.id, planned_for: patch.planned_for }
            : {
                table: "tasks",
                action: "save",
                id: t.id,
                value: { ...t, ...patch },
              },
        ),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to save task.");
      setTasks((current) =>
        current.map((row) => (row.id === t.id ? b.record : row)),
      );
      setEditor((current) =>
        current?.table === "tasks" && current.id === t.id
          ? { ...current, value: { ...current.value, ...patch } }
          : current,
      );
      if (b.people) setPeople(b.people);
      if (b.teams) setTeams(b.teams);
      setCompletionNotice("Saved.");
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
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      pendingTaskIds.current.delete(t.id);
      setPendingTasks([...pendingTaskIds.current]);
    }
  }
  async function workbench(input: Record<string, unknown>) {
    const r = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Unable to update workbench");
    const records = b.records || [b.record].filter(Boolean);
    setTasks((current) => [
      ...records,
      ...current.filter((t) => !records.some((r: Task) => r.id === t.id)),
    ]);
    setEditor((current) =>
      current?.table === "tasks" && b.record?.id === current.id
        ? {
            ...current,
            value: {
              ...current.value,
              progress_entries: b.record.progress_entries,
              reference_links: b.record.reference_links,
              follow_up_date: b.record.follow_up_date,
            },
          }
        : current,
    );
    return b;
  }
  async function assignSelectedBucket() {
    if (
      busy ||
      !bulkBucket ||
      !selected.length ||
      selected.some((id) => pendingTaskIds.current.has(id))
    )
      return;
    setBusy(true);
    setError("");
    setBulkNotice("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tasks_bucket",
          ids: selected,
          bucket_id: bulkBucket === "none" ? null : bulkBucket,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to assign buckets.");
      const changed = new Set<string>(b.ids);
      setTasks((current) =>
        current.map((t) =>
          changed.has(t.id) ? { ...t, bucket_id: b.bucket_id } : t,
        ),
      );
      setSelected([]);
      setBulkNotice(
        `${changed.size} ${changed.size === 1 ? "task" : "tasks"} ${b.bucket_id ? "assigned to " + (buckets.find((bucket) => bucket.id === b.bucket_id)?.name || "bucket") : "removed from their bucket"}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
      setCompletionNotice(
        t.status === "Completed"
          ? "Task reopened."
          : "Done. A little more room to move.",
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
    setBulkNotice("");
    setBulkBucket("");
    history.replaceState(null, "", "/");
    setSection(s);
    setSelectedProject(null);
    setSelectedTeam(null);
    setSelectedPerson(null);
    setMeeting(false);
    setTypeFilter("");
    setDelegationFilter("");
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
    try {
      const key = `hub-recent-tasks:${email}`;
      const old = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(
        key,
        JSON.stringify(
          [t.id, ...old.filter((id: string) => id !== t.id)].slice(0, 20),
        ),
      );
    } catch {}
    setEditor({ table: "tasks", id: t.id, value: { ...t } });
  }
  const day = today(),
    counts = stats(tasks, projects, day);
  const visible = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (
            !query &&
            section === "Ideas & Notes" &&
            t.content_type === "Task"
          )
            return false;
          if (
            !query &&
            section !== "Ideas & Notes" &&
            section !== "Inbox" &&
            t.content_type !== "Task"
          )
            return false;
          if (!query) {
            if (section === "Completed / Archive") {
              if (!t.archived && t.status !== "Completed") return false;
            } else if (t.archived || t.status === "Completed") return false;
          }
          if (
            section === "Inbox" &&
            (t.status !== "Inbox" ||
              (inboxScope === "unorganised" &&
                !!(
                  t.project_id ||
                  t.bucket_id ||
                  t.team_id ||
                  t.person_id ||
                  t.assigned_to
                )))
          )
            return false;
          if (
            section === "Delegated / Waiting On" &&
            t.status !== "Waiting" &&
            !t.assigned_to &&
            !["Delegated", "Follow Up"].includes(t.task_type)
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
          if (typeFilter && t.task_type !== typeFilter) return false;
          if (section === "Delegated / Waiting On") {
            if (
              delegationFilter === "delegated" &&
              t.task_type !== "Delegated" &&
              !t.assigned_to
            )
              return false;
            if (delegationFilter === "followup" && t.task_type !== "Follow Up")
              return false;
            if (
              delegationFilter === "overdue" &&
              (!t.follow_up_date || t.follow_up_date >= day)
            )
              return false;
          }
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
            t.task_type,
            teams.find((team) => team.id === t.team_id)?.name || "",
            people.find((p) => p.id === t.person_id)?.name || "",
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
      teams,
      people,
      typeFilter,
      delegationFilter,
      inboxScope,
    ],
  );
  useEffect(() => {
    if (section === "Inbox")
      setSelected((current) =>
        current.filter((id) => visible.some((t) => t.id === id)),
      );
  }, [visible, section]);
  function taskRow(t: Task, focus = false) {
    return (
      <div
        className={
          "task-row " + (t.status === "Completed" ? "is-complete" : "")
        }
        key={t.id}
        style={taskWorkspaceStyle(t, { teams, buckets, projects })}
      >
        {t.content_type === "Task" && (
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
        )}
        <button
          className="task-title"
          disabled={pendingTasks.includes(t.id)}
          onClick={() => edit(t)}
        >
          <strong>{t.title}</strong>
          <small className="row-workspace">
            <i />
            {taskWorkspace(t, { teams, buckets, projects }).name}
          </small>
          {t.content_type !== "Task" && <small>{t.content_type}</small>}
        </button>
        {t.content_type === "Task" ? (
          <TaskTools
            task={t}
            people={people}
            onPatch={patchTask}
            onComplete={completeTask}
            disabled={busy || pendingTasks.includes(t.id)}
            focus={focus}
          />
        ) : (
          <button
            className="text-button"
            onClick={() =>
              patchTask(t, { content_type: "Task", status: "Inbox" })
            }
          >
            Convert to task
          </button>
        )}
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
        style={workspaceStyle(p.name)}
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
  const title =
    project?.name ||
    (section === "Dashboard"
      ? "Home"
      : section === "People & Teams"
        ? "People"
        : section);
  return (
    <div className={"app " + (collapsed ? "collapsed" : "")}>
      <aside className={mobile ? "mobile-open" : ""}>
        <a className="brand" href="/" aria-label="Project Hub">
          <span className="brand-mark">P</span>
          <b>Project Hub</b>
        </a>
        <p className="eyebrow sidebar-label">MY WORKSPACE</p>
        <nav aria-label="Primary navigation">
          {[
            ["Home", "Dashboard", LayoutDashboard],
            ["Inbox", "Inbox", Inbox],
            ["People", "People & Teams", Users],
            ["Work", "My Tasks", FolderKanban],
          ].map(([label, target, Icon]: any) => (
            <button
              key={label}
              className={
                (
                  target === "My Tasks"
                    ? ![
                        "Dashboard",
                        "Inbox",
                        "People & Teams",
                        "Settings",
                      ].includes(section)
                    : section === target
                )
                  ? "active"
                  : ""
              }
              onClick={() => go(target)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => go("Settings")}>Settings</button>
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
        <div
          className={
            "completion-feedback " + (completionNotice ? "visible" : "")
          }
          role="status"
        >
          {completionNotice && <Check size={16} />} {completionNotice}
        </div>
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
          <CommandBar
            recentKey={`hub-recent-tasks:${email}`}
            tasks={tasks}
            projects={projects}
            buckets={buckets}
            directory={{ teams, people }}
            onTask={edit}
            onProject={(p) => {
              go("Projects");
              setSelectedProject(p.id);
            }}
            onBucket={(id) => {
              go("Downtime");
              setBucketFilter(id);
            }}
            onContact={(team, person) => {
              go("People & Teams");
              setSelectedTeam(team);
              setSelectedPerson(person);
            }}
            onNavigate={go}
          />
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
          {!["Dashboard", "Inbox", "People & Teams", "Settings"].includes(
            section,
          ) && (
            <label className="work-view-switch">
              Work
              <select
                aria-label="Work view"
                value={section}
                onChange={(e) => go(e.target.value)}
              >
                {[
                  "My Tasks",
                  "Suggested Plan",
                  "Projects",
                  "Downtime",
                  "Ongoing",
                  "Ideas & Notes",
                  "Focus tools",
                  "Delegated / Waiting On",
                  "Follow-up Radar",
                  "Calendar",
                  "Weekly Reset",
                  "Achievements",
                  "Completed / Archive",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}

          {section === "Dashboard" && (
            <div className="page-heading home-welcome">
              <div>
                <p className="eyebrow">
                  {new Intl.DateTimeFormat("en-AU", {
                    timeZone: "Australia/Adelaide",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date())}
                </p>
                <h1>
                  {Number(
                    new Intl.DateTimeFormat("en-AU", {
                      timeZone: "Australia/Adelaide",
                      hour: "numeric",
                      hour12: false,
                    }).format(new Date()),
                  ) < 12
                    ? "Good morning."
                    : Number(
                          new Intl.DateTimeFormat("en-AU", {
                            timeZone: "Australia/Adelaide",
                            hour: "numeric",
                            hour12: false,
                          }).format(new Date()),
                        ) < 18
                      ? "Good afternoon."
                      : "Good evening."}
                </h1>
                <p className="muted">
                  A little space to think. One useful step at a time.
                </p>
              </div>
              <DailyMomentum tasks={tasks} />
            </div>
          )}
          <QuickAdd
            draftKey={`hub-capture:${email}`}
            buckets={buckets}
            tags={tags}
            onCreateBucket={createBucket}
            teams={teams}
            people={people}
            contextTeam={selectedTeam}
            contextPerson={selectedPerson}
            meeting={meeting}
            contextSection={section}
            contextKey={`${section}:${selectedProject || ""}:${bucketFilter}:${selectedTeam || ""}:${selectedPerson || ""}:${meeting}`}
            contextProject={selectedProject}
            projectName={project?.name}
            contextBucket={
              bucketFilter === "none" ? null : bucketFilter || undefined
            }
            onCreated={(records, libraryTags, directory) => {
              if (directory) {
                setTeams(directory.teams);
                setPeople(directory.people);
              }
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
          {section !== "Dashboard" && (
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1>{title}</h1>
                <p className="muted">
                  {project?.description || descriptions[section]}
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
          )}
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
              <NotificationSettingsPanel />
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
                            teams,
                            people,
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
          ) : section === "Suggested Plan" ? (
            <SuggestedPlan
              tasks={tasks}
              library={{ teams, buckets, projects }}
              onPatch={patchTask}
              onOpen={edit}
              onComplete={completeTask}
            />
          ) : section === "Achievements" ? (
            <Achievements
              tasks={tasks}
              projects={projects}
              buckets={buckets}
              directory={{ teams, people }}
              onOpen={edit}
            />
          ) : section === "Follow-up Radar" ? (
            <FollowUpRadar
              tasks={tasks}
              onAction={workbench}
              onPatch={patchTask}
              onComplete={completeTask}
              onOpen={edit}
            />
          ) : section === "Weekly Reset" ? (
            <WeeklyReset
              tasks={tasks}
              projects={projects}
              onPatch={patchTask}
              onComplete={completeTask}
              onOpen={edit}
              onProject={(p) => {
                go("Projects");
                setSelectedProject(p.id);
              }}
            />
          ) : section === "Dashboard" ? (
            <CalmHome
              buckets={buckets}
              onPatch={patchTask}
              onBucket={(id) => {
                go("My Tasks");
                setBucketFilter(id);
              }}
              tasks={tasks}
              projects={projects}
              teams={teams}
              onOpen={edit}
              onComplete={completeTask}
              onTeam={(id) => {
                go("People & Teams");
                setSelectedTeam(id);
                setMeeting(true);
              }}
              onProject={(p) => {
                go("Projects");
                setSelectedProject(p.id);
              }}
            />
          ) : section === "Focus tools" ? (
            <>
              <ProductivityDashboard
                tasks={tasks}
                projects={projects}
                welcomeBack={welcomeBack}
                renderTask={taskRow}
                onOpen={edit}
                onComplete={completeTask}
                onPatch={patchTask}
                onProject={(p) => {
                  go("Projects");
                  history.pushState(null, "", "/projects/" + p.id);
                  setSelectedProject(p.id);
                }}
                onNavigate={(s, filter) => {
                  go(s);
                  if (filter === "quick") setEffortFilter("quick");
                  if (filter === "delegate") setAssignmentFilter("unassigned");
                }}
              />
            </>
          ) : section === "People & Teams" ? (
            <>
              {(selectedTeam || selectedPerson) && (
                <ConversationHistory
                  tasks={tasks}
                  directory={{ teams, people }}
                  teamId={selectedTeam}
                  personId={selectedPerson}
                  onOpen={edit}
                />
              )}
              <PeopleWorkspace
                teams={teams}
                people={people}
                tasks={tasks}
                teamId={selectedTeam}
                personId={selectedPerson}
                onSelect={(team, person) => {
                  setSelectedTeam(team);
                  setSelectedPerson(person);
                }}
                meeting={meeting}
                onMeeting={setMeeting}
                renderTask={(t) => taskRow(t)}
                manage={manage}
              />
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
              <details className="task-filter-options">
                <summary>Filters & view options</summary>
                <div className="filters">
                  {section === "Inbox" && (
                    <select
                      aria-label="Inbox scope"
                      value={inboxScope}
                      onChange={(e) => setInboxScope(e.target.value)}
                    >
                      <option value="all">All captured</option>
                      <option value="unorganised">Unorganised</option>
                    </select>
                  )}
                  <select
                    aria-label="Filter task type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">All task types</option>
                    {taskTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  {section === "Delegated / Waiting On" && (
                    <select
                      aria-label="Waiting view"
                      value={delegationFilter}
                      onChange={(e) => setDelegationFilter(e.target.value)}
                    >
                      <option value="">All waiting / delegated</option>
                      <option value="delegated">Delegated</option>
                      <option value="followup">Follow Up</option>
                      <option value="overdue">Overdue follow-ups</option>
                    </select>
                  )}
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
              </details>
              {section === "Inbox" && bulkNotice && (
                <p role="status" className="muted">
                  {bulkNotice}
                </p>
              )}
              {selected.length > 0 && (
                <div className="bulk">
                  {selected.length} selected
                  {section === "Inbox" && (
                    <>
                      <label className="bulk-bucket-label">
                        Bucket
                        <select
                          aria-label="Bucket for selected tasks"
                          value={bulkBucket}
                          disabled={busy}
                          onChange={(e) => setBulkBucket(e.target.value)}
                        >
                          <option value="">Choose a bucket…</option>
                          <option value="none">No bucket</option>
                          {buckets
                            .filter((b) => !b.archived)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={
                          busy ||
                          !bulkBucket ||
                          selected.some((id) => pendingTasks.includes(id))
                        }
                        onClick={assignSelectedBucket}
                      >
                        Apply bucket
                      </button>
                      <button disabled={busy} onClick={() => setSelected([])}>
                        Clear selection
                      </button>
                    </>
                  )}
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
                          <TaskCard
                            key={t.id}
                            task={t}
                            tasks={tasks}
                            library={{ teams, buckets, projects }}
                            onOpen={edit}
                            onComplete={completeTask}
                            busy={pendingTasks.includes(t.id)}
                          />
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel task-list">
                  <div className="section-heading">
                    <h2>{visible.length} tasks</h2>
                    {section === "Inbox" && visible.length > 0 && (
                      <label className="bulk-select-all">
                        <input
                          type="checkbox"
                          aria-label="Select all visible Inbox tasks"
                          disabled={busy}
                          checked={visible.every((t) =>
                            selected.includes(t.id),
                          )}
                          ref={(node) => {
                            if (node)
                              node.indeterminate =
                                visible.some((t) => selected.includes(t.id)) &&
                                !visible.every((t) => selected.includes(t.id));
                          }}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? visible.map((t) => t.id) : [],
                            )
                          }
                        />
                        Select all
                      </label>
                    )}
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
                            style={workspaceStyle(
                              bucket.name,
                              buckets.find((b) => b.id === bucket.id)?.aliases,
                            )}
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
                            {rows.map((t) => taskRow(t))}
                          </section>
                        );
                      })
                    : visible.map((t) => (
                        <div className="select-row" key={t.id}>
                          <input
                            type="checkbox"
                            aria-label={"Select " + t.title}
                            disabled={busy}
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
                {editor.id && editor.table === "tasks"
                  ? editor.value.title
                  : `${editor.id ? "Edit" : "New"} ${editor.table === "tasks" ? "task" : "project"}`}
              </h2>
              <button
                aria-label="Close details"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                <X />
              </button>
            </div>
            {editor.table === "tasks" &&
              editor.id &&
              tasks.find((t) => t.id === editor.id) && (
                <TaskWorkbench
                  key={editor.id}
                  task={tasks.find((t) => t.id === editor.id)!}
                  tasks={tasks}
                  projects={projects}
                  buckets={buckets}
                  directory={{ teams, people }}
                  onPatch={patchTask}
                  onAction={workbench}
                  onOpen={edit}
                  onComplete={completeTask}
                />
              )}
            <details
              open={!editor.id || editor.table !== "tasks"}
              className="advanced-details"
            >
              <summary>
                {editor.table === "tasks" ? "More Details" : "Project fields"}
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await mutate(editor.table, editor.value, editor.id))
                    setEditor(null);
                }}
              >
                {editor.table === "tasks" ? (
                  <>
                    <RecurrenceControls
                      task={editor.value}
                      series={series.find(
                        (s) => s.id === editor.value.recurrence_series_id,
                      )}
                      onChange={(recurrence_rule) =>
                        setEditor({
                          ...editor,
                          value: { ...editor.value, recurrence_rule },
                        })
                      }
                      onAction={(operation) =>
                        manage({
                          action: "recurrence",
                          series_id: editor.value.recurrence_series_id,
                          operation,
                        })
                      }
                    />
                    <label className="context-choice">
                      <input
                        type="checkbox"
                        checked={editor.value.awaiting_decision}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            value: {
                              ...editor.value,
                              awaiting_decision: e.target.checked,
                            },
                          })
                        }
                      />
                      Awaiting a decision
                    </label>
                    <label>
                      Depends on
                      <select
                        value={editor.value.depends_on_id || ""}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            value: {
                              ...editor.value,
                              depends_on_id: e.target.value || null,
                            },
                          })
                        }
                      >
                        <option value="">No dependency</option>
                        {tasks
                          .filter(
                            (t) =>
                              t.id !== editor.id &&
                              t.content_type === "Task" &&
                              !t.archived,
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <SmartDate
                      label="Flexible work date"
                      value={editor.value.planned_for}
                      onChange={(planned_for) =>
                        setEditor({
                          ...editor,
                          value: { ...editor.value, planned_for },
                        })
                      }
                    />
                    <label className="context-choice">
                      <input
                        type="checkbox"
                        checked={editor.value.reminder_enabled}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            value: {
                              ...editor.value,
                              reminder_enabled: e.target.checked,
                            },
                          })
                        }
                      />
                      Optional Teams reminder
                    </label>
                    {editor.value.reminder_enabled && (
                      <SmartDate
                        label="Reminder date"
                        value={editor.value.reminder_on}
                        onChange={(reminder_on) =>
                          setEditor({
                            ...editor,
                            value: { ...editor.value, reminder_on },
                          })
                        }
                      />
                    )}
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
                      label="Task type"
                      field="task_type"
                      choices={taskTypes}
                      editor={editor}
                      set={setEditor}
                    />
                    <PeoplePicker
                      teams={teams}
                      people={people}
                      teamId={editor.value.team_id}
                      personId={editor.value.person_id}
                      onChange={(value) =>
                        setEditor({
                          ...editor,
                          value: { ...editor.value, ...value },
                        })
                      }
                    />
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
                        new Set(
                          tasks.map((t) => t.assigned_to).filter(Boolean),
                        ),
                      )
                        .sort()
                        .map((name) => (
                          <option key={name} value={name} />
                        ))}
                    </datalist>
                    {(editor.value.assigned_to ||
                      editor.value.task_type === "Delegated" ||
                      editor.value.task_type === "Follow Up") && (
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
                                task_type: "To Do",
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
                        setEditor({
                          ...editor,
                          value: { ...editor.value, tags },
                        })
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
                        setEditor({
                          ...editor,
                          value: { ...editor.value, tags },
                        })
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
                  <button
                    className="primary"
                    disabled={
                      busy || (!!editor.id && pendingTasks.includes(editor.id))
                    }
                  >
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
            </details>
            {editor.id && (
              <details>
                <summary>Task history</summary>
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
              </details>
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
  "People & Teams":
    "Things to discuss, follow up and delegate — all in one place.",
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
