import { Language, SortBy, TaskPriority, TaskStatus, ViewModeOption } from "./types";

export const STATUS_OPTIONS: TaskStatus[] = ["not_started", "in_progress", "completed", "delayed"];
export const PRIORITY_OPTIONS: TaskPriority[] = ["high", "medium", "low"];
export const VIEW_MODE_OPTIONS: ViewModeOption[] = ["day", "week", "month"];
export const SORT_OPTIONS: SortBy[] = ["default", "name", "startDate", "endDate", "progress", "priority"];

const statusLabels: Record<TaskStatus, { zh: string; en: string }> = {
  not_started: { zh: "\u672a\u5f00\u59cb", en: "Not Started" },
  in_progress: { zh: "\u8fdb\u884c\u4e2d", en: "In Progress" },
  completed: { zh: "\u5df2\u5b8c\u6210", en: "Completed" },
  delayed: { zh: "\u5ef6\u671f", en: "Delayed" }
};

const priorityLabels: Record<TaskPriority, { zh: string; en: string }> = {
  high: { zh: "\u9ad8", en: "High" },
  medium: { zh: "\u4e2d", en: "Medium" },
  low: { zh: "\u4f4e", en: "Low" }
};

const viewModeLabels: Record<ViewModeOption, { zh: string; en: string }> = {
  day: { zh: "\u65e5\u89c6\u56fe", en: "Day View" },
  week: { zh: "\u5468\u89c6\u56fe", en: "Week View" },
  month: { zh: "\u6708\u89c6\u56fe", en: "Month View" }
};

const sortLabels: Record<SortBy, { zh: string; en: string }> = {
  default: { zh: "\u9ed8\u8ba4", en: "Default" },
  name: { zh: "\u540d\u79f0", en: "Name" },
  startDate: { zh: "\u5f00\u59cb\u65e5\u671f", en: "Start Date" },
  endDate: { zh: "\u7ed3\u675f\u65e5\u671f", en: "End Date" },
  progress: { zh: "\u8fdb\u5ea6", en: "Progress" },
  priority: { zh: "\u4f18\u5148\u7ea7", en: "Priority" }
};

