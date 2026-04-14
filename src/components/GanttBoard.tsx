import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import { TaskItem, ViewModeOption, VisibleTask } from "../types";
import { toDate, toISODate } from "../utils/date";

interface GanttBoardProps {
  tasks: VisibleTask[];
  selectedTaskId?: string;
  viewMode: ViewModeOption;
  columnWidth: number;
  onSelectTask: (taskId: string) => void;
  onDateChange: (taskId: string, startDate: string, endDate: string) => void;
  onProgressChange: (taskId: string, progress: number) => void;
}

const statusColor = (status: TaskItem["status"]) => {
  switch (status) {
    case "\u5df2\u5b8c\u6210":
      return "#1aae39";
    case "\u5ef6\u671f":
      return "#dd5b00";
    case "\u8fdb\u884c\u4e2d":
      return "#0075de";
    default:
      return "#a39e98";
  }
};

const getViewMode = (viewMode: ViewModeOption): ViewMode => {
  if (viewMode === "\u5468") return ViewMode.Week;
  if (viewMode === "\u6708") return ViewMode.Month;
  return ViewMode.Day;
};

export const GanttBoard = ({
  tasks,
  selectedTaskId,
  viewMode,
  columnWidth,
  onSelectTask,
  onDateChange,
  onProgressChange
}: GanttBoardProps) => {
  const ganttTasks: GanttTask[] = tasks.map((item, index) => {
    const color = statusColor(item.task.status);
    const hasChild = tasks.some((row) => row.task.parentId === item.task.id);
    return {
      id: item.task.id,
      name: item.task.name,
      start: toDate(item.task.startDate),
      end: toDate(item.task.endDate),
      progress: item.task.progress,
      type: item.task.isMilestone ? "milestone" : hasChild ? "project" : "task",
      project: item.task.parentId,
      dependencies: item.task.dependencyIds,
      displayOrder: index,
      styles: {
        backgroundColor: color,
        backgroundSelectedColor: "#005bab",
        progressColor: "#62aef0",
        progressSelectedColor: "#f2f9ff"
      }
    };
  });

  return (
    <div className="gantt-wrapper notion-gantt-theme">
      {ganttTasks.length === 0 ? (
        <div className="gantt-empty">{"\u6682\u65e0\u53ef\u5c55\u793a\u4efb\u52a1\uff0c\u8bf7\u5148\u521b\u5efa\u4efb\u52a1\u6216\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u3002"}</div>
      ) : (
        <Gantt
          tasks={ganttTasks}
          viewMode={getViewMode(viewMode)}
          locale="zh-CN"
          listCellWidth="0px"
          columnWidth={columnWidth}
          todayColor="#f2f9ff"
          selectedTaskId={selectedTaskId}
          onSelect={(task) => onSelectTask(String(task.id))}
          onDateChange={(task) => {
            onDateChange(String(task.id), toISODate(task.start), toISODate(task.end));
            return true;
          }}
          onProgressChange={(task) => {
            onProgressChange(String(task.id), task.progress);
            return true;
          }}
        />
      )}
    </div>
  );
};
