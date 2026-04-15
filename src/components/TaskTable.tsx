import { Fragment, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getStatusLabel } from "../i18n";
import { Language, TaskItem, VisibleTask } from "../types";

interface TaskTableProps {
  language: Language;
  t: (
    key:
      | "category"
      | "taskName"
      | "owner"
      | "status"
      | "start"
      | "end"
      | "duration"
      | "progress"
      | "dependencies"
      | "actions"
      | "noTasks"
      | "quickDelete"
      | "insertRow"
      | "insertRoot"
      | "daySuffix"
  ) => string;
  tasks: VisibleTask[];
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onInsertRoot: (category?: string) => void;
  onRenameCategory: (currentCategory: string, nextCategory: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onChangeProgress: (taskId: string, progress: number) => void;
  onQuickUpdate: (taskId: string, patch: Partial<TaskItem>) => void;
  collapsedTaskIds: Set<string>;
  onDragOrderChange: (activeId: string, overId: string) => void;
  onScrollElementReady?: (element: HTMLDivElement | null) => void;
}

interface TaskRowProps {
  language: Language;
  t: TaskTableProps["t"];
  row: VisibleTask;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onChangeProgress: (taskId: string, progress: number) => void;
  onQuickUpdate: (taskId: string, patch: Partial<TaskItem>) => void;
  collapsedTaskIds: Set<string>;
}

interface CategoryGroup {
  category: string;
  rows: VisibleTask[];
}

const TaskDataRow = ({
  language,
  t,
  row,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
  onToggleCollapse,
  onChangeProgress,
  onQuickUpdate,
  collapsedTaskIds
}: TaskRowProps) => {
  const statusClassMap: Record<string, string> = {
    not_started: "status-not-started",
    in_progress: "status-in-progress",
    completed: "status-completed",
    delayed: "status-delayed"
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  const indent = row.depth * 12;
  const isSelected = selectedTaskId === row.task.id;

  return (
    <tr ref={setNodeRef} style={style} className={isSelected ? "selected-row" : undefined} onClick={() => onSelectTask(row.task.id)} title={row.task.notes}>
      <td>
        <div className="row-leading-actions">
          <button className="drag-handle" {...attributes} {...listeners} title={language === "zh" ? "\u62d6\u62fd\u6392\u5e8f" : "Drag to reorder"}>
            ::
          </button>
        </div>
      </td>
      <td>
        <div className="task-name-cell" style={{ paddingLeft: `${indent}px` }}>
          {row.hasChildren ? (
            <button
              type="button"
              className="icon-btn category-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse(row.task.id);
              }}
              title={language === "zh" ? "\u6298\u53e0/\u5c55\u5f00" : "Expand / Collapse"}
            >
              {collapsedTaskIds.has(row.task.id) ? ">" : "v"}
            </button>
          ) : (
            <span className="placeholder-indent" />
          )}
          <input className="inline-text" value={row.task.name} onClick={(event) => event.stopPropagation()} onChange={(event) => onQuickUpdate(row.task.id, { name: event.target.value })} />
        </div>
      </td>
      <td>
        <input className="inline-text" value={row.task.owner} onClick={(event) => event.stopPropagation()} onChange={(event) => onQuickUpdate(row.task.id, { owner: event.target.value })} />
      </td>
      <td className={`status-cell ${statusClassMap[row.task.status] ?? ""}`}>
        <select
          className="inline-select"
          value={row.task.status}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onQuickUpdate(row.task.id, { status: event.target.value as TaskItem["status"] })}
        >
          <option value="not_started">{getStatusLabel(language, "not_started")}</option>
          <option value="in_progress">{getStatusLabel(language, "in_progress")}</option>
          <option value="completed">{getStatusLabel(language, "completed")}</option>
          <option value="delayed">{getStatusLabel(language, "delayed")}</option>
        </select>
      </td>
      <td>
        <input type="date" className="inline-date" value={row.task.startDate} onClick={(event) => event.stopPropagation()} onChange={(event) => onQuickUpdate(row.task.id, { startDate: event.target.value })} />
      </td>
      <td>
        <input type="date" className="inline-date" value={row.task.endDate} onClick={(event) => event.stopPropagation()} onChange={(event) => onQuickUpdate(row.task.id, { endDate: event.target.value })} />
      </td>
      <td>{`${row.task.duration}${t("daySuffix")}`}</td>
      <td>
        <div className="progress-inline">
          <input
            type="range"
            min={0}
            max={100}
            value={row.task.progress}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onChangeProgress(row.task.id, Number(event.target.value))}
          />
          <span>{`${row.task.progress}%`}</span>
        </div>
      </td>
      <td>{row.task.dependencyIds.length > 0 ? row.task.dependencyIds.join(", ") : "-"}</td>
      <td className="row-delete-cell">
        <button
          className="cell-delete-btn"
          title={t("quickDelete")}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteTask(row.task.id);
          }}
        >
          x
        </button>
      </td>
    </tr>
  );
};

