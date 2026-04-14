import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { VisibleTask } from "../types";

interface TaskTableProps {
  tasks: VisibleTask[];
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onChangeProgress: (taskId: string, progress: number) => void;
  collapsedTaskIds: Set<string>;
  onDragOrderChange: (activeId: string, overId: string) => void;
}

interface RowProps {
  row: VisibleTask;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onChangeProgress: (taskId: string, progress: number) => void;
  collapsedTaskIds: Set<string>;
}

const SortableRow = ({
  row,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onToggleCollapse,
  onChangeProgress,
  collapsedTaskIds
}: RowProps) => {
  const statusClassMap: Record<string, string> = {
    "\u672a\u5f00\u59cb": "status-not-started",
    "\u8fdb\u884c\u4e2d": "status-in-progress",
    "\u5df2\u5b8c\u6210": "status-completed",
    "\u5ef6\u671f": "status-delayed"
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  const indent = row.depth * 18;
  const isSelected = selectedTaskId === row.task.id;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isSelected ? "selected-row" : undefined}
      onClick={() => onSelectTask(row.task.id)}
      title={row.task.notes}
    >
      <td>
        <button className="drag-handle" {...attributes} {...listeners} title={"\u62d6\u62fd\u6392\u5e8f"}>
          ::
        </button>
      </td>
      <td>
        <div className="task-name-cell" style={{ paddingLeft: `${indent}px` }}>
          {row.hasChildren ? (
            <button
              type="button"
              className="icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse(row.task.id);
              }}
              title={"\u6298\u53e0/\u5c55\u5f00"}
            >
              {collapsedTaskIds.has(row.task.id) ? ">" : "v"}
            </button>
          ) : (
            <span className="placeholder-indent" />
          )}
          <span>{row.task.isMilestone ? `* ${row.task.name}` : row.task.name}</span>
        </div>
      </td>
      <td>{row.task.owner}</td>
      <td>
        <span className={`tag ${statusClassMap[row.task.status] ?? ""}`}>{row.task.status}</span>
      </td>
      <td>{row.task.priority}</td>
      <td>{row.task.startDate}</td>
      <td>{row.task.endDate}</td>
      <td>{`${row.task.duration}\u5929`}</td>
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
      <td>{row.task.dependencyIds.length > 0 ? row.task.dependencyIds.join(",") : "-"}</td>
      <td>
        <div className="action-cell">
          <button
            type="button"
            className="icon-btn"
            onClick={(event) => {
              event.stopPropagation();
              onEditTask(row.task.id);
            }}
          >
            {"\u7f16\u8f91"}
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTask(row.task.id);
            }}
          >
            {"\u5220\u9664"}
          </button>
        </div>
      </td>
    </tr>
  );
};

export const TaskTable = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onToggleCollapse,
  onChangeProgress,
  collapsedTaskIds,
  onDragOrderChange
}: TaskTableProps) => {
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

  return (
    <div className="task-table-wrapper">
      <table className="task-table">
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 112 }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>{"\u4efb\u52a1\u540d\u79f0"}</th>
            <th>{"\u8d1f\u8d23\u4eba"}</th>
            <th>{"\u72b6\u6001"}</th>
            <th>{"\u4f18\u5148\u7ea7"}</th>
            <th>{"\u5f00\u59cb"}</th>
            <th>{"\u7ed3\u675f"}</th>
            <th>{"\u5de5\u671f"}</th>
            <th>{"\u8fdb\u5ea6"}</th>
            <th>{"\u4f9d\u8d56"}</th>
            <th>{"\u64cd\u4f5c"}</th>
          </tr>
        </thead>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map((item) => item.task.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {tasks.map((row) => (
                <SortableRow
                  key={row.task.id}
                  row={row}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onToggleCollapse={onToggleCollapse}
                  onChangeProgress={onChangeProgress}
                  collapsedTaskIds={collapsedTaskIds}
                />
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-cell">
                    {"\u6682\u65e0\u4efb\u52a1\uff0c\u8bf7\u65b0\u589e\u4efb\u52a1\u3002"}
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
