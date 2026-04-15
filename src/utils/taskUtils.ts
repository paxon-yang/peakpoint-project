import { arrayMove } from "@dnd-kit/sortable";
import { SortBy, TaskFilters, TaskItem, VisibleTask } from "../types";
import { calcDuration, toDate } from "./date";

const priorityWeight: Record<string, number> = { high: 1, medium: 2, low: 3 };

const sortSiblings = (tasks: TaskItem[], sortBy: SortBy): TaskItem[] => {
  const copy = [...tasks];
  if (sortBy === "default") {
    return copy.sort((a, b) => a.order - b.order);
  }
  return copy.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name, "zh-CN");
      case "startDate":
        return toDate(a.startDate).getTime() - toDate(b.startDate).getTime();
      case "endDate":
        return toDate(a.endDate).getTime() - toDate(b.endDate).getTime();
      case "progress":
        return b.progress - a.progress;
      case "priority":
        return (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9);
      default:
        return a.order - b.order;
    }
  });
};

const taskMatches = (task: TaskItem, search: string, filters: TaskFilters): boolean => {
  const matchedSearch =
    search.trim().length === 0 ||
    [task.name, task.owner, task.notes].join(" ").toLowerCase().includes(search.toLowerCase());
  const matchedOwner = filters.owner === "all" || task.owner === filters.owner;
  const matchedStatus = filters.status === "all" || task.status === filters.status;
  const matchedPriority = filters.priority === "all" || task.priority === filters.priority;
  return matchedSearch && matchedOwner && matchedStatus && matchedPriority;
};

export const getChildrenMap = (tasks: TaskItem[], projectId: string): Map<string | undefined, TaskItem[]> => {
  const map = new Map<string | undefined, TaskItem[]>();
  tasks
    .filter((task) => task.projectId === projectId)
    .forEach((task) => {
      const key = task.parentId;
      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    });
  return map;
};

export const getDescendantIds = (tasks: TaskItem[], parentId: string): string[] => {
  const children = tasks.filter((task) => task.parentId === parentId);
  return children.flatMap((child) => [child.id, ...getDescendantIds(tasks, child.id)]);
};

export const getVisibleTasks = (
  tasks: TaskItem[],
  projectId: string,
  collapsedIds: Set<string>,
  search: string,
  filters: TaskFilters,
  sortBy: SortBy
): VisibleTask[] => {
  const map = getChildrenMap(tasks, projectId);

  const traverse = (task: TaskItem, depth: number): { matched: boolean; rows: VisibleTask[] } => {
    const children = sortSiblings(map.get(task.id) ?? [], sortBy);
    const childRows: VisibleTask[] = [];
    let childMatched = false;

    for (const child of children) {
      const childResult = traverse(child, depth + 1);
      if (childResult.matched) {
        childMatched = true;
        childRows.push(...childResult.rows);
      }
    }

    const selfMatched = taskMatches(task, search, filters);
    const matched = selfMatched || childMatched;
    if (!matched) {
      return { matched: false, rows: [] };
    }

    const current: VisibleTask = {
      task,
      depth,
      hasChildren: children.length > 0
    };

    const rows = collapsedIds.has(task.id) ? [current] : [current, ...childRows];
    return { matched: true, rows };
  };

  const roots = sortSiblings(map.get(undefined) ?? [], sortBy);
  return roots.flatMap((root) => {
    const result = traverse(root, 0);
    return result.matched ? result.rows : [];
  });
};

export const reorderTasks = (tasks: TaskItem[], projectId: string, activeId: string, overId: string): TaskItem[] => {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const otherTasks = tasks.filter((task) => task.projectId !== projectId);
  const sortedProjectTasks = [...projectTasks].sort((a, b) => a.order - b.order);
  const oldIndex = sortedProjectTasks.findIndex((task) => task.id === activeId);
  const newIndex = sortedProjectTasks.findIndex((task) => task.id === overId);
  if (oldIndex === -1 || newIndex === -1) {
    return tasks;
  }
  const moved = arrayMove(sortedProjectTasks, oldIndex, newIndex).map((task, index) => ({
    ...task,
    order: (index + 1) * 10
  }));
  return [...otherTasks, ...moved];
};

export const sanitizeTask = (task: TaskItem): TaskItem => {
  const duration = task.isMilestone ? 1 : calcDuration(task.startDate, task.endDate);
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(task.progress)));
  return {
    ...task,
    endDate: task.isMilestone ? task.startDate : task.endDate,
    duration,
    progress: normalizedProgress
  };
};

export const uniqueValues = (tasks: TaskItem[], key: "owner"): string[] =>
  [...new Set(tasks.map((task) => task[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
