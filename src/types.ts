export type Language = "zh" | "en";

export type TaskStatus = "not_started" | "in_progress" | "completed" | "delayed";
export type TaskPriority = "high" | "medium" | "low";
export type ProjectRole = "admin" | "editor" | "viewer";
export type ViewModeOption = "day" | "week" | "month";
export type SortBy = "default" | "name" | "startDate" | "endDate" | "progress" | "priority";

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  timelineStartDate?: string;
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

export interface ProjectPermissionItem {
  projectId: string;
  email: string;
  role: ProjectRole;
  updatedAt: string;
  updatedBy?: string;
}

export type TaskAuditField = "name" | "startDate" | "endDate" | "status";

export interface TaskAuditLogItem {
  id: string;
  projectId: string;
  taskId: string;
  taskName: string;
  field: TaskAuditField;
  before: string;
  after: string;
  changedBy: string;
  changedAt: string;
}

export interface PersistedState {
  projects: ProjectItem[];
  tasks: TaskItem[];
  activeProjectId: string;
  projectPermissions?: ProjectPermissionItem[];
  auditLogs?: TaskAuditLogItem[];
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