const texts = {
  appTitle: { zh: "CCSA\u9879\u76ee\u7ba1\u7406", en: "CCSA Project Management" },
  appSubtitle: {
    zh: "\u7b80\u6d01\u3001\u7a33\u5b9a\u3001\u53ef\u7ef4\u62a4\u7684\u7518\u7279\u56fe\u9879\u76ee\u534f\u540c\u9762\u677f",
    en: "Simple, clean, and stable Gantt project workspace"
  },
  language: { zh: "\u8bed\u8a00", en: "Language" },
  saveChanges: { zh: "\u4fdd\u5b58", en: "Save" },
  saved: { zh: "\u5df2\u4fdd\u5b58", en: "Saved" },
  addProject: { zh: "\u65b0\u589e\u9879\u76ee", en: "New Project" },
  addTask: { zh: "\u65b0\u589e\u4efb\u52a1", en: "New Task" },
  searchPlaceholder: { zh: "\u641c\u7d22\u4efb\u52a1\u540d\u79f0/\u8d1f\u8d23\u4eba/\u5907\u6ce8", en: "Search task / owner / notes" },
  allOwners: { zh: "\u5168\u90e8\u8d1f\u8d23\u4eba", en: "All Owners" },
  allStatuses: { zh: "\u5168\u90e8\u72b6\u6001", en: "All Statuses" },
  allPriorities: { zh: "\u5168\u90e8\u4f18\u5148\u7ea7", en: "All Priorities" },
  sortPrefix: { zh: "\u6392\u5e8f", en: "Sort" },
  zoom: { zh: "\u7f29\u653e", en: "Zoom" },
  taskName: { zh: "\u4efb\u52a1\u540d\u79f0", en: "Task Name" },
  category: { zh: "\u5206\u7c7b", en: "Category" },
  owner: { zh: "\u8d1f\u8d23\u4eba", en: "Owner" },
  status: { zh: "\u72b6\u6001", en: "Status" },
  start: { zh: "\u5f00\u59cb", en: "Start" },
  end: { zh: "\u7ed3\u675f", en: "End" },
  duration: { zh: "\u5de5\u671f", en: "Duration" },
  progress: { zh: "\u8fdb\u5ea6", en: "Progress" },
  dependencies: { zh: "\u4f9d\u8d56", en: "Dependencies" },
  actions: { zh: "\u64cd\u4f5c", en: "Actions" },
  noTasks: { zh: "\u6682\u65e0\u4efb\u52a1\uff0c\u8bf7\u65b0\u589e\u4efb\u52a1\u3002", en: "No tasks yet. Add a task to start." },
  quickDelete: { zh: "\u5220\u9664", en: "Delete" },
  insertRow: { zh: "\u63d2\u5165", en: "Insert" },
  insertRoot: { zh: "\u65b0\u589e\u5206\u7c7b", en: "Add Category" },
  collapseAll: { zh: "\u5206\u7c7b\u5408\u5e76", en: "Collapse Categories" },
  expandAll: { zh: "\u5168\u5c55\u793a", en: "Expand All" },
  openAdvancedEdit: { zh: "\u53cc\u51fb\u6253\u5f00\u8be6\u7ec6\u7f16\u8f91", en: "Double-click for full edit" },
  ganttEmpty: {
    zh: "\u6682\u65e0\u53ef\u5c55\u793a\u4efb\u52a1\uff0c\u8bf7\u5148\u521b\u5efa\u4efb\u52a1\u6216\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u3002",
    en: "No task to display. Create tasks or adjust filters."
  },
  project: { zh: "\u9879\u76ee", en: "Project" },
  parentTask: { zh: "\u7236\u4efb\u52a1", en: "Parent Task" },
  none: { zh: "\u65e0", en: "None" },
  milestone: { zh: "\u8bbe\u4e3a\u91cc\u7a0b\u7891", en: "Milestone" },
  priority: { zh: "\u4f18\u5148\u7ea7", en: "Priority" },
  notes: { zh: "\u5907\u6ce8", en: "Notes" },
  cancel: { zh: "\u53d6\u6d88", en: "Cancel" },
  saveTask: { zh: "\u4fdd\u5b58\u4efb\u52a1", en: "Save Task" },
  updateTask: { zh: "\u66f4\u65b0\u4efb\u52a1", en: "Update Task" },
  createTask: { zh: "\u65b0\u589e\u4efb\u52a1", en: "Create Task" },
  editTask: { zh: "\u7f16\u8f91\u4efb\u52a1", en: "Edit Task" },
  createProject: { zh: "\u521b\u5efa\u9879\u76ee", en: "Create Project" },
  projectName: { zh: "\u9879\u76ee\u540d\u79f0", en: "Project Name" },
  projectDesc: { zh: "\u9879\u76ee\u63cf\u8ff0", en: "Project Description" },
  taskNameRequired: { zh: "\u4efb\u52a1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002", en: "Task name is required." },
  ownerRequired: { zh: "\u8d1f\u8d23\u4eba\u4e0d\u80fd\u4e3a\u7a7a\u3002", en: "Owner is required." },
  progressInvalid: { zh: "\u8fdb\u5ea6\u5fc5\u987b\u662f 0-100 \u4e4b\u95f4\u7684\u6570\u5b57\u3002", en: "Progress must be between 0 and 100." },
  parentInvalid: { zh: "\u7236\u4efb\u52a1\u4e0d\u80fd\u9009\u62e9\u5f53\u524d\u4efb\u52a1\u3002", en: "Parent task cannot be current task." },
  projectNameRequired: { zh: "\u9879\u76ee\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002", en: "Project name is required." },
  daySuffix: { zh: "\u5929", en: "d" }
} as const;

export type TranslationKey = keyof typeof texts;

export const createTranslator = (language: Language) => (key: TranslationKey): string => texts[key][language];

export const getStatusLabel = (language: Language, status: TaskStatus): string => statusLabels[status][language];
export const getPriorityLabel = (language: Language, priority: TaskPriority): string => priorityLabels[priority][language];
export const getViewModeLabel = (language: Language, mode: ViewModeOption): string => viewModeLabels[mode][language];
export const getSortLabel = (language: Language, sort: SortBy): string => sortLabels[sort][language];
