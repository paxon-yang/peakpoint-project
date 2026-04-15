export type Language = "zh" | "en";

export type TaskStatus = "not_started" | "in_progress" | "completed" | "delayed";
export type TaskPriority = "high" | "medium" | "low";
export type ViewModeOption = "day" | "week" | "month";
export type SortBy = "default" | "name" | "startDate" | "endDate" | "progress" | "priority";

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  parentId?: string;
  isCategoryPlaceholder?: boolean;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  owner: string;
  progress: number;
  priority: TaskPriority;
  status: TaskStatus;
  dependencyIds: string[];
  notes: string;
  isMilestone: boolean;
  order: number;
}

export interface PersistedState {
  projects: ProjectItem[];
  tasks: TaskItem[];
  activeProjectId: string;
}

export interface TaskFilters {
  owner: string;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
}

export interface VisibleTask {
  task: TaskItem;
  depth: number;
  hasChildren: boolean;
}
