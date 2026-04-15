import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import { getStatusLabel } from "../i18n";
import { Language, TaskItem, ViewModeOption, VisibleTask } from "../types";
import { toDate, toISODate } from "../utils/date";

interface GanttBoardProps {
  language: Language;
  t: (
    key:
      | "ganttEmpty"
      | "taskName"
      | "owner"
      | "status"
      | "start"
      | "end"
      | "duration"
      | "progress"
      | "dependencies"
      | "actions"
      | "quickDelete"
      | "insertRow"
      | "insertRoot"
      | "daySuffix"
  ) => string;
  tasks: VisibleTask[];
  selectedTaskId?: string;
  viewMode: ViewModeOption;
  columnWidth: number;
  onSelectTask: (taskId: string) => void;
  onDateChange: (taskId: string, startDate: string, endDate: string) => void;
  onProgressChange: (taskId: string, progress: number) => void;
  onDeleteTask: (taskId: string) => void;
  onInsertRoot: (category?: string, mode?: "task" | "category", anchorTaskId?: string) => void;
  onRenameCategory: (currentCategory: string, nextCategory: string) => void;
  onReorderTask: (activeTaskId: string, overTaskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onQuickUpdate: (taskId: string, patch: Partial<TaskItem>) => void;
  collapsedTaskIds: Set<string>;
}

type LeftRow = { kind: "category"; category: string; blockKey: string; anchorTaskId?: string } | { kind: "task"; taskId: string };

const CATEGORY_ROW_PREFIX = "__category_row__:";
const LIST_GRID_TEMPLATE = "276px 140px 140px 150px 150px 72px 56px";
const LIST_GRID_MIN_WIDTH = 1120;
const LEFT_PANEL_RATIO = 0.42;
const LEFT_PANEL_MIN_WIDTH = 520;
const TITLE_ROW_HEIGHT = 48;
const DATES_ROW_HEIGHT = 24;
const HEADER_HEIGHT = TITLE_ROW_HEIGHT + DATES_ROW_HEIGHT; // 72: 行1=年月(48px) 行2=日期(24px)
const CATEGORY_BAND_HEIGHT = 36;
const TWO_DAY_STEP_MS = 2 * 24 * 60 * 60 * 1000;

const statusColor = (status: TaskItem["status"]) => {
  switch (status) {
    case "completed":
      return "#1aae39";
    case "delayed":
      return "#dd5b00";
    case "in_progress":
      return "#0075de";
    default:
      return "#a39e98";
  }
};

const getViewMode = (viewMode: ViewModeOption): ViewMode => {
  if (viewMode === "week") return ViewMode.Week;
  if (viewMode === "month") return ViewMode.Month;
  return ViewMode.Day;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isCategoryRowId = (id: string): boolean => id.startsWith(CATEGORY_ROW_PREFIX);

export const GanttBoard = ({
  language,
  t,
  tasks,
  selectedTaskId,
  viewMode,
  columnWidth,
  onSelectTask,
  onDateChange,
  onProgressChange: _onProgressChange,
  onDeleteTask,
  onInsertRoot,
  onRenameCategory,
  onReorderTask,
  onToggleCollapse,
  onQuickUpdate,
  collapsedTaskIds
}: GanttBoardProps) => {
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [listPanelWidth, setListPanelWidth] = useState<number>(680);
  const [ganttViewportHeight, setGanttViewportHeight] = useState<number>(420);
  const [leftScrollContentWidth, setLeftScrollContentWidth] = useState<number>(LIST_GRID_MIN_WIDTH);
  const [draggingTaskId, setDraggingTaskId] = useState<string>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const leftHeaderScrollRef = useRef<HTMLDivElement>(null);
  const leftTableScrollRef = useRef<HTMLDivElement>(null);
  const leftProxyScrollRef = useRef<HTMLDivElement>(null);

  const syncHorizontalScroll = (left: number) => {
    const header = leftHeaderScrollRef.current;
    const table = leftTableScrollRef.current;
    const proxy = leftProxyScrollRef.current;
    if (!header || !table || !proxy) return;
    if (header.scrollLeft !== left) header.scrollLeft = left;
    if (table.scrollLeft !== left) table.scrollLeft = left;
    if (proxy.scrollLeft !== left) proxy.scrollLeft = left;
  };

  const syncScrollFromHeader = () => {
    const header = leftHeaderScrollRef.current;
    if (!header) return;
    syncHorizontalScroll(header.scrollLeft);
  };

  const syncScrollFromTable = () => {
    const table = leftTableScrollRef.current;
    if (!table) return;
    syncHorizontalScroll(table.scrollLeft);
  };

  const syncScrollFromProxy = () => {
    const proxy = leftProxyScrollRef.current;
    if (!proxy) return;
    syncHorizontalScroll(proxy.scrollLeft);
  };

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const updateLayout = () => {
      const totalWidth = root.clientWidth;
      if (!totalWidth) return;
      const nextWidth = Math.max(LEFT_PANEL_MIN_WIDTH, Math.round(totalWidth * LEFT_PANEL_RATIO));
      setListPanelWidth((prev) => (prev === nextWidth ? prev : nextWidth));

      const totalHeight = root.clientHeight;
      if (!totalHeight) return;
      const nextGanttHeight = Math.max(260, totalHeight - HEADER_HEIGHT - 20);
      setGanttViewportHeight((prev) => (prev === nextGanttHeight ? prev : nextGanttHeight));
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const table = leftTableScrollRef.current;
    const header = leftHeaderScrollRef.current;
    if (!table) return;

    const updateWidth = () => {
      const headerWidth = header?.scrollWidth ?? 0;
      const next = Math.max(LIST_GRID_MIN_WIDTH, table.scrollWidth, headerWidth, table.clientWidth + 1);
      setLeftScrollContentWidth((prev) => (prev === next ? prev : next));
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(table);

    const mutationObserver = new MutationObserver(updateWidth);
    mutationObserver.observe(table, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [tasks.length, listPanelWidth, language, viewMode]);

  const taskMap = useMemo(() => new Map(tasks.map((row) => [row.task.id, row])), [tasks]);
  const parentTaskIdSet = useMemo(() => new Set(tasks.map((row) => row.task.parentId).filter(Boolean) as string[]), [tasks]);

  const groupedRows = useMemo(() => {
    const blocks: Array<{ category: string; rows: VisibleTask[] }> = [];
    let currentCategory = "";
    for (const row of tasks) {
      const category = row.task.category || (language === "zh" ? "\u672A\u5206\u7C7B" : "Uncategorized");
      if (blocks.length === 0 || category !== currentCategory) {
        blocks.push({ category, rows: [row] });
        currentCategory = category;
      } else {
        blocks[blocks.length - 1].rows.push(row);
      }
    }
    return blocks;
  }, [tasks, language]);

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

  const commitInlineField = (task: TaskItem, field: "name" | "owner" | "startDate" | "endDate", value: string) => {
    const current = String(task[field] ?? "");
    if (value === current) return;
    onQuickUpdate(task.id, { [field]: value } as Partial<TaskItem>);
  };

  const leftRows = useMemo<LeftRow[]>(() => {
    const rows: LeftRow[] = [];
    groupedRows.forEach(({ category, rows: categoryRows }, blockIndex) => {
      rows.push({
        kind: "category",
        category,
        blockKey: `${blockIndex}:${category}`,
        anchorTaskId: categoryRows[categoryRows.length - 1]?.task.id
      });
      categoryRows
        .filter((row) => !row.task.isCategoryPlaceholder)
        .forEach((row) => rows.push({ kind: "task", taskId: row.task.id }));
    });
    return rows;
  }, [groupedRows]);

  const ganttTasks: GanttTask[] = useMemo(() => {
    if (groupedRows.length === 0) return [];

    const startDates = tasks.map((row) => toDate(row.task.startDate));
    const endDates = tasks.map((row) => toDate(row.task.endDate));
    const anchorDate = startDates.reduce((min, current) => (current < min ? current : min), startDates[0]);
    const maxEndDate = endDates.reduce((max, current) => (current > max ? current : max), endDates[0]);
    const extensionDays = viewMode === "month" ? 540 : viewMode === "week" ? 140 : 60;
    const extendedEndDate = addDays(maxEndDate, extensionDays);

    const rows: GanttTask[] = [];
    // gantt-task-react sorts by `displayOrder || Number.MAX_VALUE`.
    // If displayOrder is 0, it is treated as falsy and pushed to the end.
    // Start from 1 to keep row order strictly aligned with the left table.
    let displayOrder = 1;

    groupedRows.forEach(({ category, rows: categoryRows }, blockIndex) => {
      rows.push({
        id: `${CATEGORY_ROW_PREFIX}${blockIndex}:${category}`,
        name: "",
        start: anchorDate,
        end: extendedEndDate,
        progress: 0,
        type: "task",
        dependencies: [],
        isDisabled: true,
        displayOrder: displayOrder++,
        styles: {
          backgroundColor: "transparent",
          backgroundSelectedColor: "transparent",
          progressColor: "transparent",
          progressSelectedColor: "transparent"
        }
      });

      for (const item of categoryRows.filter((row) => !row.task.isCategoryPlaceholder)) {
        const color = statusColor(item.task.status);
        const hasChild = parentTaskIdSet.has(item.task.id);
        rows.push({
          id: item.task.id,
          name: item.task.name,
          start: toDate(item.task.startDate),
          end: toDate(item.task.endDate),
          progress: item.task.progress,
          type: item.task.isMilestone ? "milestone" : hasChild ? "project" : "task",
          project: item.task.parentId,
          dependencies: [],
          displayOrder: displayOrder++,
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: "#005bab",
            progressColor: "#62aef0",
            progressSelectedColor: "#f2f9ff"
          }
        });
      }
    });

    return rows;
  }, [groupedRows, parentTaskIdSet, tasks, viewMode]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const normalizeCalendarBottomText = () => {
      const labels = root.querySelectorAll<SVGTextElement>(".calendar-bottom-text, ._9w8d5");

      labels.forEach((label, index) => {
        const rawText = (label.textContent || "").trim();
        if (!rawText) return;

        const numbers = rawText.match(/\d+/g);
        if (!numbers || numbers.length === 0) return;

        const dayNum = String(Number(numbers[numbers.length - 1]));
        if (label.textContent !== dayNum) {
          label.textContent = dayNum;
        }

        // Show every other day label so visible ticks read 9,11,13...
        label.style.opacity = index % 2 === 0 ? "1" : "0";
      });

      // Hide every other vertical day tick so one visible grid cell represents 2 days.
      const verticalTicks = root.querySelectorAll<SVGLineElement>("._RuwuK, ._1rLuZ");
      verticalTicks.forEach((tick, index) => {
        tick.style.opacity = index % 2 === 0 ? "1" : "0";
      });
    };

    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      normalizeCalendarBottomText();
      // Run once more after next paint to catch delayed svg text mount.
      rafB = requestAnimationFrame(() => {
        normalizeCalendarBottomText();
      });
    });

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
  }, [viewMode, columnWidth, language, ganttTasks.length]);

