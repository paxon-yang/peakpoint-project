import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useRef } from "react";
import { AuthDialog } from "./components/AuthDialog";
import { GanttBoard } from "./components/GanttBoard";
import { ProjectDialog } from "./components/ProjectDialog";
import { TaskFormDrawer } from "./components/TaskFormDrawer";
import { defaultState } from "./data/defaultData";
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
  SortBy,
  TaskAuditLogItem,
  TaskFilters,
  TaskItem,
  ViewModeOption
} from "./types";
import { calcDuration, normalizeDates } from "./utils/date";
import { getDescendantIds, getVisibleTasks, reorderTasks, sanitizeTask } from "./utils/taskUtils";

const STORAGE_KEY = "ccsa-project-management-state-v2";
const LEGACY_STORAGE_KEYS = ["ccsa-project-management-state-v1"];
const LANGUAGE_KEY = "ccsa-project-management-language";
const LEGACY_PROJECT_NAME = "CCSA主项目 / CCSA Main Project";
const TARGET_PROJECT_NAME = "TMM project";
const DEFAULT_TIMELINE_START = "2026-04-01";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  auditLogs: normalizeAuditLogs(parsed.auditLogs)
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
  const [isPermissionPanelOpen, setPermissionPanelOpen] = useState(false);
  const [permissionEmail, setPermissionEmail] = useState("");
  const [permissionRole, setPermissionRole] = useState<ProjectRole>("viewer");
  const permissionPanelRef = useRef<HTMLDivElement>(null);
  const [isAuditPanelOpen, setAuditPanelOpen] = useState(false);
  const auditPanelRef = useRef<HTMLDivElement>(null);

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
    if (!isPermissionPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (permissionPanelRef.current?.contains(target)) return;
      setPermissionPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isPermissionPanelOpen]);

  useEffect(() => {
    if (!isAuditPanelOpen) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (auditPanelRef.current?.contains(target)) return;
      setAuditPanelOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [isAuditPanelOpen]);

  useEffect(() => {
    setPermissionPanelOpen(false);
    setAuditPanelOpen(false);
  }, [activeProjectId, normalizedUserEmail]);

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

  const syncState = (
    nextProjects: PersistedState["projects"],
    nextTasks: PersistedState["tasks"],
    nextActiveProjectId: string,
    nextPermissions: ProjectPermissionItem[] = projectPermissions,
    nextAuditLogs: TaskAuditLogItem[] = auditLogs
  ) => {
    setProjects(nextProjects);
    setTasks(nextTasks);
    setProjectPermissions(nextPermissions);
    setAuditLogs(nextAuditLogs);
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
    const snapshot: PersistedState = {
      projects,
      tasks,
      activeProjectId,
      projectPermissions,
      auditLogs
    };
    setIsSaving(true);
    let remoteSaved = true;
    try {
      if (isRemoteStoreEnabled) {
        await saveRemoteState(snapshot);
      }
    } catch (error) {
      remoteSaved = false;
      console.error("Remote save failed:", error);
      window.alert(language === "zh" ? "云端保存失败，请稍后重试。" : "Cloud save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }

    saveState(snapshot);
    localStorage.setItem(LANGUAGE_KEY, language);
    setHasUnsavedChanges(!remoteSaved && isRemoteStoreEnabled);
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
    const normalized = sanitizeTask(task);
    const exists = tasks.some((item) => item.id === normalized.id);
    const nextTasks = exists ? tasks.map((item) => (item.id === normalized.id ? normalized : item)) : [...tasks, normalized];
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
      if (patch.progress !== undefined) {
        nextTask.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
      }
      nextTask.duration = nextTask.isMilestone ? 1 : calcDuration(nextTask.startDate, nextTask.endDate);
      const updated = sanitizeTask(nextTask);
      nextAuditLogs = appendTaskAuditEntries(nextAuditLogs, task, updated, actor);
      return updated;
    });
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
            <h1>{t("appTitle")}</h1>
            <p>{t("appSubtitle")}</p>
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
            {isRemoteStoreEnabled && currentUser ? (
              <span className="user-chip" title={currentUser.email}>
                {t("authSignedInAs")}: {currentUser.email || currentUser.id.slice(0, 8)}
              </span>
            ) : null}
            {isRemoteStoreEnabled ? (
              <span className={`role-chip role-${currentProjectRole}`} title={t("projectRole")}>
                {t("projectRole")}: {getRoleLabel(currentProjectRole)}
              </span>
            ) : null}
            {isRemoteStoreEnabled && !currentUser ? (
              <>
                <button className="btn btn-secondary" onClick={() => openAuthDialog("login")}>
                  {t("login")}
                </button>
                <button className="btn btn-secondary" onClick={() => openAuthDialog("register")}>
                  {t("register")}
                </button>
              </>
            ) : null}
            {isRemoteStoreEnabled && currentUser ? (
              <button className="btn btn-secondary" onClick={() => void handleSignOut()}>
                {t("logout")}
              </button>
            ) : null}
            {isRemoteStoreEnabled && currentUser ? (
              <div ref={permissionPanelRef} className="permission-panel-wrap">
                <button className="btn btn-secondary" onClick={() => setPermissionPanelOpen((prev) => !prev)}>
                  {t("managePermissions")}
                </button>
                {isPermissionPanelOpen ? (
                  <div className="permission-panel">
                    <div className="permission-panel-list">
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
                      <div className="permission-panel-create">
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
                  </div>
                ) : null}
              </div>
            ) : null}
            {isRemoteStoreEnabled ? (
              <div ref={auditPanelRef} className="audit-panel-wrap">
                <button className="btn btn-secondary" onClick={() => setAuditPanelOpen((prev) => !prev)}>
                  {language === "zh" ? "审计日志" : "Audit Log"}
                </button>
                {isAuditPanelOpen ? (
                  <div className="audit-panel">
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
                ) : null}
              </div>
            ) : null}
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
            <input
              type="date"
              className="input timeline-start-input"
              value={activeTimelineStartDate}
              title={t("timelineStart")}
              aria-label={t("timelineStart")}
              disabled={!canEdit || !activeProjectId}
              onChange={(event) => handleTimelineStartDateChange(event.target.value)}
            />
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
              onRequireAuth={() => openAuthDialog("login")}
            />
          </section>
        </main>
      </div>

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

