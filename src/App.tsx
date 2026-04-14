import { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { GanttBoard } from "./components/GanttBoard";
import { ProjectDialog } from "./components/ProjectDialog";
import { TaskFormDrawer } from "./components/TaskFormDrawer";
import { TaskTable } from "./components/TaskTable";
import { Toolbar } from "./components/Toolbar";
import { defaultState } from "./data/defaultData";
import { PersistedState, SortBy, TaskFilters, TaskItem, ViewModeOption } from "./types";
import { calcDuration, normalizeDates } from "./utils/date";
import { getDescendantIds, getVisibleTasks, reorderTasks, sanitizeTask, uniqueValues } from "./utils/taskUtils";

const STORAGE_KEY = "ccsa-project-management-state-v1";

const loadState = (): PersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.projects?.length) return defaultState;
    return parsed;
  } catch {
    return defaultState;
  }
};

const saveState = (state: PersistedState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const App = () => {
  const initial = loadState();
  const [projects, setProjects] = useState(initial.projects);
  const [tasks, setTasks] = useState<TaskItem[]>(initial.tasks.map(sanitizeTask));
  const [activeProjectId, setActiveProjectId] = useState(initial.activeProjectId || initial.projects[0]?.id || "");

  const [isTaskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [isProjectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState<"create" | "edit">("create");
  const [editingTaskId, setEditingTaskId] = useState<string>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());

  const [viewMode, setViewMode] = useState<ViewModeOption>("\u5468");
  const [sortBy, setSortBy] = useState<SortBy>("\u9ed8\u8ba4");
  const [searchText, setSearchText] = useState("");
  const [zoom, setZoom] = useState(70);
  const [filters, setFilters] = useState<TaskFilters>({
    owner: "\u5168\u90e8",
    status: "\u5168\u90e8",
    priority: "\u5168\u90e8"
  });

  const activeProjectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === activeProjectId).sort((a, b) => a.order - b.order),
    [tasks, activeProjectId]
  );
  const owners = useMemo(() => uniqueValues(activeProjectTasks, "owner"), [activeProjectTasks]);

  const visibleTasks = useMemo(
    () => getVisibleTasks(tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy),
    [tasks, activeProjectId, collapsedTaskIds, searchText, filters, sortBy]
  );
  const editingTask = useMemo(() => tasks.find((task) => task.id === editingTaskId), [tasks, editingTaskId]);

  const syncState = (nextProjects: PersistedState["projects"], nextTasks: PersistedState["tasks"], nextActiveProjectId: string) => {
    setProjects(nextProjects);
    setTasks(nextTasks);
    setActiveProjectId(nextActiveProjectId);
    saveState({
      projects: nextProjects,
      tasks: nextTasks,
      activeProjectId: nextActiveProjectId
    });
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
    setEditingTaskId(undefined);
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

  const handleToggleCollapse = (taskId: string) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleDragOrderChange = (activeId: string, overId: string) => {
    const nextTasks = reorderTasks(tasks, activeProjectId, activeId, overId);
    syncState(projects, nextTasks, activeProjectId);
  };

  const openCreateTaskDrawer = () => {
    setTaskFormMode("create");
    setEditingTaskId(undefined);
    setTaskDrawerOpen(true);
  };

  const openEditTaskDrawer = (taskId: string) => {
    setTaskFormMode("edit");
    setEditingTaskId(taskId);
    setTaskDrawerOpen(true);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-title-group">
            <h1>{"CCSA\u9879\u76ee\u7ba1\u7406"}</h1>
            <p>{"\u7b80\u6d01\u3001\u7a33\u5b9a\u3001\u53ef\u7ef4\u62a4\u7684\u7518\u7279\u56fe\u9879\u76ee\u534f\u540c\u9762\u677f"}</p>
          </div>
          <div className="header-actions">
            <select value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={() => setProjectDialogOpen(true)}>
              {"\u65b0\u589e\u9879\u76ee"}
            </button>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <Toolbar
          searchText={searchText}
          onSearchTextChange={setSearchText}
          filters={filters}
          owners={owners}
          onFiltersChange={setFilters}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          zoom={zoom}
          onZoomChange={setZoom}
          onAddTask={openCreateTaskDrawer}
        />

        <main className="main-layout">
          <section className="left-panel panel-card">
            <TaskTable
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onEditTask={openEditTaskDrawer}
              onDeleteTask={handleTaskDelete}
              onToggleCollapse={handleToggleCollapse}
              onChangeProgress={handleTaskProgressChange}
              collapsedTaskIds={collapsedTaskIds}
              onDragOrderChange={handleDragOrderChange}
            />
          </section>
          <section className="right-panel panel-card">
            <GanttBoard
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              viewMode={viewMode}
              columnWidth={zoom}
              onSelectTask={setSelectedTaskId}
              onDateChange={handleTaskDateChange}
              onProgressChange={handleTaskProgressChange}
            />
          </section>
        </main>
      </div>

      <TaskFormDrawer
        open={isTaskDrawerOpen}
        mode={taskFormMode}
        projects={projects}
        tasks={tasks}
        activeProjectId={activeProjectId}
        initialTask={editingTask}
        onClose={() => setTaskDrawerOpen(false)}
        onSubmit={handleTaskSubmit}
      />
      <ProjectDialog open={isProjectDialogOpen} onClose={() => setProjectDialogOpen(false)} onSubmit={handleProjectCreate} />
    </div>
  );
};
