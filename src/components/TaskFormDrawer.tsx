import { FormEvent, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { getPriorityLabel, getStatusLabel } from "../i18n";
import { Language, ProjectItem, TaskItem } from "../types";
import { calcDuration, normalizeDates } from "../utils/date";

interface TaskFormDrawerProps {
  language: Language;
  t: (
    key:
      | "createTask"
      | "editTask"
      | "project"
      | "category"
      | "parentTask"
      | "none"
      | "taskName"
      | "start"
      | "end"
      | "milestone"
      | "owner"
      | "progress"
      | "priority"
      | "status"
      | "dependencies"
      | "notes"
      | "cancel"
      | "saveTask"
      | "updateTask"
      | "taskNameRequired"
      | "ownerRequired"
      | "progressInvalid"
      | "parentInvalid"
  ) => string;
  open: boolean;
  mode: "create" | "edit";
  projects: ProjectItem[];
  tasks: TaskItem[];
  activeProjectId: string;
  initialTask?: TaskItem;
  onClose: () => void;
  onSubmit: (task: TaskItem) => void;
}

interface TaskFormState {
  projectId: string;
  parentId: string;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
  owner: string;
  progress: number;
  priority: TaskItem["priority"];
  status: TaskItem["status"];
  dependencyIds: string[];
  notes: string;
  isMilestone: boolean;
}

const toFormState = (task: TaskItem | undefined, defaultProjectId: string): TaskFormState => ({
  projectId: task?.projectId ?? defaultProjectId,
  parentId: task?.parentId ?? "",
  category: task?.category ?? "",
  name: task?.name ?? "",
  startDate: task?.startDate ?? new Date().toISOString().slice(0, 10),
  endDate: task?.endDate ?? new Date().toISOString().slice(0, 10),
  owner: task?.owner ?? "",
  progress: task?.progress ?? 0,
  priority: task?.priority ?? "medium",
  status: task?.status ?? "not_started",
  dependencyIds: task?.dependencyIds ?? [],
  notes: task?.notes ?? "",
  isMilestone: task?.isMilestone ?? false
});

export const TaskFormDrawer = ({
  language,
  t,
  open,
  mode,
  projects,
  tasks,
  activeProjectId,
  initialTask,
  onClose,
  onSubmit
}: TaskFormDrawerProps) => {
  const [formState, setFormState] = useState<TaskFormState>(toFormState(initialTask, activeProjectId));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setFormState(toFormState(initialTask, activeProjectId));
      setError("");
    }
  }, [open, initialTask, activeProjectId]);

  const availableTasks = useMemo(
    () =>
      tasks.filter((task) => task.projectId === formState.projectId && task.id !== initialTask?.id).sort((a, b) => a.order - b.order),
    [tasks, formState.projectId, initialTask?.id]
  );

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      setError(t("taskNameRequired"));
      return;
    }
    if (!formState.owner.trim()) {
      setError(t("ownerRequired"));
      return;
    }
    const progress = Number(formState.progress);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      setError(t("progressInvalid"));
      return;
    }
    if (formState.parentId && formState.parentId === initialTask?.id) {
      setError(t("parentInvalid"));
      return;
    }

    const normalized = normalizeDates(formState.startDate, formState.endDate);
    const nextTask: TaskItem = {
      id: initialTask?.id ?? `task-${uuidv4()}`,
      projectId: formState.projectId,
      parentId: formState.parentId || undefined,
      category: formState.category.trim() || (language === "zh" ? "\u672a\u5206\u7c7b" : "Uncategorized"),
      name: formState.name.trim(),
      startDate: normalized.startDate,
      endDate: formState.isMilestone ? normalized.startDate : normalized.endDate,
      duration: formState.isMilestone ? 1 : calcDuration(normalized.startDate, normalized.endDate),
      owner: formState.owner.trim(),
      progress: progress,
      priority: formState.priority,
      status: formState.status,
      dependencyIds: formState.dependencyIds,
      notes: formState.notes.trim(),
      isMilestone: formState.isMilestone,
      order: initialTask?.order ?? (tasks.filter((task) => task.projectId === formState.projectId).length + 1) * 10
    };
    onSubmit(nextTask);
  };

  const setField = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === "create" ? t("createTask") : t("editTask")}</h3>
        <form onSubmit={handleSubmit} className="drawer-form">
          <label>
            {t("project")}
            <select value={formState.projectId} onChange={(event) => setField("projectId", event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("parentTask")}
            <select value={formState.parentId} onChange={(event) => setField("parentId", event.target.value)}>
              <option value="">{t("none")}</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("category")}
            <input value={formState.category} onChange={(event) => setField("category", event.target.value)} />
          </label>
          <label>
            {t("taskName")}
            <input value={formState.name} onChange={(event) => setField("name", event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              {t("start")}
              <input type="date" value={formState.startDate} onChange={(event) => setField("startDate", event.target.value)} />
            </label>
            <label>
              {t("end")}
              <input
                type="date"
                value={formState.isMilestone ? formState.startDate : formState.endDate}
                disabled={formState.isMilestone}
                onChange={(event) => setField("endDate", event.target.value)}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={formState.isMilestone} onChange={(event) => setField("isMilestone", event.target.checked)} />
            {t("milestone")}
          </label>
          <div className="form-row">
            <label>
              {t("owner")}
              <input value={formState.owner} onChange={(event) => setField("owner", event.target.value)} />
            </label>
            <label>
              {t("progress")}
              <input type="number" min={0} max={100} value={formState.progress} onChange={(event) => setField("progress", Number(event.target.value))} />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t("priority")}
              <select value={formState.priority} onChange={(event) => setField("priority", event.target.value as TaskItem["priority"])}>
                <option value="high">{getPriorityLabel(language, "high")}</option>
                <option value="medium">{getPriorityLabel(language, "medium")}</option>
                <option value="low">{getPriorityLabel(language, "low")}</option>
              </select>
            </label>
            <label>
              {t("status")}
              <select value={formState.status} onChange={(event) => setField("status", event.target.value as TaskItem["status"])}>
                <option value="not_started">{getStatusLabel(language, "not_started")}</option>
                <option value="in_progress">{getStatusLabel(language, "in_progress")}</option>
                <option value="completed">{getStatusLabel(language, "completed")}</option>
                <option value="delayed">{getStatusLabel(language, "delayed")}</option>
              </select>
            </label>
          </div>
          <label>
            {t("dependencies")}
            <select
              multiple
              value={formState.dependencyIds}
              onChange={(event) =>
                setField(
                  "dependencyIds",
                  Array.from(event.target.selectedOptions).map((option) => option.value)
                )
              }
            >
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("notes")}
            <textarea rows={3} value={formState.notes} onChange={(event) => setField("notes", event.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t("cancel")}
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === "create" ? t("saveTask") : t("updateTask")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
