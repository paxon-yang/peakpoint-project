export type TaskStatus = "未开始" | "进行中" | "已完成" | "延期";
export type TaskPriority = "高" | "中" | "低";
export type ViewModeOption = "日" | "周" | "月";
export type SortBy = "默认" | "名称" | "开始日期" | "结束日期" | "进度" | "优先级";

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  parentId?: string;
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
  status: TaskStatus | "全部";
  priority: TaskPriority | "全部";
}

export interface VisibleTask {
  task: TaskItem;
  depth: number;
  hasChildren: boolean;
}
