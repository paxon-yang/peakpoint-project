import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import peakpointLogo from "./assets/peakpoint-logo.jpg";
import { AuthDialog } from "./components/AuthDialog";
import { GanttBoard } from "./components/GanttBoard";
import { ProjectDialog } from "./components/ProjectDialog";
import { TaskFormDrawer } from "./components/TaskFormDrawer";
import { defaultState } from "./data/defaultData";
import { PROJECT_TEMPLATES } from "./data/templates";
import { createTranslator } from "./i18n";
import {
  AuthUser,
  getCurrentUser,
  isRemoteStoreEnabled,
  loadRemoteState,
  onAuthUserChange,
  saveRemoteState,
  signInWithPassword,
  signOutRemote,
  signUpWithPassword
} from "./lib/remoteStore";
import {
  Language,
  PersistedState,
  ProjectPermissionItem,
  ProjectRole,
  SaveTrigger,
  SortBy,
  TaskAuditLogItem,
  TaskFilters,
  TaskItem,
  ViewModeOption,
  WorkspaceRevisionItem,
  WorkspaceSnapshotData
} from "./types";
import { calcDuration, normalizeDates, toDate, toISODate } from "./utils/date";
import { buildProjectNotificationSummary, buildSummaryEmailContent, buildTestEmailContent } from "./utils/notificationUtils";
import { computeCriticalPath, isDelayedOrOverdue } from "./utils/projectAnalysis";
import { hasDependencyCycle, isEndBeforeStart, normalizeDependencyIds } from "./utils/taskValidation";
import { getDescendantIds, getVisibleTasks, reorderTasks, sanitizeTask } from "./utils/taskUtils";

const STORAGE_KEY = "ccsa-project-management-state-v2";
const LEGACY_STORAGE_KEYS = ["ccsa-project-management-state-v1"];
const LANGUAGE_KEY = "ccsa-project-management-language";
const LEGACY_PROJECT_NAME = "CCSA主项目 / CCSA Main Project";
const TARGET_PROJECT_NAME = "TMM project";
const DEFAULT_TIMELINE_START = "2026-04-01";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTO_SAVE_DELAY_MS = 1800;
const MAX_REVISIONS = 30;
const REPORT_CAPTURE_SELECTOR = ".right-panel.panel-card";

const normalizeStatus = (value: unknown): TaskItem["status"] => {
  if (value === "not_started" || value === "\u672a\u5f00\u59cb") return "not_started";
  if (value === "in_progress" || value === "\u8fdb\u884c\u4e2d") return "in_progress";
  if (value === "completed" || value === "\u5df2\u5b8c\u6210") return "completed";
  if (value === "delayed" || value === "\u5ef6\u671f") return "delayed";
  return "not_started";
};

const normalizePriority = (value: unknown): TaskItem["priority"] => {
  if (value === "high" || value === "\u9ad8") return "high";
  if (value === "medium" || value === "\u4e2d") return "medium";
  if (value === "low" || value === "\u4f4e") return "low";
  return "medium";
};

const normalizeImportedStatus = (value: unknown): TaskItem["status"] => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "not_started";
  if (raw.includes("进行") || raw.includes("progress") || raw === "in_progress") return "in_progress";
  if (raw.includes("完成") || raw.includes("complete") || raw === "completed") return "completed";
  if (raw.includes("延期") || raw.includes("delay") || raw === "delayed") return "delayed";
  if (raw.includes("未开始") || raw.includes("not") || raw === "not_started") return "not_started";
  return "not_started";
};

const normalizeImportedPriority = (value: unknown): TaskItem["priority"] => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "medium";
  if (raw.includes("高") || raw.includes("high")) return "high";
  if (raw.includes("低") || raw.includes("low")) return "low";
  return "medium";
};

const normalizeCategory = (task: Partial<TaskItem>): string => {
  if (typeof task.category === "string" && task.category.trim()) return task.category;
  if (typeof task.name === "string" && task.name.trim()) return task.name.split("/")[0].trim();
  return "General";
};

