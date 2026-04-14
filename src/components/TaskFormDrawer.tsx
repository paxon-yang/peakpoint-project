import { FormEvent, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ProjectItem, TaskItem, TaskPriority, TaskStatus } from "../types";
import { calcDuration, normalizeDates } from "../utils/date";

interface TaskFormDrawerProps {
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
  name: string;
  startDate: string;
  endDate: string;
  owner: string;
  progress: number;
  priority: TaskPriority;
  status: TaskStatus;
  dependencyIds: string[];
  notes: string;
  isMilestone: boolean;
}

const statusOptions: TaskStatus[] = ["\u672a\u5f00\u59cb", "\u8fdb\u884c\u4e2d", "\u5df2\u5b8c\u6210", "\u5ef6\u671f"];
const priorityOptions: TaskPriority[] = ["\u9ad8", "\u4e2d", "\u4f4e"];

const toFormState = (task: TaskItem | undefined, defaultProjectId: string): TaskFormState => ({
  projectId: task?.projectId ?? defaultProjectId,
  parentId: task?.parentId ?? "",
  name: task?.name ?? "",
  startDate: task?.startDate ?? new Date().toISOString().slice(0, 10),
  endDate: task?.endDate ?? new Date().toISOString().slice(0, 10),
  owner: task?.owner ?? "",
  progress: task?.progress ?? 0,
  priority: task?.priority ?? "\u4e2d",
  status: task?.status ?? "\u672a\u5f00\u59cb",
  dependencyIds: task?.dependencyIds ?? [],
  notes: task?.notes ?? "",
  isMilestone: task?.isMilestone ?? false
});

export const TaskFormDrawer = ({
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
      setError("\u4efb\u52a1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002");
      return;
    }
    if (!formState.owner.trim()) {
      setError("\u8d1f\u8d23\u4eba\u4e0d\u80fd\u4e3a\u7a7a\u3002");
      return;
    }

    const normalized = normalizeDates(formState.startDate, formState.endDate);
    const progress = Number(formState.progress);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      setError("\u8fdb\u5ea6\u5fc5\u987b\u662f 0-100 \u4e4b\u95f4\u7684\u6570\u5b57\u3002");
      return;
    }
    if (formState.parentId && formState.parentId === initialTask?.id) {
      setError("\u7236\u4efb\u52a1\u4e0d\u80fd\u9009\u62e9\u5f53\u524d\u4efb\u52a1\u3002");
      return;
    }

    const nextTask: TaskItem = {
      id: initialTask?.id ?? `task-${uuidv4()}`,
      projectId: formState.projectId,
      parentId: formState.parentId || undefined,
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
        <h3>{mode === "create" ? "\u65b0\u589e\u4efb\u52a1" : "\u7f16\u8f91\u4efb\u52a1"}</h3>
        <form onSubmit={handleSubmit} className="drawer-form">
          <label>
            {"\u9879\u76ee"}
            <select value={formState.projectId} onChange={(event) => setField("projectId", event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {"\u7236\u4efb\u52a1"}
            <select value={formState.parentId} onChange={(event) => setField("parentId", event.target.value)}>
              <option value="">{"\u65e0"}</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {"\u4efb\u52a1\u540d\u79f0"}
            <input value={formState.name} onChange={(event) => setField("name", event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              {"\u5f00\u59cb\u65e5\u671f"}
              <input type="date" value={formState.startDate} onChange={(event) => setField("startDate", event.target.value)} />
            </label>
            <label>
              {"\u7ed3\u675f\u65e5\u671f"}
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
            {"\u8bbe\u4e3a\u91cc\u7a0b\u7891"}
          </label>
          <div className="form-row">
            <label>
              {"\u8d1f\u8d23\u4eba"}
              <input value={formState.owner} onChange={(event) => setField("owner", event.target.value)} />
            </label>
            <label>
              {"\u8fdb\u5ea6 %"}
              <input
                type="number"
                min={0}
                max={100}
                value={formState.progress}
                onChange={(event) => setField("progress", Number(event.target.value))}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {"\u4f18\u5148\u7ea7"}
              <select value={formState.priority} onChange={(event) => setField("priority", event.target.value as TaskPriority)}>
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {"\u72b6\u6001"}
              <select value={formState.status} onChange={(event) => setField("status", event.target.value as TaskStatus)}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {"\u524d\u7f6e\u4efb\u52a1\uff08\u53ef\u591a\u9009\uff09"}
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
            {"\u5907\u6ce8"}
            <textarea rows={3} value={formState.notes} onChange={(event) => setField("notes", event.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {"\u53d6\u6d88"}
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === "create" ? "\u4fdd\u5b58\u4efb\u52a1" : "\u66f4\u65b0\u4efb\u52a1"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