  return (
    <div
      ref={wrapperRef}
      className="gantt-wrapper notion-gantt-theme gantt-unified-wrapper"
      style={{
        "--gantt-header-height": `${HEADER_HEIGHT}px`, 
        "--gantt-category-band-height": `${CATEGORY_BAND_HEIGHT}px`,
        "--left-grid-min-width": `${LIST_GRID_MIN_WIDTH}px`
      } as CSSProperties}
    >
      {ganttTasks.length === 0 ? (
        <div className="gantt-empty">{t("ganttEmpty")}</div>
      ) : (
        <>
          <Gantt
            tasks={ganttTasks}
            viewMode={getViewMode(viewMode)}
            locale={language === "zh" ? "zh-CN" : "en-US"}
            listCellWidth={`${listPanelWidth}px`}
            ganttHeight={ganttViewportHeight}
            rowHeight={36}
            headerHeight={HEADER_HEIGHT}
            timeStep={TWO_DAY_STEP_MS}
            TaskListHeader={({ headerHeight, rowWidth }) => (
              <div
                ref={leftHeaderScrollRef}
                className="gantt-left-header"
                style={{ height: headerHeight, width: rowWidth, minWidth: rowWidth, maxWidth: rowWidth }}
                onScroll={syncScrollFromHeader}
              >
              {/* 行1：列标题，高度与右侧年月行对齐 */}
              <div
                className="gantt-left-grid gantt-left-grid-header"
                style={{ height: TITLE_ROW_HEIGHT, gridTemplateColumns: LIST_GRID_TEMPLATE }}
              >
                <div className="gantt-left-cell">
                  <div className="task-name-header-cell">
                    <button className="cell-mini-btn" onClick={() => onInsertRoot(undefined, "category")} title={t("insertRoot")}>
                      +
                    </button>
                    <span>{t("taskName")}</span>
                  </div>
                </div>
                <div className="gantt-left-cell">{t("owner")}</div>
                <div className="gantt-left-cell">{t("status")}</div>
                <div className="gantt-left-cell">{t("start")}</div>
                <div className="gantt-left-cell">{t("end")}</div>
                <div className="gantt-left-cell">{t("duration")}</div>
                <div className="gantt-left-cell">{t("actions")}</div>
              </div>
              {/* 行2：空白分隔行，高度与右侧日期行对齐 */}
              <div className="gantt-left-header-ext" style={{ height: DATES_ROW_HEIGHT }} />
              </div>
            )}
            TaskListTable={({ rowHeight, rowWidth, selectedTaskId: listSelectedTaskId, setSelectedTask }) => (
              <div
                ref={leftTableScrollRef}
                className="gantt-left-table"
                style={{ width: rowWidth, minWidth: rowWidth, maxWidth: rowWidth }}
                onScroll={syncScrollFromTable}
              >
              {leftRows.map((rowItem) => {
                if (rowItem.kind === "category") {
                  const category = rowItem.category;
                  return (
                    <div key={`left-category-${rowItem.blockKey}`} className="gantt-left-row gantt-left-category-row" style={{ height: rowHeight }}>
                      <div className="gantt-left-grid" style={{ gridTemplateColumns: LIST_GRID_TEMPLATE }}>
                        <div className="gantt-left-cell">
                          <div className="category-title-wrap">
                            <button
                              className="cell-mini-btn"
                              onClick={() => onInsertRoot(category, "task", rowItem.anchorTaskId)}
                              title={t("insertRow")}
                            >
                              +
                            </button>
                            <input
                              className="category-title-input"
                              value={categoryDrafts[category] ?? category}
                              onChange={(event) =>
                                setCategoryDrafts((prev) => ({
                                  ...prev,
                                  [category]: event.target.value
                                }))
                              }
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitCategoryRename(category, (event.target as HTMLInputElement).value);
                                  (event.target as HTMLInputElement).blur();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setCategoryDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[category];
                                    return next;
                                  });
                                  (event.target as HTMLInputElement).blur();
                                }
                              }}
                              onBlur={(event) => commitCategoryRename(category, event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="gantt-left-cell" />
                        <div className="gantt-left-cell" />
                        <div className="gantt-left-cell" />
                        <div className="gantt-left-cell" />
                        <div className="gantt-left-cell" />
                        <div className="gantt-left-cell" />
                      </div>
                    </div>
                  );
                }

                const id = rowItem.taskId;
                const visible = taskMap.get(id);
                if (!visible) return null;

                const isSelected = (listSelectedTaskId || selectedTaskId) === id;
                const indent = visible.depth * 12;
                const hasChildren = visible.hasChildren;
                const statusClassMap: Record<TaskItem["status"], string> = {
                  not_started: "status-not-started",
                  in_progress: "status-in-progress",
                  completed: "status-completed",
                  delayed: "status-delayed"
                };

                return (
                  <div
                    key={id}
                    className={`gantt-left-row ${isSelected ? "selected-row" : ""}`}
                    style={{ height: rowHeight }}
                    onDragOver={(event) => {
                      if (!draggingTaskId || draggingTaskId === id) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const fromData = event.dataTransfer.getData("text/plain");
                      const activeId = draggingTaskId || fromData;
                      if (!activeId || activeId === id) return;
                      onReorderTask(activeId, id);
                      setDraggingTaskId(undefined);
                    }}
                    onClick={() => {
                      setSelectedTask(id);
                      onSelectTask(id);
                    }}
                  >
                    <div className="gantt-left-grid" style={{ gridTemplateColumns: LIST_GRID_TEMPLATE }}>
                      <div className="gantt-left-cell task-name-gantt-cell">
                        <div className="task-name-cell" style={{ paddingLeft: `${indent}px` }}>
                          <button
                            type="button"
                            className="row-drag-handle"
                            title={language === "zh" ? "拖动排序" : "Drag to reorder"}
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              setDraggingTaskId(id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", id);
                            }}
                            onDragEnd={() => setDraggingTaskId(undefined)}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            ::
                          </button>
                          {hasChildren ? (
                            <button
                              type="button"
                              className="icon-btn category-toggle"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleCollapse(id);
                              }}
                              title={language === "zh" ? "\u6298\u53E0/\u5C55\u5F00" : "Expand / Collapse"}
                            >
                              {collapsedTaskIds.has(id) ? ">" : "v"}
                            </button>
                          ) : null}
                          <input
                            key={`${id}-name-${visible.task.name}`}
                            className="inline-text"
                            defaultValue={visible.task.name}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitInlineField(visible.task, "name", (event.target as HTMLInputElement).value);
                                (event.target as HTMLInputElement).blur();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                (event.target as HTMLInputElement).value = visible.task.name;
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={(event) => commitInlineField(visible.task, "name", event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="gantt-left-cell">
                        <input
                          key={`${id}-owner-${visible.task.owner}`}
                          className="inline-text"
                          defaultValue={visible.task.owner}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={(event) => event.currentTarget.select()}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitInlineField(visible.task, "owner", (event.target as HTMLInputElement).value);
                              (event.target as HTMLInputElement).blur();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              (event.target as HTMLInputElement).value = visible.task.owner;
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={(event) => commitInlineField(visible.task, "owner", event.target.value)}
                        />
                      </div>
                      <div className={`gantt-left-cell status-cell ${statusClassMap[visible.task.status]}`}>
                        <select
                          className="inline-select"
                          value={visible.task.status}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          onChange={(event) => onQuickUpdate(id, { status: event.target.value as TaskItem["status"] })}
                        >
                          <option value="not_started">{getStatusLabel(language, "not_started")}</option>
                          <option value="in_progress">{getStatusLabel(language, "in_progress")}</option>
                          <option value="completed">{getStatusLabel(language, "completed")}</option>
                          <option value="delayed">{getStatusLabel(language, "delayed")}</option>
                        </select>
                      </div>
                      <div className="gantt-left-cell">
                        <input
                          key={`${id}-start-${visible.task.startDate}`}
                          type="date"
                          className="inline-date"
                          defaultValue={visible.task.startDate}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitInlineField(visible.task, "startDate", (event.target as HTMLInputElement).value);
                              (event.target as HTMLInputElement).blur();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              (event.target as HTMLInputElement).value = visible.task.startDate;
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={(event) => commitInlineField(visible.task, "startDate", event.target.value)}
                        />
                      </div>
                      <div className="gantt-left-cell">
                        <input
                          key={`${id}-end-${visible.task.endDate}`}
                          type="date"
                          className="inline-date"
                          defaultValue={visible.task.endDate}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitInlineField(visible.task, "endDate", (event.target as HTMLInputElement).value);
                              (event.target as HTMLInputElement).blur();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              (event.target as HTMLInputElement).value = visible.task.endDate;
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={(event) => commitInlineField(visible.task, "endDate", event.target.value)}
                        />
                      </div>
                      <div className="gantt-left-cell">{`${visible.task.duration}${t("daySuffix")}`}</div>
                      <div className="gantt-left-cell row-delete-cell">
                        <button
                          className="cell-delete-btn"
                          title={t("quickDelete")}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTask(id);
                          }}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
            columnWidth={columnWidth}
            todayColor="transparent"
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore gantt-task-react runtime supports selectedTaskId but type definitions miss it.
            selectedTaskId={selectedTaskId}
            onSelect={(task) => {
              const id = String(task.id);
              if (isCategoryRowId(id)) return;
              onSelectTask(id);
            }}
            onDateChange={(task) => {
              const id = String(task.id);
              if (isCategoryRowId(id)) return false;
              onDateChange(id, toISODate(task.start), toISODate(task.end));
              return true;
            }}
          />
          <div
            ref={leftProxyScrollRef}
            className="left-proxy-scrollbar"
            style={{ width: `${listPanelWidth}px` }}
            onScroll={syncScrollFromProxy}
          >
            <div style={{ width: `${leftScrollContentWidth}px`, height: "1px" }} />
          </div>
          <div className="gantt-split-divider" style={{ left: `${listPanelWidth}px` }} />
        </>
      )}
    </div>
  );
};