const normalizeTimelineStartDate = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_TIMELINE_START;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return DEFAULT_TIMELINE_START;
  const timestamp = new Date(`${trimmed}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? DEFAULT_TIMELINE_START : trimmed;
};

const normalizeRole = (value: unknown): ProjectRole => {
  if (value === "admin" || value === "editor" || value === "viewer") return value;
  if (value === "read_only" || value === "readonly") return "viewer";
  return "viewer";
};

const normalizeEmail = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

const normalizePermissions = (value: unknown): ProjectPermissionItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Partial<ProjectPermissionItem>;
      const projectId = typeof record.projectId === "string" ? record.projectId : "";
      const email = normalizeEmail(record.email);
      if (!projectId || !email) return undefined;
      const normalized: ProjectPermissionItem = {
        projectId,
        email,
        role: normalizeRole(record.role),
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
      };
      if (typeof record.updatedBy === "string") {
        normalized.updatedBy = record.updatedBy;
      }
      return normalized;
    })
    .filter((item): item is ProjectPermissionItem => Boolean(item));
};

const normalizeAuditLogs = (value: unknown): TaskAuditLogItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Partial<TaskAuditLogItem>;
      if (
        typeof record.id !== "string" ||
        typeof record.projectId !== "string" ||
        typeof record.taskId !== "string" ||
        typeof record.taskName !== "string" ||
        typeof record.field !== "string" ||
        typeof record.before !== "string" ||
        typeof record.after !== "string" ||
        typeof record.changedBy !== "string" ||
        typeof record.changedAt !== "string"
      ) {
        return undefined;
      }
      if (!["name", "startDate", "endDate", "status"].includes(record.field)) return undefined;
      return record as TaskAuditLogItem;
    })
    .filter((item): item is TaskAuditLogItem => Boolean(item));
};

const valueByAlias = (row: Record<string, unknown>, aliases: string[]): unknown => {
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const normalizedKey = rawKey.trim().toLowerCase();
    if (aliases.some((alias) => normalizedKey === alias.trim().toLowerCase())) {
      return rawValue;
    }
  }
  return undefined;
};

const normalizeSnapshotData = (value: unknown): WorkspaceSnapshotData | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<WorkspaceSnapshotData>;
  if (!Array.isArray(record.projects) || !Array.isArray(record.tasks) || typeof record.activeProjectId !== "string") {
    return undefined;
  }
  return {
    projects: record.projects,
    tasks: record.tasks.map((task) => ({
      ...task,
      status: normalizeStatus((task as Partial<TaskItem>).status),
      priority: normalizePriority((task as Partial<TaskItem>).priority),
      category: normalizeCategory(task as Partial<TaskItem>),
      dependencyIds: Array.isArray((task as Partial<TaskItem>).dependencyIds) ? (task as Partial<TaskItem>).dependencyIds : [],
      isCategoryPlaceholder: Boolean((task as Partial<TaskItem>).isCategoryPlaceholder)
    })) as TaskItem[],
    activeProjectId: record.activeProjectId,
    projectPermissions: normalizePermissions(record.projectPermissions),
    auditLogs: normalizeAuditLogs(record.auditLogs)
  };
};

const normalizeRevisions = (value: unknown): WorkspaceRevisionItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Partial<WorkspaceRevisionItem>;
      if (
        typeof record.id !== "string" ||
        typeof record.createdAt !== "string" ||
        typeof record.createdBy !== "string" ||
        typeof record.trigger !== "string" ||
        typeof record.checksum !== "string"
      ) {
        return undefined;
      }
      if (!["manual", "auto", "restore"].includes(record.trigger)) return undefined;
      const data = normalizeSnapshotData(record.data);
      if (!data) return undefined;
      const projectId = typeof record.projectId === "string" && record.projectId ? record.projectId : data.activeProjectId;
      if (!projectId) return undefined;
      return {
        id: record.id,
        projectId,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        trigger: record.trigger as SaveTrigger,
        checksum: record.checksum,
        data
      } satisfies WorkspaceRevisionItem;
    })
    .filter((item): item is WorkspaceRevisionItem => Boolean(item));
};

const normalizePersistedState = (parsed: PersistedState): PersistedState => ({
  ...parsed,
  projects: parsed.projects.map((project) => {
    const name = project.name === LEGACY_PROJECT_NAME ? TARGET_PROJECT_NAME : project.name;
    return {
      ...project,
      name,
      timelineStartDate: normalizeTimelineStartDate(project.timelineStartDate)
    };
  }),
  tasks: (parsed.tasks ?? []).map((task) => ({
    ...task,
    status: normalizeStatus(task.status),
    priority: normalizePriority(task.priority),
    category: normalizeCategory(task),
    dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : [],
    isCategoryPlaceholder: Boolean(task.isCategoryPlaceholder)
  })),
  projectPermissions: normalizePermissions(parsed.projectPermissions),
  auditLogs: normalizeAuditLogs(parsed.auditLogs),
  revisions: normalizeRevisions(parsed.revisions)
});

const loadState = (): PersistedState => {
  const candidateKeys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of candidateKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PersistedState;
      if (!parsed.projects?.length) continue;
      const normalized = normalizePersistedState(parsed);
      if (key !== STORAGE_KEY) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      // ignore invalid legacy payload and keep trying
    }
  }
  return defaultState;
};

const saveState = (state: PersistedState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadLanguage = (): Language => {
  const raw = localStorage.getItem(LANGUAGE_KEY);
  return raw === "en" ? "en" : "zh";
};

export const App = () => {
  const initial = loadState();
  const [projects, setProjects] = useState(initial.projects);
  const [tasks, setTasks] = useState<TaskItem[]>(initial.tasks.map(sanitizeTask));
  const [projectPermissions, setProjectPermissions] = useState<ProjectPermissionItem[]>(normalizePermissions(initial.projectPermissions));
  const [auditLogs, setAuditLogs] = useState<TaskAuditLogItem[]>(normalizeAuditLogs(initial.auditLogs));
  const [revisions, setRevisions] = useState<WorkspaceRevisionItem[]>(normalizeRevisions(initial.revisions));
  const [activeProjectId, setActiveProjectId] = useState(initial.activeProjectId || initial.projects[0]?.id || "");
  const [language, setLanguage] = useState<Language>(loadLanguage());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string>();
  const [authSuccess, setAuthSuccess] = useState<string>();
  const [isAuthLoading, setAuthLoading] = useState(false);

  const [isTaskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [isProjectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());
  const [isSettingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const [permissionEmail, setPermissionEmail] = useState("");
  const [permissionRole, setPermissionRole] = useState<ProjectRole>("viewer");
  const [isRiskPanelOpen, setRiskPanelOpen] = useState(false);
  const riskPanelRef = useRef<HTMLDivElement>(null);
  const [isDashboardPanelOpen, setDashboardPanelOpen] = useState(false);
  const dashboardPanelRef = useRef<HTMLDivElement>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [isSendingNotify, setSendingNotify] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string>();
  const [isExportPanelOpen, setExportPanelOpen] = useState(false);
  const exportPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setImporting] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastSavedChecksumRef = useRef<string>("");
  const isPersistingRef = useRef(false);

  const viewMode: ViewModeOption = "day";
  const sortBy: SortBy = "default";
  const searchText = "";
  const zoom = 15;
  const filters: TaskFilters = {
    owner: "all",
    status: "all",
    priority: "all"
  };

  const t = createTranslator(language);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId]
  );
  const activeTimelineStartDate = activeProject?.timelineStartDate ?? DEFAULT_TIMELINE_START;
  const normalizedUserEmail = normalizeEmail(currentUser?.email);
  const activeProjectPermissions = useMemo(
    () => projectPermissions.filter((item) => item.projectId === activeProjectId),
    [projectPermissions, activeProjectId]
  );
  const currentProjectRole = useMemo<ProjectRole>(() => {
    if (!isRemoteStoreEnabled) return "admin";
    if (!normalizedUserEmail) return "viewer";
    const matched = activeProjectPermissions.find((item) => item.email === normalizedUserEmail);
    if (matched) return matched.role;
    return activeProjectPermissions.length === 0 ? "admin" : "viewer";
  }, [activeProjectPermissions, normalizedUserEmail]);
  const canManagePermissions = currentProjectRole === "admin";
  const canEdit = !isRemoteStoreEnabled || currentProjectRole === "admin" || currentProjectRole === "editor";
  const activeProjectAuditLogs = useMemo(
    () =>
      auditLogs
        .filter((item) => item.projectId === activeProjectId)
        .slice()
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, 120),
    [auditLogs, activeProjectId]
  );
  const activeProjectRevisions = useMemo(
    () =>
      revisions
        .filter((item) => item.projectId === activeProjectId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30),
    [revisions, activeProjectId]
  );
  const baselineDiffRows = useMemo(() => {
    const inProject = tasks.filter((task) => task.projectId === activeProjectId && !task.isCategoryPlaceholder);
    return inProject
      .map((task) => {
        const baselineStart = task.baselineStartDate ?? task.startDate;
        const baselineEnd = task.baselineEndDate ?? task.endDate;
        const startDiff = Math.round((toDate(task.startDate).getTime() - toDate(baselineStart).getTime()) / (24 * 60 * 60 * 1000));
        const endDiff = Math.round((toDate(task.endDate).getTime() - toDate(baselineEnd).getTime()) / (24 * 60 * 60 * 1000));
        return {
          taskId: task.id,
          taskName: task.name,
          baselineStart,
          baselineEnd,
          actualStart: task.startDate,
          actualEnd: task.endDate,
          startDiff,
          endDiff
        };
      })
      .filter((row) => row.startDiff !== 0 || row.endDiff !== 0)
      .sort((a, b) => b.endDiff - a.endDiff)
      .slice(0, 80);
  }, [tasks, activeProjectId]);
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === activeProjectId && !task.isCategoryPlaceholder),
    [tasks, activeProjectId]
  );
  const criticalPathResult = useMemo(() => computeCriticalPath(tasks, activeProjectId), [tasks, activeProjectId]);
  const criticalPathTaskIds = useMemo(() => new Set(criticalPathResult.taskIds), [criticalPathResult.taskIds]);
  const criticalPathRows = useMemo(() => {
    const byId = new Map(projectTasks.map((task) => [task.id, task]));
    return criticalPathResult.taskIds
      .map((id) => byId.get(id))
      .filter((task): task is TaskItem => Boolean(task))
      .map((task) => ({
        id: task.id,
        name: task.name,
        owner: task.owner,
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status
      }));
  }, [projectTasks, criticalPathResult.taskIds]);
  const criticalRiskRows = useMemo(() => {
    const inProject = projectTasks;
    const dependentSet = new Set<string>();
    inProject.forEach((task) => {
      task.dependencyIds.forEach((depId) => dependentSet.add(depId));
    });
    const today = new Date().toISOString().slice(0, 10);
    return inProject
      .filter((task) => {
        const isDelayed = isDelayedOrOverdue(task, today);
        const isCritical =
          task.isMilestone || task.priority === "high" || dependentSet.has(task.id) || criticalPathTaskIds.has(task.id);
        return isDelayed && isCritical;
      })
      .map((task) => ({
        id: task.id,
        name: task.name,
        owner: task.owner,
        endDate: task.endDate,
        status: task.status,
        isCriticalPath: criticalPathTaskIds.has(task.id)
      }))
      .sort((a, b) => {
        if (a.isCriticalPath !== b.isCriticalPath) return a.isCriticalPath ? -1 : 1;
        return a.endDate.localeCompare(b.endDate);
      })
      .slice(0, 60);
  }, [projectTasks, criticalPathTaskIds]);
  const criticalRiskTaskIds = useMemo(() => new Set(criticalRiskRows.map((item) => item.id)), [criticalRiskRows]);
  const projectHealthMetrics = useMemo(() => {
    const total = projectTasks.length;
    const today = toISODate(new Date());
    const isDelayedTask = (task: TaskItem) => isDelayedOrOverdue(task, today);

    const delayedCount = projectTasks.filter(isDelayedTask).length;
    const completedCount = projectTasks.filter((task) => task.status === "completed").length;
    const onTimeCount = Math.max(0, total - delayedCount);

    const ownerMap = new Map<
      string,
      {
        owner: string;
        total: number;
        completed: number;
        delayed: number;
        inProgress: number;
        notStarted: number;
      }
    >();

    projectTasks.forEach((task) => {
      const owner = task.owner?.trim() || (language === "zh" ? "未分配" : "Unassigned");
      const previous = ownerMap.get(owner) ?? {
        owner,
        total: 0,
        completed: 0,
        delayed: 0,
        inProgress: 0,
        notStarted: 0
      };
      previous.total += 1;
      if (task.status === "completed") previous.completed += 1;
      if (task.status === "in_progress") previous.inProgress += 1;
      if (task.status === "not_started") previous.notStarted += 1;
      if (isDelayedTask(task)) previous.delayed += 1;
      ownerMap.set(owner, previous);
    });

    const ownerLoad = [...ownerMap.values()]
      .sort((a, b) => {
        if (b.delayed !== a.delayed) return b.delayed - a.delayed;
        if (b.total !== a.total) return b.total - a.total;
        return a.owner.localeCompare(b.owner);
      })
      .slice(0, 20);

    return {
      total,
      completedCount,
      delayedCount,
      onTimeCount,
      onTimeRate: total ? onTimeCount / total : 0,
      delayedRate: total ? delayedCount / total : 0,
      completedRate: total ? completedCount / total : 0,
      criticalPathCount: criticalPathResult.taskIds.length,
      criticalPathDurationDays: criticalPathResult.totalDurationDays,
      criticalPathDelayedCount: criticalPathResult.taskIds.reduce((sum, taskId) => {
        const task = projectTasks.find((item) => item.id === taskId);
        return task && isDelayedTask(task) ? sum + 1 : sum;
      }, 0),
      criticalPathCycleDetected: criticalPathResult.cycleDetected,
      ownerLoad
    };
  }, [projectTasks, language, criticalPathResult]);
  const projectNotificationSummary = useMemo(
    () => buildProjectNotificationSummary(tasks, activeProjectId, 7),
    [tasks, activeProjectId]
  );
  const buildSnapshotData = (
    nextProjects: PersistedState["projects"],
    nextTasks: PersistedState["tasks"],
    nextActiveProjectId: string,
    nextPermissions: ProjectPermissionItem[],
    nextAuditLogs: TaskAuditLogItem[]
  ): WorkspaceSnapshotData => ({
    projects: nextProjects,
    tasks: nextTasks,
    activeProjectId: nextActiveProjectId,
    projectPermissions: nextPermissions,
    auditLogs: nextAuditLogs
  });
  const checksumForSnapshotData = (data: WorkspaceSnapshotData): string => JSON.stringify(data);
  const currentSnapshotData = useMemo(
    () => buildSnapshotData(projects, tasks, activeProjectId, projectPermissions, auditLogs),
    [projects, tasks, activeProjectId, projectPermissions, auditLogs]
  );

  const visibleTasks = useMemo(
    () => getVisibleTasks(tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy),
    [tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy]
  );

  useEffect(() => {
    if (!isRemoteStoreEnabled) return;
    let cancelled = false;

    const syncUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!cancelled) setCurrentUser(user);
      } catch (error) {
        console.error("Auth bootstrap failed:", error);
      }
    };

    void syncUser();
    const unsubscribe = onAuthUserChange((user) => {
      if (cancelled) return;
      setCurrentUser(user);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isRemoteStoreEnabled) return;
    let cancelled = false;

    const hydrateFromRemote = async () => {
      try {
        const remote = await loadRemoteState();
        if (cancelled || !remote) return;
        const normalized = normalizePersistedState(remote);
        setProjects(normalized.projects);
        setTasks(normalized.tasks.map(sanitizeTask));
        setProjectPermissions(normalizePermissions(normalized.projectPermissions));
        setAuditLogs(normalizeAuditLogs(normalized.auditLogs));
        setRevisions(normalizeRevisions(normalized.revisions));
        setActiveProjectId(normalized.activeProjectId || normalized.projects[0]?.id || "");
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Remote load failed:", error);
      }
    };

    void hydrateFromRemote();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!isSettingsPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (settingsPanelRef.current?.contains(target)) return;
      setSettingsPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isSettingsPanelOpen]);

  useEffect(() => {
    if (!isRiskPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (riskPanelRef.current?.contains(target)) return;
      setRiskPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isRiskPanelOpen]);

  useEffect(() => {
    if (!isDashboardPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (dashboardPanelRef.current?.contains(target)) return;
      setDashboardPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isDashboardPanelOpen]);

  useEffect(() => {
    if (!isExportPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (exportPanelRef.current?.contains(target)) return;
      setExportPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isExportPanelOpen]);

  useEffect(() => {
    setSettingsPanelOpen(false);
    setRiskPanelOpen(false);
    setDashboardPanelOpen(false);
    setExportPanelOpen(false);
    setNotifyResult(undefined);
  }, [activeProjectId, normalizedUserEmail]);

  useEffect(() => {
    if (!currentUser?.email || notifyEmail) return;
    setNotifyEmail(currentUser.email);
  }, [currentUser?.email, notifyEmail]);

  useEffect(() => {
    if (!isRemoteStoreEnabled) return;
    if (!activeProjectId || !normalizedUserEmail) return;
    const hasProjectPermission = projectPermissions.some((item) => item.projectId === activeProjectId);
    if (hasProjectPermission) return;

    setProjectPermissions((prev) => [
      ...prev,
      {
        projectId: activeProjectId,
        email: normalizedUserEmail,
        role: "admin",
        updatedAt: new Date().toISOString(),
        updatedBy: normalizedUserEmail
      }
    ]);
    setHasUnsavedChanges(true);
  }, [activeProjectId, normalizedUserEmail, projectPermissions]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      lastSavedChecksumRef.current = checksumForSnapshotData(currentSnapshotData);
    }
  }, [hasUnsavedChanges, currentSnapshotData]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!hasUnsavedChanges || !canEdit) return;
    autoSaveTimerRef.current = window.setTimeout(() => {
      void persistWorkspace("auto", { silent: true });
      autoSaveTimerRef.current = null;
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [hasUnsavedChanges, canEdit, currentSnapshotData]);

  const syncState = (
    nextProjects: PersistedState["projects"],
    nextTasks: PersistedState["tasks"],
    nextActiveProjectId: string,
    nextPermissions: ProjectPermissionItem[] = projectPermissions,
    nextAuditLogs: TaskAuditLogItem[] = auditLogs,
    nextRevisions: WorkspaceRevisionItem[] = revisions
  ) => {
    setProjects(nextProjects);
    setTasks(nextTasks);
    setProjectPermissions(nextPermissions);
    setAuditLogs(nextAuditLogs);
    setRevisions(nextRevisions);
    setActiveProjectId(nextActiveProjectId);
    setHasUnsavedChanges(true);
  };

  const openAuthDialog = (mode: "login" | "register" = "login") => {
    setAuthMode(mode);
    setAuthError(undefined);
    setAuthSuccess(undefined);
    setAuthDialogOpen(true);
  };

  const requireEditPermission = (): boolean => {
    if (canEdit) return true;
    if (!currentUser) {
      openAuthDialog("login");
    } else {
      window.alert(language === "zh" ? "当前账号为只读权限，无法修改。" : "This account is read-only for the project.");
    }
    return false;
  };

  const getRoleLabel = (role: ProjectRole): string => {
    if (role === "admin") return t("roleAdmin");
    if (role === "editor") return t("roleEditor");
    return t("roleViewer");
  };

  const getAuditFieldLabel = (field: TaskAuditLogItem["field"]): string => {
    if (field === "name") return t("taskName");
    if (field === "startDate") return t("start");
    if (field === "endDate") return t("end");
    return t("status");
  };

  const formatPercent = (value: number): string => `${(Math.max(0, value) * 100).toFixed(1)}%`;

  const notifyDateRangeInvalid = () => {
    window.alert(t("dateRangeInvalid"));
  };

  const notifyDependencyCycleInvalid = () => {
    window.alert(t("dependencyCycleInvalid"));
  };

  const handleUpsertPermission = () => {
    if (!canManagePermissions) return;
    if (!activeProjectId) return;
    const email = normalizeEmail(permissionEmail);
    if (!EMAIL_PATTERN.test(email)) {
      window.alert(language === "zh" ? "请输入有效邮箱" : "Please enter a valid email.");
      return;
    }
    const now = new Date().toISOString();
    const nextPermissions = [
      ...projectPermissions.filter((item) => !(item.projectId === activeProjectId && item.email === email)),
      {
        projectId: activeProjectId,
        email,
        role: permissionRole,
        updatedAt: now,
        updatedBy: normalizedUserEmail || email
      }
    ];
    syncState(projects, tasks, activeProjectId, nextPermissions);
    setPermissionEmail("");
  };

  const handleRoleChange = (email: string, role: ProjectRole) => {
    if (!canManagePermissions) return;
    const now = new Date().toISOString();
    const nextPermissions = projectPermissions.map((item) =>
      item.projectId === activeProjectId && item.email === email
        ? { ...item, role, updatedAt: now, updatedBy: normalizedUserEmail || item.updatedBy }
        : item
    );
    syncState(projects, tasks, activeProjectId, nextPermissions);
  };

  const handleRemovePermission = (email: string) => {
    if (!canManagePermissions) return;
    const projectMembers = projectPermissions.filter((item) => item.projectId === activeProjectId);
    const target = projectMembers.find((item) => item.email === email);
    if (!target) return;
    const adminCount = projectMembers.filter((item) => item.role === "admin").length;
    if (target.role === "admin" && adminCount <= 1) {
      window.alert(language === "zh" ? "至少保留一名管理员" : "At least one admin must remain.");
      return;
    }
    const nextPermissions = projectPermissions.filter((item) => !(item.projectId === activeProjectId && item.email === email));
    syncState(projects, tasks, activeProjectId, nextPermissions);
  };

  const appendTaskAuditEntries = (
    baseLogs: TaskAuditLogItem[],
    before: TaskItem,
    after: TaskItem,
    changedBy: string
  ): TaskAuditLogItem[] => {
    const now = new Date().toISOString();
    const changes: Array<{ field: "name" | "startDate" | "endDate" | "status"; before: string; after: string }> = [];

    if (before.name !== after.name) changes.push({ field: "name", before: before.name, after: after.name });
    if (before.startDate !== after.startDate) changes.push({ field: "startDate", before: before.startDate, after: after.startDate });
    if (before.endDate !== after.endDate) changes.push({ field: "endDate", before: before.endDate, after: after.endDate });
    if (before.status !== after.status) changes.push({ field: "status", before: before.status, after: after.status });

    if (changes.length === 0) return baseLogs;
    const created = changes.map((change) => ({
      id: `audit-${uuidv4()}`,
      projectId: after.projectId,
      taskId: after.id,
      taskName: after.name,
      field: change.field,
      before: change.before,
      after: change.after,
      changedBy,
      changedAt: now
    }));
    return [...baseLogs, ...created].slice(-5000);
  };

  const buildNextRevisions = (
    baseRevisions: WorkspaceRevisionItem[],
    trigger: SaveTrigger,
    actor: string,
    data: WorkspaceSnapshotData
  ): { revisions: WorkspaceRevisionItem[]; checksum: string } => {
    const checksum = checksumForSnapshotData(data);
    const latest = baseRevisions[baseRevisions.length - 1];
    if (latest && latest.checksum === checksum) {
      return { revisions: baseRevisions, checksum };
    }
    const nextRevision: WorkspaceRevisionItem = {
      id: `revision-${uuidv4()}`,
      projectId: data.activeProjectId,
      createdAt: new Date().toISOString(),
      createdBy: actor,
      trigger,
      checksum,
      data
    };
    return { revisions: [...baseRevisions, nextRevision].slice(-MAX_REVISIONS), checksum };
  };

  const persistWorkspace = async (
    trigger: SaveTrigger,
    options?: {
      silent?: boolean;
      data?: WorkspaceSnapshotData;
      baseRevisions?: WorkspaceRevisionItem[];
    }
  ): Promise<boolean> => {
    if (!canEdit) return false;
    if (isPersistingRef.current) return false;
    isPersistingRef.current = true;
    const silent = Boolean(options?.silent);
    const data = options?.data ?? currentSnapshotData;
    const actor = normalizedUserEmail || currentUser?.id || "system";
    const revisionSeed = options?.baseRevisions ?? revisions;
    const { revisions: nextRevisions, checksum } = buildNextRevisions(revisionSeed, trigger, actor, data);
    const snapshot: PersistedState = {
      ...data,
      revisions: nextRevisions
    };

    if (!silent) {
      setIsSaving(true);
    }
    let remoteSaved = true;
    try {
      if (isRemoteStoreEnabled) {
        await saveRemoteState(snapshot);
      }
    } catch (error) {
      remoteSaved = false;
      console.error("Remote save failed:", error);
      if (!silent) {
        window.alert(language === "zh" ? "云端保存失败，请稍后重试。" : "Cloud save failed. Please try again.");
      }
    } finally {
      isPersistingRef.current = false;
      if (!silent) {
        setIsSaving(false);
      }
    }

    saveState(snapshot);
    localStorage.setItem(LANGUAGE_KEY, language);
    setRevisions(nextRevisions);

    const success = !isRemoteStoreEnabled || remoteSaved;
    setHasUnsavedChanges(!success);
    if (success) {
      lastSavedChecksumRef.current = checksum;
    }
    return success;
  };

  const handleRestoreRevision = async (revisionId: string) => {
    if (!requireEditPermission()) return;
    const revision = revisions.find((item) => item.id === revisionId);
    if (!revision) return;
    const restored = revision.data;
    setProjects(restored.projects);
    setTasks(restored.tasks.map(sanitizeTask));
    setProjectPermissions(restored.projectPermissions);
    setAuditLogs(restored.auditLogs);
    setActiveProjectId(restored.activeProjectId);
    setHasUnsavedChanges(true);
    await persistWorkspace("restore", {
      data: restored,
      baseRevisions: revisions
    });
    setSettingsPanelOpen(false);
  };

  const handleSetProjectBaseline = () => {
    if (!requireEditPermission()) return;
    const nextTasks = tasks.map((task) =>
      task.projectId === activeProjectId && !task.isCategoryPlaceholder
        ? sanitizeTask({
            ...task,
            baselineStartDate: task.startDate,
            baselineEndDate: task.endDate
          })
        : task
    );
    syncState(projects, nextTasks, activeProjectId, projectPermissions, auditLogs, revisions);
    window.alert(language === "zh" ? "已将当前计划设为基线。" : "Current schedule has been set as baseline.");
  };

  const shiftDate = (baseDate: string, offsetDays: number): string => {
    const date = toDate(baseDate);
    date.setDate(date.getDate() + offsetDays);
    return toISODate(date);
  };

  const handleApplyTemplate = (templateId: string) => {
    if (!requireEditPermission()) return;
    const template = PROJECT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    const projectTasks = tasks.filter((task) => task.projectId === activeProjectId);
    const otherTasks = tasks.filter((task) => task.projectId !== activeProjectId);
    let nextOrder = (projectTasks.reduce((max, task) => Math.max(max, task.order), 0) || 0) + 10;
    const baseDate = activeTimelineStartDate || new Date().toISOString().slice(0, 10);
    const keyToTaskId = new Map<string, string>();

    const createdTasks = template.tasks.map((tpl) => {
      const id = `task-${uuidv4()}`;
      keyToTaskId.set(tpl.key, id);
      const startDate = shiftDate(baseDate, tpl.offsetDays);
      const endDate = tpl.isMilestone ? startDate : shiftDate(startDate, Math.max(0, tpl.durationDays - 1));
      const created = sanitizeTask({
        id,
        projectId: activeProjectId,
        parentId: undefined,
        isCategoryPlaceholder: false,
        category: tpl.category,
        name: tpl.name,
        startDate,
        endDate,
        baselineStartDate: startDate,
        baselineEndDate: endDate,
        duration: tpl.isMilestone ? 1 : tpl.durationDays,
        owner: tpl.owner,
        progress: 0,
        priority: tpl.priority,
        status: tpl.status,
        dependencyIds: [],
        notes: "",
        isMilestone: Boolean(tpl.isMilestone),
        order: nextOrder
      });
      nextOrder += 10;
      return created;
    });

    const normalizedCreated = createdTasks.map((task, index) => {
      const tpl = template.tasks[index];
      const dependencyIds = normalizeDependencyIds(
        task.id,
        activeProjectId,
        (tpl.dependencyKeys ?? []).map((key) => keyToTaskId.get(key)).filter((id): id is string => Boolean(id)),
        [...projectTasks, ...createdTasks]
      );
      return sanitizeTask({ ...task, dependencyIds });
    });

    const merged = [...projectTasks, ...normalizedCreated];
    if (hasDependencyCycle(merged, activeProjectId)) {
      notifyDependencyCycleInvalid();
      return;
    }

    syncState(projects, [...otherTasks, ...merged], activeProjectId, projectPermissions, auditLogs, revisions);
    setSettingsPanelOpen(false);
    window.alert(language === "zh" ? "模板任务已创建。" : "Template tasks created.");
  };

  const sendProjectNotificationEmail = async (mode: "summary" | "test") => {
    if (!requireEditPermission()) return;
    const to = notifyEmail.trim();
    if (!EMAIL_PATTERN.test(to)) {
      window.alert(language === "zh" ? "请输入有效邮箱地址。" : "Please enter a valid email address.");
      return;
    }

    const projectName = activeProject?.name || TARGET_PROJECT_NAME;
    const content =
      mode === "summary"
        ? buildSummaryEmailContent(language, projectName, projectNotificationSummary)
        : buildTestEmailContent(language, projectName);

    setSendingNotify(true);
    setNotifyResult(undefined);
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to,
          subject: content.subject,
          text: content.text,
          html: content.html
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || (language === "zh" ? "邮件发送失败" : "Failed to send email"));
      }
      setNotifyResult(language === "zh" ? "邮件已发送。" : "Email sent.");
    } catch (error) {
      console.error("Send notification email failed:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : language === "zh"
            ? "邮件发送失败，请检查服务端环境变量。"
            : "Email send failed. Check server environment variables.";
      setNotifyResult(message);
      window.alert(message);
    } finally {
      setSendingNotify(false);
    }
  };

  const toImportedDate = (value: unknown, fallback: string): string => {
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const y = String(parsed.y).padStart(4, "0");
        const m = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    if (value instanceof Date) return toISODate(value);
    if (typeof value === "string" && value.trim()) return toISODate(toDate(value.trim()));
    return fallback;
  };

  const handleImportExcel = async (file: File | undefined) => {
    if (!file || !requireEditPermission()) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        window.alert(language === "zh" ? "Excel 没有可读取的工作表。" : "No readable worksheet found.");
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        window.alert(language === "zh" ? "Excel 数据为空。" : "The spreadsheet is empty.");
        return;
      }

      const projectTasks = tasks.filter((task) => task.projectId === activeProjectId);
      const otherTasks = tasks.filter((task) => task.projectId !== activeProjectId);
      let nextOrder = (projectTasks.reduce((max, task) => Math.max(max, task.order), 0) || 0) + 10;
      const existingNameToId = new Map<string, string>();
      projectTasks.forEach((task) => {
        const key = task.name.trim().toLowerCase();
        if (!existingNameToId.has(key)) existingNameToId.set(key, task.id);
      });

      const importedDrafts: Array<
        TaskItem & {
          _dependencyNames: string[];
          _parentName?: string;
        }
      > = [];

      rows.forEach((row, index) => {
        const name = String(
          valueByAlias(row, ["任务名称", "task name", "name", "任务名", "title"]) ?? ""
        ).trim();
        if (!name) return;

        const ownerRaw = String(valueByAlias(row, ["负责人", "owner", "assignee"]) ?? "").trim();
        const categoryRaw = String(valueByAlias(row, ["分类", "category", "group"]) ?? "").trim();
        const startRaw = valueByAlias(row, ["开始", "start", "start date", "开始日期"]);
        const endRaw = valueByAlias(row, ["结束", "end", "end date", "结束日期"]);
        const progressRaw = Number(valueByAlias(row, ["进度", "progress", "progress %"]) ?? 0);
        const statusRaw = valueByAlias(row, ["状态", "status"]);
        const priorityRaw = valueByAlias(row, ["优先级", "priority"]);
        const milestoneRaw = String(valueByAlias(row, ["里程碑", "milestone", "is milestone"]) ?? "")
          .trim()
          .toLowerCase();
        const parentName = String(valueByAlias(row, ["父任务", "parent", "parent task"]) ?? "").trim();
        const dependencyRaw = String(
          valueByAlias(row, ["依赖", "dependencies", "dependency", "前置任务"]) ?? ""
        ).trim();
        const dependencyNames = dependencyRaw
          .split(/[,，;；]/)
          .map((item) => item.trim())
          .filter(Boolean);
        const fallbackDate = activeTimelineStartDate || new Date().toISOString().slice(0, 10);
        const startDate = toImportedDate(startRaw, fallbackDate);
        const endDateCandidate = toImportedDate(endRaw, startDate);
        const isMilestone = ["1", "true", "yes", "y", "是", "里程碑"].includes(milestoneRaw);
        const normalized = normalizeDates(startDate, isMilestone ? startDate : endDateCandidate);
        const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, Math.round(progressRaw))) : 0;
        const id = `task-${uuidv4()}`;
        const draft: TaskItem & { _dependencyNames: string[]; _parentName?: string } = {
          id,
          projectId: activeProjectId,
          parentId: undefined,
          isCategoryPlaceholder: false,
          category: categoryRaw || (language === "zh" ? "未分类" : "Uncategorized"),
          name,
          startDate: normalized.startDate,
          endDate: isMilestone ? normalized.startDate : normalized.endDate,
          baselineStartDate: normalized.startDate,
          baselineEndDate: isMilestone ? normalized.startDate : normalized.endDate,
          duration: isMilestone ? 1 : calcDuration(normalized.startDate, normalized.endDate),
          owner: ownerRaw || (language === "zh" ? "未分配" : "Unassigned"),
          progress,
          priority: normalizeImportedPriority(priorityRaw),
          status: normalizeImportedStatus(statusRaw),
          dependencyIds: [],
          notes: "",
          isMilestone,
          order: nextOrder + index * 10,
          _dependencyNames: dependencyNames,
          _parentName: parentName || undefined
        };
        importedDrafts.push(draft);
      });

      if (importedDrafts.length === 0) {
        window.alert(language === "zh" ? "未识别到有效任务行（请确保有任务名称列）。" : "No valid task rows found.");
        return;
      }

      const importedNameToId = new Map<string, string>();
      importedDrafts.forEach((task) => {
        const key = task.name.trim().toLowerCase();
        if (!importedNameToId.has(key)) importedNameToId.set(key, task.id);
      });

      const finalized = importedDrafts.map((task) => {
        const parentKey = task._parentName?.trim().toLowerCase();
        const parentId =
          parentKey && (importedNameToId.get(parentKey) || existingNameToId.get(parentKey))
            ? importedNameToId.get(parentKey) || existingNameToId.get(parentKey)
            : undefined;

        const mappedDeps = task._dependencyNames
          .map((depName) => {
            const key = depName.trim().toLowerCase();
            return importedNameToId.get(key) || existingNameToId.get(key);
          })
          .filter((id): id is string => Boolean(id));

        return sanitizeTask({
          ...task,
          parentId,
          dependencyIds: normalizeDependencyIds(task.id, task.projectId, mappedDeps, [...projectTasks, ...importedDrafts])
        });
      });

      const merged = [...projectTasks, ...finalized];
      if (hasDependencyCycle(merged, activeProjectId)) {
        notifyDependencyCycleInvalid();
        return;
      }

      syncState(projects, [...otherTasks, ...merged], activeProjectId, projectPermissions, auditLogs, revisions);
      setSelectedTaskId(finalized[0]?.id);
      window.alert(
        language === "zh" ? `导入成功：${finalized.length} 条任务。` : `Import successful: ${finalized.length} tasks.`
      );
    } catch (error) {
      console.error("Import failed:", error);
      window.alert(language === "zh" ? "导入失败，请检查文件格式。" : "Import failed. Please verify the file format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const exportNodeAsPng = async () => {
    const node = document.querySelector(REPORT_CAPTURE_SELECTOR) as HTMLElement | null;
    if (!node) {
      window.alert(language === "zh" ? "未找到可导出的看板区域。" : "No report area found.");
      return;
    }
    setExporting(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, window.devicePixelRatio || 1)
      });
      const url = canvas.toDataURL("image/png");
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const link = document.createElement("a");
      link.href = url;
      link.download = `weekly-report-${ts}.png`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const exportNodeAsPdf = async () => {
    const node = document.querySelector(REPORT_CAPTURE_SELECTOR) as HTMLElement | null;
    if (!node) {
      window.alert(language === "zh" ? "未找到可导出的看板区域。" : "No report area found.");
      return;
    }
    setExporting(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, window.devicePixelRatio || 1)
      });
      const imageData = canvas.toDataURL("image/png");
      const isLandscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "pt",
        format: "a4"
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = 14;
      pdf.addImage(imageData, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      pdf.save(`weekly-report-${ts}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleAuthSubmit = async () => {
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || password.length < 6) {
      setAuthError(t("authErrorEmailPasswordRequired"));
      setAuthSuccess(undefined);
      return;
    }

    setAuthLoading(true);
    setAuthError(undefined);
    setAuthSuccess(undefined);
    try {
      if (authMode === "login") {
        await signInWithPassword(email, password);
        setAuthDialogOpen(false);
      } else {
        const user = await signUpWithPassword(email, password);
        if (user) {
          setAuthDialogOpen(false);
        } else {
          setAuthSuccess(t("authRegisterSuccess"));
        }
      }
      setAuthPassword("");
    } catch (error) {
      console.error("Auth action failed:", error);
      const message = error instanceof Error && error.message ? error.message : t("authErrorGeneric");
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!isRemoteStoreEnabled) return;
    try {
      await signOutRemote();
      setAuthPassword("");
      setAuthError(undefined);
      setAuthSuccess(undefined);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleSaveAll = async () => {
    if (!requireEditPermission()) return;
    await persistWorkspace("manual");
  };

  const handleProjectCreate = (name: string, description: string) => {
    if (!requireEditPermission()) return;
    const newProject = {
      id: `project-${uuidv4()}`,
      name,
      description,
      timelineStartDate: activeTimelineStartDate || DEFAULT_TIMELINE_START
    };
    const nextProjects = [...projects, newProject];
    syncState(nextProjects, tasks, newProject.id);
    setProjectDialogOpen(false);
  };

  const handleTimelineStartDateChange = (nextDate: string) => {
    if (!requireEditPermission()) return;
    const normalized = normalizeTimelineStartDate(nextDate);
    const nextProjects = projects.map((project) =>
      project.id === activeProjectId ? { ...project, timelineStartDate: normalized } : project
    );
    syncState(nextProjects, tasks, activeProjectId);
  };

  const handleTaskSubmit = (task: TaskItem) => {
    if (!requireEditPermission()) return;
    if (!task.isMilestone && isEndBeforeStart(task.startDate, task.endDate)) {
      notifyDateRangeInvalid();
      return;
    }
    const normalized: TaskItem = sanitizeTask({
      ...task,
      dependencyIds: normalizeDependencyIds(task.id, task.projectId, task.dependencyIds, tasks)
    });
    const exists = tasks.some((item) => item.id === normalized.id);
    const nextTasks = exists ? tasks.map((item) => (item.id === normalized.id ? normalized : item)) : [...tasks, normalized];
    if (hasDependencyCycle(nextTasks, normalized.projectId)) {
      notifyDependencyCycleInvalid();
      return;
    }
    syncState(projects, nextTasks, normalized.projectId);
    setTaskDrawerOpen(false);
    setSelectedTaskId(normalized.id);
  };

  const handleTaskDelete = (taskId: string) => {
    if (!requireEditPermission()) return;
    const deletedIds = new Set([taskId, ...getDescendantIds(tasks, taskId)]);
    const nextTasks = tasks
      .filter((task) => !deletedIds.has(task.id))
      .map((task) => ({
        ...task,
        dependencyIds: task.dependencyIds.filter((id) => !deletedIds.has(id))
      }));
    syncState(projects, nextTasks, activeProjectId);
    if (selectedTaskId && deletedIds.has(selectedTaskId)) {
      setSelectedTaskId(undefined);
    }
  };

  const handleTaskDateChange = (taskId: string, startDate: string, endDate: string) => {
    if (!requireEditPermission()) return;
    const sourceTask = tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;
    if (!sourceTask.isMilestone && isEndBeforeStart(startDate, endDate)) {
      notifyDateRangeInvalid();
      return;
    }
    const normalized = normalizeDates(startDate, endDate);
    const actor = normalizedUserEmail || currentUser?.id || "system";
    let nextAuditLogs = auditLogs;
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const updated = sanitizeTask({
        ...task,
        startDate: normalized.startDate,
        endDate: task.isMilestone ? normalized.startDate : normalized.endDate,
        duration: task.isMilestone ? 1 : calcDuration(normalized.startDate, normalized.endDate)
      });
      nextAuditLogs = appendTaskAuditEntries(nextAuditLogs, task, updated, actor);
      return updated;
    });
    syncState(projects, nextTasks, activeProjectId, projectPermissions, nextAuditLogs);
  };

  const handleTaskProgressChange = (taskId: string, progress: number) => {
    if (!requireEditPermission()) return;
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, progress: safeProgress } : task));
    syncState(projects, nextTasks, activeProjectId);
  };

  const handleTaskQuickUpdate = (taskId: string, patch: Partial<TaskItem>) => {
    if (!requireEditPermission()) return;
    const sourceTask = tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;
    const candidateIsMilestone = patch.isMilestone ?? sourceTask.isMilestone;
    const candidateStartDate = patch.startDate ?? sourceTask.startDate;
    const candidateEndDate = candidateIsMilestone ? candidateStartDate : patch.endDate ?? sourceTask.endDate;
    if (!candidateIsMilestone && isEndBeforeStart(candidateStartDate, candidateEndDate)) {
      notifyDateRangeInvalid();
      return;
    }

    const actor = normalizedUserEmail || currentUser?.id || "system";
    let nextAuditLogs = auditLogs;
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextTask = { ...task, ...patch };

      if (patch.startDate || patch.endDate || patch.isMilestone !== undefined) {
        const normalized = normalizeDates(patch.startDate ?? task.startDate, patch.endDate ?? task.endDate);
        nextTask.startDate = normalized.startDate;
        nextTask.endDate = (patch.isMilestone ?? task.isMilestone) ? normalized.startDate : normalized.endDate;
      }
      if (patch.dependencyIds !== undefined) {
        nextTask.dependencyIds = normalizeDependencyIds(task.id, task.projectId, patch.dependencyIds, tasks);
      }
      if (patch.progress !== undefined) {
        nextTask.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
      }
      nextTask.duration = nextTask.isMilestone ? 1 : calcDuration(nextTask.startDate, nextTask.endDate);
      const updated = sanitizeTask(nextTask);
      nextAuditLogs = appendTaskAuditEntries(nextAuditLogs, task, updated, actor);
      return updated;
    });
    if (patch.dependencyIds !== undefined && hasDependencyCycle(nextTasks, sourceTask.projectId)) {
      notifyDependencyCycleInvalid();
      return;
    }
    syncState(projects, nextTasks, activeProjectId, projectPermissions, nextAuditLogs);
  };

  const handleToggleCollapse = (taskId: string) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const switchLanguage = (nextLanguage: Language) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setHasUnsavedChanges(true);
  };

  const handleInsertRoot = (preferredCategory?: string, mode: "task" | "category" = "task", anchorTaskId?: string) => {
    if (!requireEditPermission()) return;
    const projectTasks = tasks.filter((task) => task.projectId === activeProjectId).sort((a, b) => a.order - b.order);
    const otherTasks = tasks.filter((task) => task.projectId !== activeProjectId);
    const fallbackDate = projectTasks[projectTasks.length - 1]?.endDate ?? new Date().toISOString().slice(0, 10);
    const existingCategories = new Set(projectTasks.map((task) => (task.category || "").trim()).filter(Boolean));

    const makeUniqueCategory = (base: string) => {
      if (!existingCategories.has(base)) return base;
      let n = 2;
      // Keep generated category names predictable and unique.
      while (existingCategories.has(language === "zh" ? `${base}${n}` : `${base} ${n}`)) {
        n += 1;
      }
      return language === "zh" ? `${base}${n}` : `${base} ${n}`;
    };

    const newTask: TaskItem =
      mode === "category"
        ? sanitizeTask({
            id: `task-${uuidv4()}`,
            projectId: activeProjectId,
            parentId: undefined,
            isCategoryPlaceholder: true,
            category: makeUniqueCategory(language === "zh" ? "\u65b0\u5206\u7c7b" : "New Category"),
            name: language === "zh" ? "\u5206\u7c7b\u5360\u4f4d" : "Category Placeholder",
            startDate: fallbackDate,
            endDate: fallbackDate,
            duration: 1,
            owner: "",
            progress: 0,
            priority: "medium",
            status: "not_started",
            dependencyIds: [],
            notes: "__CATEGORY_PLACEHOLDER__",
            isMilestone: false,
            order: 0
          })
        : sanitizeTask({
            id: `task-${uuidv4()}`,
            projectId: activeProjectId,
            parentId: undefined,
            isCategoryPlaceholder: false,
            category: preferredCategory?.trim() || makeUniqueCategory(language === "zh" ? "\u65b0\u5206\u7c7b" : "New Category"),
            name: language === "zh" ? "\u65b0\u4efb\u52a1" : "New Task",
            startDate: fallbackDate,
            endDate: fallbackDate,
            duration: 1,
            owner: language === "zh" ? "\u672a\u5206\u914d" : "Unassigned",
            progress: 0,
            priority: "medium",
            status: "not_started",
            dependencyIds: [],
            notes: "",
            isMilestone: false,
            order: 0
          });
    let nextProjectTasks: TaskItem[] = [...projectTasks, newTask];

    if (mode === "task") {
      let insertionIndex = -1;

      if (anchorTaskId) {
        insertionIndex = projectTasks.findIndex((task) => task.id === anchorTaskId);
      }

      if (insertionIndex < 0 && preferredCategory?.trim()) {
        const targetCategory = preferredCategory.trim();
        projectTasks.forEach((task, index) => {
          if ((task.category || "").trim() === targetCategory) {
            insertionIndex = index;
          }
        });
      }

      if (insertionIndex >= 0) {
        const insertAt = insertionIndex + 1;
        nextProjectTasks = [...projectTasks.slice(0, insertAt), newTask, ...projectTasks.slice(insertAt)];
      }
    }

    const reordered = nextProjectTasks.map((task, index) => ({ ...task, order: (index + 1) * 10 }));
    syncState(projects, [...otherTasks, ...reordered], activeProjectId);
    if (mode === "task") {
      setSelectedTaskId(newTask.id);
    }
  };

  const handleInsertChild = (parentTaskId: string) => {
    if (!requireEditPermission()) return;
    const parentTask = tasks.find((task) => task.id === parentTaskId && task.projectId === activeProjectId);
    if (!parentTask) return;

    const siblingOrders = tasks
      .filter((task) => task.projectId === activeProjectId && task.parentId === parentTaskId)
      .map((task) => task.order);
    const nextOrder = siblingOrders.length > 0 ? Math.max(...siblingOrders) + 10 : parentTask.order + 1;

    const fallbackDate = parentTask.endDate || new Date().toISOString().slice(0, 10);
    const childTask = sanitizeTask({
      id: `task-${uuidv4()}`,
      projectId: activeProjectId,
      parentId: parentTaskId,
      isCategoryPlaceholder: false,
      category: parentTask.category,
      name: language === "zh" ? "新子任务" : "New Subtask",
      startDate: parentTask.startDate || fallbackDate,
      endDate: parentTask.endDate || fallbackDate,
      duration: 1,
      owner: language === "zh" ? "未分配" : "Unassigned",
      progress: 0,
      priority: "medium",
      status: "not_started",
      dependencyIds: [],
      notes: "",
      isMilestone: false,
      order: nextOrder
    });

    syncState(projects, [...tasks, childTask], activeProjectId);
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(parentTaskId);
      return next;
    });
    setSelectedTaskId(childTask.id);
  };

  const handleRenameCategory = (currentCategory: string, nextCategory: string) => {
    if (!requireEditPermission()) return;
    const current = currentCategory.trim();
    const next = nextCategory.trim();
    if (!current || !next || current === next) return;

    const nextTasks = tasks.map((task) => {
      if (task.projectId !== activeProjectId) return task;
      if ((task.category || "").trim() !== current) return task;
      return sanitizeTask({ ...task, category: next });
    });
    syncState(projects, nextTasks, activeProjectId);
  };

  const handleTaskReorder = (activeTaskId: string, overTaskId: string) => {
    if (!requireEditPermission()) return;
    if (!activeTaskId || !overTaskId || activeTaskId === overTaskId) return;
    const nextTasks = reorderTasks(tasks, activeProjectId, activeTaskId, overTaskId);
    syncState(projects, nextTasks, activeProjectId);
    setSelectedTaskId(activeTaskId);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner header-inner-full">
          <div className="header-title-group">
            <img className="header-brand-logo" src={peakpointLogo} alt="PeakPoint logo" />
            <div className="header-title-text">
              <h1>PeakPoint Project Management</h1>
              <p>{t("appSubtitle")}</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="language-toggle" aria-label={t("language")}>
              <button className={`lang-btn ${language === "zh" ? "active" : ""}`} onClick={() => switchLanguage("zh")}>
                CN
              </button>
              <button className={`lang-btn ${language === "en" ? "active" : ""}`} onClick={() => switchLanguage("en")}>
                EN
              </button>
            </div>
            {isRemoteStoreEnabled && !canEdit ? <span className="readonly-badge">{t("authReadonlyHint")}</span> : null}
            {isRemoteStoreEnabled ? (
              <span className={`role-chip role-${currentProjectRole}`} title={t("projectRole")}>
                {t("projectRole")}: {getRoleLabel(currentProjectRole)}
              </span>
            ) : null}
            <div ref={settingsPanelRef} className="settings-panel-wrap">
              <button className="btn btn-secondary" onClick={() => setSettingsPanelOpen((prev) => !prev)}>
                {language === "zh" ? "设置" : "Settings"}
              </button>
              {isSettingsPanelOpen ? (
                <div className="settings-panel">
                  <details className="settings-group" open>
                    <summary>{language === "zh" ? "账号" : "Account"}</summary>
                    <div className="settings-group-body">
                      {isRemoteStoreEnabled ? (
                        currentUser ? (
                          <>
                            <div className="settings-current-user" title={currentUser.email}>
                              {t("authSignedInAs")}: {currentUser.email || currentUser.id.slice(0, 8)}
                            </div>
                            <button className="btn btn-secondary settings-inline-btn" onClick={() => void handleSignOut()}>
                              {t("logout")}
                            </button>
                          </>
                        ) : (
                          <div className="settings-inline-actions">
                            <button className="btn btn-secondary settings-inline-btn" onClick={() => openAuthDialog("login")}>
                              {t("login")}
                            </button>
                            <button className="btn btn-secondary settings-inline-btn" onClick={() => openAuthDialog("register")}>
                              {t("register")}
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="permission-empty">{language === "zh" ? "当前为本地模式" : "Local mode is active."}</div>
                      )}
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "项目设置" : "Project Settings"}</summary>
                    <div className="settings-group-body">
                      <div className="settings-field-row">
                        <label className="settings-field-label" htmlFor="settings-timeline-start">
                          {t("timelineStart")}
                        </label>
                        <input
                          id="settings-timeline-start"
                          type="date"
                          className="input timeline-start-input settings-timeline-input"
                          value={activeTimelineStartDate}
                          title={t("timelineStart")}
                          aria-label={t("timelineStart")}
                          disabled={!canEdit || !activeProjectId}
                          onChange={(event) => handleTimelineStartDateChange(event.target.value)}
                        />
                      </div>
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{t("managePermissions")}</summary>
                    <div className="settings-group-body">
                      {isRemoteStoreEnabled && currentUser ? (
                        <>
                          <div className="permission-panel-list settings-scroll-list">
                            {activeProjectPermissions.length === 0 ? (
                              <div className="permission-empty">{t("noProjectMembers")}</div>
                            ) : (
                              activeProjectPermissions
                                .slice()
                                .sort((a, b) => a.email.localeCompare(b.email))
                                .map((item) => (
                                  <div key={`${item.projectId}:${item.email}`} className="permission-row">
                                    <span className="permission-email">{item.email}</span>
                                    {canManagePermissions ? (
                                      <select
                                        className="permission-role-select"
                                        value={item.role}
                                        onChange={(event) => handleRoleChange(item.email, event.target.value as ProjectRole)}
                                      >
                                        <option value="admin">{t("roleAdmin")}</option>
                                        <option value="editor">{t("roleEditor")}</option>
                                        <option value="viewer">{t("roleViewer")}</option>
                                      </select>
                                    ) : (
                                      <span className="permission-role-label">{getRoleLabel(item.role)}</span>
                                    )}
                                    {canManagePermissions ? (
                                      <button className="btn btn-ghost permission-remove-btn" onClick={() => handleRemovePermission(item.email)}>
                                        {t("remove")}
                                      </button>
                                    ) : null}
                                  </div>
                                ))
                            )}
                          </div>
                          {canManagePermissions ? (
                            <div className="permission-panel-create settings-form-row">
                              <input
                                className="input permission-email-input"
                                value={permissionEmail}
                                placeholder={t("permissionEmailPlaceholder")}
                                onChange={(event) => setPermissionEmail(event.target.value)}
                              />
                              <select value={permissionRole} onChange={(event) => setPermissionRole(event.target.value as ProjectRole)}>
                                <option value="admin">{t("roleAdmin")}</option>
                                <option value="editor">{t("roleEditor")}</option>
                                <option value="viewer">{t("roleViewer")}</option>
                              </select>
                              <button className="btn btn-primary permission-add-btn" onClick={handleUpsertPermission}>
                                {t("addOrUpdateRole")}
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="permission-empty">{language === "zh" ? "请先登录后管理权限" : "Sign in to manage permissions."}</div>
                      )}
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "审计日志" : "Audit Log"}</summary>
                    <div className="settings-group-body">
                      {isRemoteStoreEnabled ? (
                        <div className="settings-scroll-list">
                          {activeProjectAuditLogs.length === 0 ? (
                            <div className="permission-empty">{language === "zh" ? "暂无审计记录" : "No audit entries yet"}</div>
                          ) : (
                            activeProjectAuditLogs.map((entry) => (
                              <div key={entry.id} className="audit-row">
                                <div className="audit-row-main">
                                  <span className="audit-task-name">{entry.taskName}</span>
                                  <span className="audit-field">{getAuditFieldLabel(entry.field)}</span>
                                </div>
                                <div className="audit-row-meta">
                                  <span className="audit-before">{entry.before}</span>
                                  <span className="audit-arrow">→</span>
                                  <span className="audit-after">{entry.after}</span>
                                </div>
                                <div className="audit-row-foot">
                                  <span>{entry.changedBy}</span>
                                  <span>{new Date(entry.changedAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="permission-empty">{language === "zh" ? "云端模式下可用" : "Available in cloud mode."}</div>
                      )}
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "版本回滚" : "Version Rollback"}</summary>
                    <div className="settings-group-body">
                      <div className="settings-scroll-list">
                        {activeProjectRevisions.length === 0 ? (
                          <div className="permission-empty">{language === "zh" ? "暂无可回滚版本" : "No revisions yet"}</div>
                        ) : (
                          activeProjectRevisions.map((revision) => (
                            <div key={revision.id} className="revision-row">
                              <div className="revision-row-main">
                                <span className="revision-trigger">{revision.trigger.toUpperCase()}</span>
                                <span className="revision-meta-user">{revision.createdBy}</span>
                              </div>
                              <div className="revision-row-foot">
                                <span>{new Date(revision.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
                                <button className="btn btn-ghost revision-restore-btn" onClick={() => void handleRestoreRevision(revision.id)}>
                                  {language === "zh" ? "回滚到此版本" : "Restore"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "基线对比" : "Baseline"}</summary>
                    <div className="settings-group-body">
                      <div className="baseline-panel-head settings-inline-head">
                        <span>{language === "zh" ? "计划基线 vs 实际" : "Baseline vs Actual"}</span>
                        <button className="btn btn-ghost baseline-reset-btn" onClick={handleSetProjectBaseline}>
                          {language === "zh" ? "设为新基线" : "Set New Baseline"}
                        </button>
                      </div>
                      <div className="settings-scroll-list">
                        {baselineDiffRows.length === 0 ? (
                          <div className="permission-empty">{language === "zh" ? "当前无偏差任务" : "No variance detected"}</div>
                        ) : (
                          baselineDiffRows.map((row) => (
                            <div key={row.taskId} className="baseline-row">
                              <div className="baseline-row-name">{row.taskName}</div>
                              <div className="baseline-row-dates">
                                <span>{`${row.baselineStart} ~ ${row.baselineEnd}`}</span>
                                <span>{`${row.actualStart} ~ ${row.actualEnd}`}</span>
                              </div>
                              <div className="baseline-row-diff">
                                <span>{language === "zh" ? "开工偏差" : "Start"}: {row.startDiff > 0 ? `+${row.startDiff}` : row.startDiff}d</span>
                                <span>{language === "zh" ? "完工偏差" : "Finish"}: {row.endDiff > 0 ? `+${row.endDiff}` : row.endDiff}d</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "模板任务包" : "Templates"}</summary>
                    <div className="settings-group-body">
                      <div className="settings-scroll-list">
                        {PROJECT_TEMPLATES.map((tpl) => (
                          <div key={tpl.id} className="template-row">
                            <div className="template-row-main">{tpl.title}</div>
                            <div className="template-row-desc">{tpl.description}</div>
                            <div className="template-row-foot">
                              <span>{language === "zh" ? `${tpl.tasks.length} 个任务` : `${tpl.tasks.length} tasks`}</span>
                              <button className="btn btn-ghost template-apply-btn" onClick={() => handleApplyTemplate(tpl.id)}>
                                {language === "zh" ? "应用模板" : "Apply"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "邮件通知" : "Email Alerts"}</summary>
                    <div className="settings-group-body">
                      <div className="notify-summary">
                        {language === "zh"
                          ? `延期/逾期 ${projectNotificationSummary.delayed.length}，即将开始 ${projectNotificationSummary.upcoming.length}`
                          : `${projectNotificationSummary.delayed.length} delayed, ${projectNotificationSummary.upcoming.length} upcoming`}
                      </div>
                      <input
                        className="input notify-email-input"
                        value={notifyEmail}
                        placeholder={language === "zh" ? "收件人邮箱" : "Recipient email"}
                        onChange={(event) => setNotifyEmail(event.target.value)}
                      />
                      <div className="notify-panel-actions">
                        <button
                          className="btn btn-ghost notify-action-btn"
                          onClick={() => void sendProjectNotificationEmail("summary")}
                          disabled={isSendingNotify}
                        >
                          {isSendingNotify ? (language === "zh" ? "发送中..." : "Sending...") : language === "zh" ? "发送风险汇总" : "Send Summary"}
                        </button>
                        <button
                          className="btn btn-ghost notify-action-btn"
                          onClick={() => void sendProjectNotificationEmail("test")}
                          disabled={isSendingNotify}
                        >
                          {language === "zh" ? "发送测试邮件" : "Send Test"}
                        </button>
                      </div>
                      {notifyResult ? <div className="notify-result">{notifyResult}</div> : null}
                    </div>
                  </details>

                  <details className="settings-group">
                    <summary>{language === "zh" ? "导入" : "Import"}</summary>
                    <div className="settings-group-body">
                      <button className="btn btn-secondary settings-inline-btn" disabled={!canEdit || isImporting} onClick={() => fileInputRef.current?.click()}>
                        {isImporting ? (language === "zh" ? "导入中..." : "Importing...") : language === "zh" ? "Excel导入" : "Import Excel"}
                      </button>
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
            <div ref={riskPanelRef} className="risk-panel-wrap">
              <button className="btn btn-secondary" onClick={() => setRiskPanelOpen((prev) => !prev)}>
                {language === "zh" ? `风险(${criticalRiskRows.length})` : `Risks (${criticalRiskRows.length})`}
              </button>
              {isRiskPanelOpen ? (
                <div className="risk-panel">
                  {projectHealthMetrics.criticalPathCycleDetected ? (
                    <div className="risk-cycle-warning">
                      {language === "zh"
                        ? "检测到依赖环路，关键路径计算已跳过。请先修复依赖关系。"
                        : "Dependency cycle detected. Critical path is skipped until dependencies are fixed."}
                    </div>
                  ) : null}
                  <div className="risk-section-title">
                    {language === "zh"
                      ? `关键路径（${criticalPathRows.length} 任务 / ${projectHealthMetrics.criticalPathDurationDays} 天）`
                      : `Critical Path (${criticalPathRows.length} tasks / ${projectHealthMetrics.criticalPathDurationDays} days)`}
                  </div>
                  {criticalPathRows.length === 0 ? (
                    <div className="permission-empty">{language === "zh" ? "暂无可计算的关键路径" : "No critical path yet"}</div>
                  ) : (
                    criticalPathRows.map((row, index) => (
                      <div key={`cp-${row.id}`} className="risk-row risk-row-critical-path">
                        <div className="risk-row-main">
                          <span className="risk-cp-index">{index + 1}</span>
                          <span>{row.name}</span>
                        </div>
                        <div className="risk-row-meta">
                          <span>{row.owner || (language === "zh" ? "未分配" : "Unassigned")}</span>
                          <span>{`${row.startDate} → ${row.endDate}`}</span>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="risk-section-title">
                    {language === "zh" ? `延期风险（${criticalRiskRows.length}）` : `Delay Risks (${criticalRiskRows.length})`}
                  </div>
                  {criticalRiskRows.length === 0 ? (
                    <div className="permission-empty">{language === "zh" ? "当前无关键延期风险" : "No critical delay risks"}</div>
                  ) : (
                    criticalRiskRows.map((row) => (
                      <div key={row.id} className={`risk-row ${row.isCriticalPath ? "risk-row-critical-path" : ""}`}>
                        <div className="risk-row-main">
                          {row.name}
                          {row.isCriticalPath ? (
                            <span className="risk-cp-tag">{language === "zh" ? "关键路径" : "Critical Path"}</span>
                          ) : null}
                        </div>
                        <div className="risk-row-meta">
                          <span>{row.owner || (language === "zh" ? "未分配" : "Unassigned")}</span>
                          <span>{row.endDate}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div ref={dashboardPanelRef} className="dashboard-panel-wrap">
              <button className="btn btn-secondary" onClick={() => setDashboardPanelOpen((prev) => !prev)}>
                {language === "zh" ? "仪表盘" : "Dashboard"}
              </button>
              {isDashboardPanelOpen ? (
                <div className="dashboard-panel">
                  <div className="dashboard-kpi-grid">
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "任务总数" : "Total Tasks"}</div>
                      <div className="dashboard-kpi-value">{projectHealthMetrics.total}</div>
                    </div>
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "按时率" : "On-time Rate"}</div>
                      <div className="dashboard-kpi-value">{formatPercent(projectHealthMetrics.onTimeRate)}</div>
                    </div>
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "延期率" : "Delay Rate"}</div>
                      <div className="dashboard-kpi-value">{formatPercent(projectHealthMetrics.delayedRate)}</div>
                    </div>
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "完成率" : "Completion Rate"}</div>
                      <div className="dashboard-kpi-value">{formatPercent(projectHealthMetrics.completedRate)}</div>
                    </div>
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "关键路径任务" : "Critical Path Tasks"}</div>
                      <div className="dashboard-kpi-value">{projectHealthMetrics.criticalPathCount}</div>
                    </div>
                    <div className="dashboard-kpi-card">
                      <div className="dashboard-kpi-title">{language === "zh" ? "关键路径延期" : "Critical Path Delays"}</div>
                      <div className="dashboard-kpi-value">{projectHealthMetrics.criticalPathDelayedCount}</div>
                    </div>
                  </div>
                  <div className="dashboard-kpi-foot">
                    {language === "zh"
                      ? `关键路径总工期：${projectHealthMetrics.criticalPathDurationDays} 天`
                      : `Critical path duration: ${projectHealthMetrics.criticalPathDurationDays} days`}
                  </div>
                  <div className="dashboard-owner-head">{language === "zh" ? "负责人负载" : "Owner Workload"}</div>
                  {projectHealthMetrics.ownerLoad.length === 0 ? (
                    <div className="permission-empty">{language === "zh" ? "暂无任务数据" : "No task data yet"}</div>
                  ) : (
                    projectHealthMetrics.ownerLoad.map((row) => (
                      <div key={row.owner} className="dashboard-owner-row">
                        <div className="dashboard-owner-main">
                          <span className="dashboard-owner-name">{row.owner}</span>
                          <span className="dashboard-owner-total">
                            {language === "zh" ? `任务 ${row.total}` : `${row.total} tasks`}
                          </span>
                        </div>
                        <div className="dashboard-owner-meta">
                          <span>{language === "zh" ? `完成 ${row.completed}` : `Done ${row.completed}`}</span>
                          <span>{language === "zh" ? `延期 ${row.delayed}` : `Delayed ${row.delayed}`}</span>
                          <span>{language === "zh" ? `进行中 ${row.inProgress}` : `In Progress ${row.inProgress}`}</span>
                          <span>{language === "zh" ? `未开始 ${row.notStarted}` : `Not Started ${row.notStarted}`}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div ref={exportPanelRef} className="export-panel-wrap">
              <button className="btn btn-secondary" onClick={() => setExportPanelOpen((prev) => !prev)} disabled={isExporting}>
                {isExporting ? (language === "zh" ? "导出中..." : "Exporting...") : language === "zh" ? "周报导出" : "Weekly Export"}
              </button>
              {isExportPanelOpen ? (
                <div className="export-panel">
                  <button className="btn btn-ghost export-btn" onClick={() => void exportNodeAsPng()} disabled={isExporting}>
                    {language === "zh" ? "导出 PNG" : "Export PNG"}
                  </button>
                  <button className="btn btn-ghost export-btn" onClick={() => void exportNodeAsPdf()} disabled={isExporting}>
                    {language === "zh" ? "导出 PDF" : "Export PDF"}
                  </button>
                </div>
              ) : null}
            </div>
            <button className="btn btn-secondary" onClick={() => void handleSaveAll()} disabled={!canEdit || !hasUnsavedChanges || isSaving}>
              {isSaving ? (language === "zh" ? "保存中..." : "Saving...") : hasUnsavedChanges ? t("saveChanges") : t("saved")}
            </button>
            <select value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!requireEditPermission()) return;
                setProjectDialogOpen(true);
              }}
            >
              {t("addProject")}
            </button>
          </div>
        </div>
      </header>

      <div className="content-wrap content-wrap-full">
        <main className="main-layout main-layout-single main-layout-dense">
          <section className="right-panel panel-card">
            <GanttBoard
              language={language}
              t={t}
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              viewMode={viewMode}
              columnWidth={zoom}
              viewStartDate={activeTimelineStartDate}
              canEdit={canEdit}
              onSelectTask={setSelectedTaskId}
              onDateChange={handleTaskDateChange}
              onProgressChange={handleTaskProgressChange}
              onDeleteTask={handleTaskDelete}
              onInsertRoot={handleInsertRoot}
              onInsertChild={handleInsertChild}
              onRenameCategory={handleRenameCategory}
              onReorderTask={handleTaskReorder}
              onToggleCollapse={handleToggleCollapse}
              onQuickUpdate={handleTaskQuickUpdate}
              collapsedTaskIds={collapsedTaskIds}
              riskTaskIds={criticalRiskTaskIds}
              criticalPathTaskIds={criticalPathTaskIds}
              onRequireAuth={() => openAuthDialog("login")}
            />
          </section>
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          void handleImportExcel(file);
        }}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        mode={authMode}
        language={language}
        email={authEmail}
        password={authPassword}
        loading={isAuthLoading}
        errorMessage={authError}
        successMessage={authSuccess}
        t={t}
        onClose={() => setAuthDialogOpen(false)}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(undefined);
          setAuthSuccess(undefined);
        }}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={() => void handleAuthSubmit()}
      />

      <TaskFormDrawer
        language={language}
        t={t}
        open={isTaskDrawerOpen}
        mode="create"
        projects={projects}
        tasks={tasks}
        activeProjectId={activeProjectId}
        initialTask={undefined}
        onClose={() => setTaskDrawerOpen(false)}
        onSubmit={handleTaskSubmit}
      />
      <ProjectDialog t={t} open={isProjectDialogOpen} onClose={() => setProjectDialogOpen(false)} onSubmit={handleProjectCreate} />
    </div>
  );
};


