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
  viewStartDate: string;
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
  onDateChange: (taskId: string, startDate: string, endDate: string) => void;
  onProgressChange: (taskId: string, progress: number) => void;
  onDeleteTask: (taskId: string) => void;
  onInsertRoot: (category?: string, mode?: "task" | "category", anchorTaskId?: string) => void;
  onInsertChild: (parentTaskId: string) => void;
  onRenameCategory: (currentCategory: string, nextCategory: string) => void;
  onReorderTask: (activeTaskId: string, overTaskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onQuickUpdate: (taskId: string, patch: Partial<TaskItem>) => void;
  collapsedTaskIds: Set<string>;
  riskTaskIds?: Set<string>;
  criticalPathTaskIds?: Set<string>;
  onRequireAuth?: () => void;
}

type LeftRow =
  | { kind: "category"; category: string; blockKey: string; anchorTaskId?: string }
  | { kind: "task"; taskId: string };

type StatusVariant = "not-started" | "in-progress" | "completed" | "blocked";

const CATEGORY_ROW_PREFIX = "__category_row__:";
const LIST_GRID_TEMPLATE = "230px 128px 164px 148px 148px 64px 52px";
const LIST_GRID_MIN_WIDTH = 980;
const LEFT_PANEL_RATIO = 0.5;
const LEFT_PANEL_MIN_WIDTH = 500;
const TITLE_ROW_HEIGHT = 36;
const DATES_ROW_HEIGHT = 20;
const HEADER_HEIGHT = TITLE_ROW_HEIGHT + DATES_ROW_HEIGHT;
const CATEGORY_BAND_HEIGHT = 34;
const ROW_HEIGHT = 44;
const TWO_DAY_STEP_MS = 2 * 24 * 60 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";
const GRADIENT_DEFS_ID = "ccsa-gantt-gradient-defs";

type GradientStop = { offset: string; color: string };
type GradientSpec = { id: string; stops: GradientStop[] };

