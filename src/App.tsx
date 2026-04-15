import { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { GanttBoard } from "./components/GanttBoard";
import { ProjectDialog } from "./components/ProjectDialog";
import { TaskFormDrawer } from "./components/TaskFormDrawer";
import { defaultState } from "./data/defaultData";
import { createTranslator } from "./i18n";
import { Language, PersistedState, SortBy, TaskFilters, TaskItem, ViewModeOption } from "./types";
import { calcDuration, normalizeDates } from "./utils/date";
import { getDescendantIds, getVisibleTasks, reorderTasks, sanitizeTask } from "./utils/taskUtils";

const STORAGE_KEY = "ccsa-project-management-state-v2";
const LANGUAGE_KEY = "ccsa-project-management-language";
const LEGACY_PROJECT_NAME = "CCSA主项目 / CCSA Main Project";
const TARGET_PROJECT_NAME = "TMM project";

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

const loadState = (): PersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.projects?.length) return defaultState;
    return {
      ...parsed,
      projects: parsed.projects.map((project) =>
        project.name === LEGACY_PROJECT_NAME ? { ...project, name: TARGET_PROJECT_NAME } : project
      ),
      tasks: (parsed.tasks ?? []).map((task) => ({
        ...task,
        status: normalizeStatus(task.status),
        priority: normalizePriority(task.priority),
        category: normalizeCategory(task),
        dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : [],
        isCategoryPlaceholder: Boolean(task.isCategoryPlaceholder)
      }))
    };
  } catch {
    return defaultState;
  }
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
  const [activeProjectId, setActiveProjectId] = useState(initial.activeProjectId || initial.projects[0]?.id || "");
  const [language, setLanguage] = useState<Language>(loadLanguage());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [isTaskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [isProjectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());

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

  const visibleTasks = useMemo(
    () => getVisibleTasks(tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy),
    [tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy]
  );

  const syncState = (nextProjects: PersistedState["projects"], nextTasks: PersistedState["tasks"], nextActiveProjectId: string) => {
    setProjects(nextProjects);
    setTasks(nextTasks);
    setActiveProjectId(nextActiveProjectId);
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = () => {
    saveState({
      projects,
      tasks,
      activeProjectId
    });
    localStorage.setItem(LANGUAGE_KEY, language);
    setHasUnsavedChanges(false);
  };

  const handleProjectCreate = (name: string, description: string) => {
    const newProject = { id: `project-${uuidv4()}`, name, description };
    const nextProjects = [...projects, newProject];
    syncState(nextProjects, tasks, newProject.id);
    setProjectDialogOpen(false);
  };

  const handleTaskSubmit = (task: TaskItem) => {
    const normalized = sanitizeTask(task);
    const exists = tasks.some((item) => item.id === normalized.id);
    const nextTasks = exists ? tasks.map((item) => (item.id === normalized.id ? normalized : item)) : [...tasks, normalized];
    syncState(projects, nextTasks, normalized.projectId);
    setTaskDrawerOpen(false);
    setSelectedTaskId(normalized.id);
  };

  const handleTaskDelete = (taskId: string) => {
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
    const normalized = normalizeDates(startDate, endDate);
    const nextTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            startDate: normalized.startDate,
            endDate: task.isMilestone ? normalized.startDate : normalized.endDate,
            duration: task.isMilestone ? 1 : calcDuration(normalized.startDate, normalized.endDate)
          }
        : task
    );
    syncState(projects, nextTasks, activeProjectId);
  };

  const handleTaskProgressChange = (taskId: string, progress: number) => {
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, progress: safeProgress } : task));
    syncState(projects, nextTasks, activeProjectId);
  };

  const handleTaskQuickUpdate = (taskId: string, patch: Partial<TaskItem>) => {
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
      return sanitizeTask(nextTask);
    });
    syncState(projects, nextTasks, activeProjectId);
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

  const handleRenameCategory = (currentCategory: string, nextCategory: string) => {
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
            <button className="btn btn-secondary" onClick={handleSaveAll} disabled={!hasUnsavedChanges}>
              {hasUnsavedChanges ? t("saveChanges") : t("saved")}
            </button>
            <select value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={() => setProjectDialogOpen(true)}>
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
              onSelectTask={setSelectedTaskId}
              onDateChange={handleTaskDateChange}
              onProgressChange={handleTaskProgressChange}
              onDeleteTask={handleTaskDelete}
              onInsertRoot={handleInsertRoot}
              onRenameCategory={handleRenameCategory}
              onReorderTask={handleTaskReorder}
              onToggleCollapse={handleToggleCollapse}
              onQuickUpdate={handleTaskQuickUpdate}
              collapsedTaskIds={collapsedTaskIds}
            />
          </section>
        </main>
      </div>

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