export const TaskTable = ({
  language,
  t,
  tasks,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
  onInsertRoot,
  onRenameCategory,
  onToggleCollapse,
  onChangeProgress,
  onQuickUpdate,
  collapsedTaskIds,
  onDragOrderChange,
  onScrollElementReady
}: TaskTableProps) => {
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});

  const grouped = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, VisibleTask[]>();
    for (const row of tasks) {
      const key = row.task.category || (language === "zh" ? "\u672a\u5206\u7c7b" : "Uncategorized");
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([category, rows]) => ({ category, rows }));
  }, [tasks, language]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onDragOrderChange(String(active.id), String(over.id));
  };

  const taskIds = tasks.map((item) => item.task.id);

  const commitCategoryRename = (currentCategory: string, inputValue: string) => {
    const nextCategory = inputValue.trim();
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      delete next[currentCategory];
      return next;
    });
    if (!nextCategory || nextCategory === currentCategory) return;
    onRenameCategory(currentCategory, nextCategory);
  };

  return (
    <div className="task-table-wrapper" ref={onScrollElementReady ?? undefined}>
      <table className="task-table excel-like-table grouped-table">
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 300 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 142 }} />
          <col style={{ width: 142 }} />
          <col style={{ width: 76 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 64 }} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <button className="cell-mini-btn" onClick={() => onInsertRoot()} title={t("insertRoot")}>
                +
              </button>
            </th>
            <th>{t("taskName")}</th>
            <th>{t("owner")}</th>
            <th>{t("status")}</th>
            <th>{t("start")}</th>
            <th>{t("end")}</th>
            <th>{t("duration")}</th>
            <th>{t("progress")}</th>
            <th>{t("dependencies")}</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {grouped.map((group) => {
                return (
                  <Fragment key={`group-${group.category}`}>
                    <tr className="category-row">
                      <td colSpan={10}>
                        <div className="category-row-content">
                          <button className="cell-mini-btn" onClick={() => onInsertRoot(group.category)} title={t("insertRow")}>
                            +
                          </button>
                          <input
                            className="category-title-input"
                            value={categoryDrafts[group.category] ?? group.category}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setCategoryDrafts((prev) => ({
                                ...prev,
                                [group.category]: event.target.value
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitCategoryRename(group.category, (event.target as HTMLInputElement).value);
                                (event.target as HTMLInputElement).blur();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setCategoryDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[group.category];
                                  return next;
                                });
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={(event) => commitCategoryRename(group.category, event.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <TaskDataRow
                        key={row.task.id}
                        language={language}
                        t={t}
                        row={row}
                        selectedTaskId={selectedTaskId}
                        onSelectTask={onSelectTask}
                        onDeleteTask={onDeleteTask}
                        onToggleCollapse={onToggleCollapse}
                        onChangeProgress={onChangeProgress}
                        onQuickUpdate={onQuickUpdate}
                        collapsedTaskIds={collapsedTaskIds}
                      />
                    ))}
                  </Fragment>
                );
              })}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-cell">
                    {t("noTasks")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SortableContext>
        </DndContext>
      </table>
    </div>
  );
};