const GRADIENT_SPECS: GradientSpec[] = [
  {
    id: "ccsa-grad-inprogress-bg",
    stops: [
      { offset: "0%", color: "#4f8ff6" },
      { offset: "100%", color: "#1d4ed8" }
    ]
  },
  {
    id: "ccsa-grad-inprogress-selected",
    stops: [
      { offset: "0%", color: "#3b82f6" },
      { offset: "100%", color: "#1e40af" }
    ]
  },
  {
    id: "ccsa-grad-inprogress-progress",
    stops: [
      { offset: "0%", color: "#2563eb" },
      { offset: "100%", color: "#1e3a8a" }
    ]
  },
  {
    id: "ccsa-grad-completed-bg",
    stops: [
      { offset: "0%", color: "#34d399" },
      { offset: "100%", color: "#059669" }
    ]
  },
  {
    id: "ccsa-grad-completed-selected",
    stops: [
      { offset: "0%", color: "#10b981" },
      { offset: "100%", color: "#047857" }
    ]
  },
  {
    id: "ccsa-grad-completed-progress",
    stops: [
      { offset: "0%", color: "#0ea5a4" },
      { offset: "100%", color: "#065f46" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-bg",
    stops: [
      { offset: "0%", color: "#94a3b8" },
      { offset: "100%", color: "#64748b" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-selected",
    stops: [
      { offset: "0%", color: "#7c8aa0" },
      { offset: "100%", color: "#475569" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-progress",
    stops: [
      { offset: "0%", color: "#6b7280" },
      { offset: "100%", color: "#374151" }
    ]
  },
  {
    id: "ccsa-grad-delayed-bg",
    stops: [
      { offset: "0%", color: "#f59e0b" },
      { offset: "100%", color: "#b45309" }
    ]
  },
  {
    id: "ccsa-grad-delayed-selected",
    stops: [
      { offset: "0%", color: "#d97706" },
      { offset: "100%", color: "#92400e" }
    ]
  },
  {
    id: "ccsa-grad-delayed-progress",
    stops: [
      { offset: "0%", color: "#c2410c" },
      { offset: "100%", color: "#7c2d12" }
    ]
  },
  {
    id: "ccsa-grad-inprogress-bg-cp",
    stops: [
      { offset: "0%", color: "#3b82f6" },
      { offset: "55%", color: "#1d4ed8" },
      { offset: "100%", color: "#1e3a8a" }
    ]
  },
  {
    id: "ccsa-grad-inprogress-selected-cp",
    stops: [
      { offset: "0%", color: "#2563eb" },
      { offset: "100%", color: "#1e3a8a" }
    ]
  },
  {
    id: "ccsa-grad-inprogress-progress-cp",
    stops: [
      { offset: "0%", color: "#1d4ed8" },
      { offset: "100%", color: "#172554" }
    ]
  },
  {
    id: "ccsa-grad-completed-bg-cp",
    stops: [
      { offset: "0%", color: "#22c55e" },
      { offset: "55%", color: "#059669" },
      { offset: "100%", color: "#065f46" }
    ]
  },
  {
    id: "ccsa-grad-completed-selected-cp",
    stops: [
      { offset: "0%", color: "#16a34a" },
      { offset: "100%", color: "#065f46" }
    ]
  },
  {
    id: "ccsa-grad-completed-progress-cp",
    stops: [
      { offset: "0%", color: "#0f766e" },
      { offset: "100%", color: "#064e3b" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-bg-cp",
    stops: [
      { offset: "0%", color: "#64748b" },
      { offset: "55%", color: "#475569" },
      { offset: "100%", color: "#334155" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-selected-cp",
    stops: [
      { offset: "0%", color: "#475569" },
      { offset: "100%", color: "#1f2937" }
    ]
  },
  {
    id: "ccsa-grad-notstarted-progress-cp",
    stops: [
      { offset: "0%", color: "#334155" },
      { offset: "100%", color: "#111827" }
    ]
  },
  {
    id: "ccsa-grad-delayed-bg-cp",
    stops: [
      { offset: "0%", color: "#f59e0b" },
      { offset: "55%", color: "#b45309" },
      { offset: "100%", color: "#78350f" }
    ]
  },
  {
    id: "ccsa-grad-delayed-selected-cp",
    stops: [
      { offset: "0%", color: "#d97706" },
      { offset: "100%", color: "#78350f" }
    ]
  },
  {
    id: "ccsa-grad-delayed-progress-cp",
    stops: [
      { offset: "0%", color: "#b45309" },
      { offset: "100%", color: "#7c2d12" }
    ]
  }
];

const gradientFill = (id: string): string => `url(#${id})`;

const ensureGradientDefs = (svg: SVGSVGElement) => {
  if (svg.querySelector(`#${GRADIENT_DEFS_ID}`)) return;
  const defs = document.createElementNS(SVG_NS, "defs");
  defs.setAttribute("id", GRADIENT_DEFS_ID);

  for (const spec of GRADIENT_SPECS) {
    const gradient = document.createElementNS(SVG_NS, "linearGradient");
    gradient.setAttribute("id", spec.id);
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "100%");
    gradient.setAttribute("y2", "0%");

    for (const stopSpec of spec.stops) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", stopSpec.offset);
      stop.setAttribute("stop-color", stopSpec.color);
      gradient.appendChild(stop);
    }
    defs.appendChild(gradient);
  }

  svg.insertBefore(defs, svg.firstChild);
};

const statusVariant = (status: TaskItem["status"]): StatusVariant => {
  switch (status) {
    case "in_progress":
      return "in-progress";
    case "completed":
      return "completed";
    case "delayed":
      return "blocked";
    default:
      return "not-started";
  }
};

const statusBarStyles = (
  status: TaskItem["status"],
  isCriticalRisk = false,
  isCriticalPath = false
): GanttTask["styles"] => {
  if (isCriticalRisk) {
    return {
      backgroundColor: "#ef4444",
      backgroundSelectedColor: "#dc2626",
      progressColor: "#ef4444",
      progressSelectedColor: "#b91c1c"
    };
  }
  switch (status) {
    case "in_progress":
      return {
        backgroundColor: gradientFill(isCriticalPath ? "ccsa-grad-inprogress-bg-cp" : "ccsa-grad-inprogress-bg"),
        backgroundSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-inprogress-selected-cp" : "ccsa-grad-inprogress-selected"
        ),
        progressColor: gradientFill(isCriticalPath ? "ccsa-grad-inprogress-progress-cp" : "ccsa-grad-inprogress-progress"),
        progressSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-inprogress-selected-cp" : "ccsa-grad-inprogress-selected"
        )
      };
    case "completed":
      return {
        backgroundColor: gradientFill(isCriticalPath ? "ccsa-grad-completed-bg-cp" : "ccsa-grad-completed-bg"),
        backgroundSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-completed-selected-cp" : "ccsa-grad-completed-selected"
        ),
        progressColor: gradientFill(isCriticalPath ? "ccsa-grad-completed-progress-cp" : "ccsa-grad-completed-progress"),
        progressSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-completed-selected-cp" : "ccsa-grad-completed-selected"
        )
      };
    case "delayed":
      return {
        backgroundColor: gradientFill(isCriticalPath ? "ccsa-grad-delayed-bg-cp" : "ccsa-grad-delayed-bg"),
        backgroundSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-delayed-selected-cp" : "ccsa-grad-delayed-selected"
        ),
        progressColor: gradientFill(isCriticalPath ? "ccsa-grad-delayed-progress-cp" : "ccsa-grad-delayed-progress"),
        progressSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-delayed-selected-cp" : "ccsa-grad-delayed-selected"
        )
      };
    default:
      return {
        backgroundColor: gradientFill(isCriticalPath ? "ccsa-grad-notstarted-bg-cp" : "ccsa-grad-notstarted-bg"),
        backgroundSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-notstarted-selected-cp" : "ccsa-grad-notstarted-selected"
        ),
        progressColor: gradientFill(isCriticalPath ? "ccsa-grad-notstarted-progress-cp" : "ccsa-grad-notstarted-progress"),
        progressSelectedColor: gradientFill(
          isCriticalPath ? "ccsa-grad-notstarted-selected-cp" : "ccsa-grad-notstarted-selected"
        )
      };
  }
};

const getViewMode = (viewMode: ViewModeOption): ViewMode => {
  if (viewMode === "week") return ViewMode.Week;
  if (viewMode === "month") return ViewMode.Month;
  return ViewMode.Day;
};

const isCategoryRowId = (id: string): boolean => id.startsWith(CATEGORY_ROW_PREFIX);
const normalizeInputDateValue = (value: string): string => toISODate(toDate(value));

export const GanttBoard = ({
  language,
  t,
  tasks,
  selectedTaskId,
  viewMode,
  columnWidth,
  viewStartDate,
  canEdit,
  onSelectTask,
  onDateChange,
  onProgressChange: _onProgressChange,
  onDeleteTask,
  onInsertRoot,
  onInsertChild,
  onRenameCategory,
  onReorderTask,
  onToggleCollapse,
  onQuickUpdate,
  collapsedTaskIds,
  riskTaskIds,
  criticalPathTaskIds,
  onRequireAuth
}: GanttBoardProps) => {
  const [listPanelWidth, setListPanelWidth] = useState<number>(680);
  const [ganttViewportHeight, setGanttViewportHeight] = useState<number>(420);
  const [leftScrollContentWidth, setLeftScrollContentWidth] = useState<number>(LIST_GRID_MIN_WIDTH);
  const [draggingTaskId, setDraggingTaskId] = useState<string>();
  const [openStatusMenuTaskId, setOpenStatusMenuTaskId] = useState<string>();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const leftHeaderScrollRef = useRef<HTMLDivElement>(null);
  const leftTableScrollRef = useRef<HTMLDivElement>(null);
  const leftProxyScrollRef = useRef<HTMLDivElement>(null);

  const statusOptions = useMemo(
    () => [
      { value: "not_started" as const, variant: statusVariant("not_started") },
      { value: "in_progress" as const, variant: statusVariant("in_progress") },
      { value: "completed" as const, variant: statusVariant("completed") },
      { value: "delayed" as const, variant: statusVariant("delayed") }
    ],
    []
  );

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
      const nextGanttHeight = Math.max(240, totalHeight - HEADER_HEIGHT - 18);
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

  const normalizedViewStartDate = useMemo(() => {
    const safe = /^\d{4}-\d{2}-\d{2}$/.test(viewStartDate) ? viewStartDate : "2026-04-01";
    const date = new Date(`${safe}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date("2026-04-01T00:00:00") : date;
  }, [viewStartDate]);

  const preStepsCount = useMemo(() => {
    if (tasks.length === 0) return 1;
    const earliestTaskStart = tasks.reduce((earliest, row) => {
      const current = toDate(row.task.startDate);
      return current < earliest ? current : earliest;
    }, toDate(tasks[0].task.startDate));

    if (earliestTaskStart <= normalizedViewStartDate) return 1;
    const oneDay = 24 * 60 * 60 * 1000;
    const gapDays = Math.ceil((earliestTaskStart.getTime() - normalizedViewStartDate.getTime()) / oneDay);
    return Math.max(1, gapDays + 2);
  }, [tasks, normalizedViewStartDate]);

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
    if (!canEdit) {
      onRequireAuth?.();
      return;
    }
    const nextCategory = inputValue.trim();
    if (!nextCategory || nextCategory === currentCategory) return;
    onRenameCategory(currentCategory, nextCategory);
  };

  const commitInlineField = (task: TaskItem, field: "name" | "owner" | "startDate" | "endDate", value: string) => {
    if (!canEdit) {
      onRequireAuth?.();
      return;
    }
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
    const anchorDate = startDates.reduce((min, current) => (current < min ? current : min), startDates[0]);

    const rows: GanttTask[] = [];
    let displayOrder = 1;

    groupedRows.forEach(({ category, rows: categoryRows }, blockIndex) => {
      rows.push({
        id: `${CATEGORY_ROW_PREFIX}${blockIndex}:${category}`,
        name: "",
        start: anchorDate,
        end: anchorDate,
        progress: 0,
        type: "task",
        dependencies: [],
        displayOrder: displayOrder++,
        styles: {
          backgroundColor: "transparent",
          backgroundSelectedColor: "transparent",
          progressColor: "transparent",
          progressSelectedColor: "transparent"
        },
        isDisabled: true
      });

      for (const item of categoryRows.filter((row) => !row.task.isCategoryPlaceholder)) {
        const isCriticalRisk = Boolean(riskTaskIds?.has(item.task.id));
        const isCriticalPath = Boolean(criticalPathTaskIds?.has(item.task.id));
        rows.push({
          id: item.task.id,
          name: item.task.name,
          start: toDate(item.task.startDate),
          end: toDate(item.task.endDate),
          progress: item.task.progress,
          type: item.task.isMilestone ? "milestone" : "task",
          dependencies: [],
          displayOrder: displayOrder++,
          styles: statusBarStyles(item.task.status, isCriticalRisk, isCriticalPath),
          isDisabled: !canEdit
        });
      }
    });

    return rows;
  }, [canEdit, groupedRows, tasks, viewMode, riskTaskIds, criticalPathTaskIds]);

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
        label.style.opacity = index % 2 === 0 ? "1" : "0";
      });

      const verticalTicks = root.querySelectorAll<SVGLineElement>("._RuwuK, ._1rLuZ");
      verticalTicks.forEach((tick, index) => {
        tick.style.opacity = index % 2 === 0 ? "1" : "0";
      });
    };

    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      normalizeCalendarBottomText();
      rafB = requestAnimationFrame(() => normalizeCalendarBottomText());
    });

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
  }, [viewMode, columnWidth, language, ganttTasks.length]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      const svgs = root.querySelectorAll<SVGSVGElement>("svg");
      svgs.forEach((svg) => ensureGradientDefs(svg));
    });
    return () => cancelAnimationFrame(raf);
  }, [ganttTasks.length, viewMode, columnWidth, language, listPanelWidth, ganttViewportHeight]);

  useEffect(() => {
    if (!openStatusMenuTaskId) return;
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".status-dropdown-wrap")) return;
      setOpenStatusMenuTaskId(undefined);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, [openStatusMenuTaskId]);
  return (
    <div
      ref={wrapperRef}
      className="gantt-wrapper notion-gantt-theme gantt-unified-wrapper"
      style={
        {
          "--gantt-header-height": `${HEADER_HEIGHT}px`,
          "--gantt-category-band-height": `${CATEGORY_BAND_HEIGHT}px`,
          "--left-grid-min-width": `${LIST_GRID_MIN_WIDTH}px`
        } as CSSProperties
      }
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
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            timeStep={TWO_DAY_STEP_MS}
            viewDate={normalizedViewStartDate}
            preStepsCount={preStepsCount}
            TaskListHeader={({ headerHeight, rowWidth }) => (
              <div
                ref={leftHeaderScrollRef}
                className="gantt-left-header"
                style={{ height: headerHeight, width: rowWidth, minWidth: rowWidth, maxWidth: rowWidth }}
                onScroll={syncScrollFromHeader}
              >
                <div className="gantt-left-grid gantt-left-grid-header gantt-col-header-row" style={{ height: TITLE_ROW_HEIGHT, gridTemplateColumns: LIST_GRID_TEMPLATE }}>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">
                    <div className="task-name-header-cell">
                      <button
                        className="cell-mini-btn"
                        onClick={() => {
                          if (!canEdit) {
                            onRequireAuth?.();
                            return;
                          }
                          onInsertRoot(undefined, "category");
                        }}
                        title={t("insertRoot")}
                        disabled={!canEdit}
                      >
                        +
                      </button>
                      <span>{t("taskName")}</span>
                    </div>
                  </div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("owner")}</div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("status")}</div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("start")}</div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("end")}</div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("duration")}</div>
                  <div className="gantt-left-cell gantt-cell gantt-col-header">{t("actions")}</div>
                </div>
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
                      <div
                        key={`left-category-${rowItem.blockKey}`}
                        className="gantt-left-row gantt-left-category-row gantt-row group-header"
                        style={{ height: rowHeight }}
                      >
                        <div className="gantt-left-grid" style={{ gridTemplateColumns: LIST_GRID_TEMPLATE }}>
                          <div className="gantt-left-cell gantt-cell gantt-cell-task-name">
                            <div className="category-title-wrap gantt-group-label">
                              <button
                                className="cell-mini-btn"
                                onClick={() => {
                                  if (!canEdit) {
                                    onRequireAuth?.();
                                    return;
                                  }
                                  onInsertRoot(category, "task", rowItem.anchorTaskId);
                                }}
                                title={t("insertRow")}
                                disabled={!canEdit}
                              >
                                +
                              </button>
                              <input
                                key={`category-${rowItem.blockKey}-${category}`}
                                className="category-title-input"
                                defaultValue={category}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitCategoryRename(category, (event.target as HTMLInputElement).value);
                                    (event.target as HTMLInputElement).blur();
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    (event.target as HTMLInputElement).value = category;
                                    (event.target as HTMLInputElement).blur();
                                  }
                                }}
                                onBlur={(event) => commitCategoryRename(category, event.target.value)}
                                readOnly={!canEdit}
                              />
                            </div>
                          </div>
                          <div className="gantt-left-cell gantt-cell" />
                          <div className="gantt-left-cell gantt-cell" />
                          <div className="gantt-left-cell gantt-cell" />
                          <div className="gantt-left-cell gantt-cell" />
                          <div className="gantt-left-cell gantt-cell" />
                          <div className="gantt-left-cell gantt-cell" />
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
                      className={`gantt-left-row gantt-row ${visible.depth > 0 ? "subtask" : ""} ${
                        isSelected ? "selected-row" : ""
                      } ${riskTaskIds?.has(id) ? "critical-risk-row" : ""} ${
                        criticalPathTaskIds?.has(id) ? "critical-path-row" : ""
                      }`}
                      style={{ height: rowHeight }}
                      onDragOver={(event) => {
                        if (!canEdit) return;
                        if (!draggingTaskId || draggingTaskId === id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        if (!canEdit) return;
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
                        setOpenStatusMenuTaskId(undefined);
                      }}
                    >
                      <div className="gantt-left-grid" style={{ gridTemplateColumns: LIST_GRID_TEMPLATE }}>
                        <div className="gantt-left-cell gantt-cell gantt-cell-task-name task-name-gantt-cell">
                          <div className="task-name-cell" style={{ paddingLeft: `${indent}px` }}>
                            <div className="row-controls">
                              <button
                                type="button"
                                className="row-drag-handle drag-handle"
                                title={language === "zh" ? "\u62d6\u52a8\u6392\u5e8f" : "Drag to reorder"}
                                disabled={!canEdit}
                                draggable={canEdit}
                                onDragStart={(event) => {
                                  if (!canEdit) {
                                    event.preventDefault();
                                    onRequireAuth?.();
                                    return;
                                  }
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
                              <button
                                type="button"
                                className={`icon-btn category-toggle expand-toggle ${hasChildren && !collapsedTaskIds.has(id) ? "expanded" : ""}`}
                                disabled={!hasChildren}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!hasChildren) return;
                                  onToggleCollapse(id);
                                }}
                                title={language === "zh" ? "\u5b50\u4efb\u52a1\u5c55\u5f00/\u6536\u8d77" : "Expand/Collapse Subtasks"}
                              >
                                {hasChildren ? "\u25b8" : "\u00b7"}
                              </button>
                              <button
                                type="button"
                                className="cell-mini-btn subtask-add-btn add-subtask-btn"
                                disabled={!canEdit}
                                title={language === "zh" ? "\u65b0\u589e\u5b50\u4efb\u52a1" : "Add subtask"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!canEdit) {
                                    onRequireAuth?.();
                                    return;
                                  }
                                  onInsertChild(id);
                                }}
                              >
                                +
                              </button>
                            </div>
                            {criticalPathTaskIds?.has(id) ? <span className="critical-path-pill">CP</span> : null}
                            <input
                              key={`${id}-name-${visible.task.name}`}
                              className="inline-text"
                              defaultValue={visible.task.name}
                              readOnly={!canEdit}
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
                        <div className="gantt-left-cell gantt-cell">
                          <input
                            key={`${id}-owner-${visible.task.owner}`}
                            className="inline-text"
                            defaultValue={visible.task.owner}
                            readOnly={!canEdit}
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
                        <div
                          className={`gantt-left-cell gantt-cell status-cell ${
                            statusClassMap[visible.task.status]
                          } ${openStatusMenuTaskId === id ? "status-cell-open" : ""}`}
                        >
                          <div
                            className="status-dropdown-wrap"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`status-badge ${statusVariant(visible.task.status)}`}
                              onClick={() => {
                                if (!canEdit) {
                                  onRequireAuth?.();
                                  return;
                                }
                                setOpenStatusMenuTaskId((prev) => (prev === id ? undefined : id));
                              }}
                            >
                              <span className="status-badge-dot" />
                              <span>{getStatusLabel(language, visible.task.status)}</span>
                            </button>
                            {canEdit && openStatusMenuTaskId === id ? (
                              <div className="status-dropdown-menu">
                                {statusOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className="status-dropdown-item"
                                    onClick={() => {
                                      onQuickUpdate(id, { status: option.value });
                                      setOpenStatusMenuTaskId(undefined);
                                    }}
                                  >
                                    <span className={`status-dropdown-item-dot ${option.variant}`} />
                                    <span>{getStatusLabel(language, option.value)}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="gantt-left-cell gantt-cell">
                          <input
                            type="date"
                            className="inline-date"
                            value={normalizeInputDateValue(visible.task.startDate)}
                            disabled={!canEdit}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const nextStartDate = event.target.value;
                              if (!nextStartDate) return;
                              onDateChange(
                                id,
                                nextStartDate,
                                normalizeInputDateValue(visible.task.endDate)
                              );
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter" || event.key === "Escape") {
                                event.preventDefault();
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                        <div className="gantt-left-cell gantt-cell">
                          <input
                            type="date"
                            className="inline-date"
                            value={normalizeInputDateValue(visible.task.endDate)}
                            disabled={!canEdit}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const nextEndDate = event.target.value;
                              if (!nextEndDate) return;
                              onDateChange(
                                id,
                                normalizeInputDateValue(visible.task.startDate),
                                nextEndDate
                              );
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter" || event.key === "Escape") {
                                event.preventDefault();
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                        <div className="gantt-left-cell gantt-cell">{`${visible.task.duration}${t("daySuffix")}`}</div>
                        <div className="gantt-left-cell gantt-cell row-delete-cell">
                          <button
                            className="cell-delete-btn"
                            title={t("quickDelete")}
                            disabled={!canEdit}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!canEdit) {
                                onRequireAuth?.();
                                return;
                              }
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
            todayColor="rgba(59, 130, 246, 0.06)"
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
              if (!canEdit) {
                onRequireAuth?.();
                return false;
              }
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
