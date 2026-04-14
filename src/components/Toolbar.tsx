import { SortBy, TaskFilters, ViewModeOption } from "../types";

interface ToolbarProps {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  filters: TaskFilters;
  owners: string[];
  onFiltersChange: (next: TaskFilters) => void;
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
  viewMode: ViewModeOption;
  onViewModeChange: (value: ViewModeOption) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  onAddTask: () => void;
}

const sortOptions: SortBy[] = [
  "\u9ed8\u8ba4",
  "\u540d\u79f0",
  "\u5f00\u59cb\u65e5\u671f",
  "\u7ed3\u675f\u65e5\u671f",
  "\u8fdb\u5ea6",
  "\u4f18\u5148\u7ea7"
];

export const Toolbar = ({
  searchText,
  onSearchTextChange,
  filters,
  owners,
  onFiltersChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  zoom,
  onZoomChange,
  onAddTask
}: ToolbarProps) => (
  <div className="toolbar">
    <div className="toolbar-left">
      <input
        className="input input-search"
        placeholder={"\u641c\u7d22\u4efb\u52a1\u540d\u79f0/\u8d1f\u8d23\u4eba/\u5907\u6ce8"}
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
      />
      <select className="input" value={filters.owner} onChange={(event) => onFiltersChange({ ...filters, owner: event.target.value })}>
        <option value={"\u5168\u90e8"}>{"\u5168\u90e8\u8d1f\u8d23\u4eba"}</option>
        {owners.map((owner) => (
          <option key={owner} value={owner}>
            {owner}
          </option>
        ))}
      </select>
      <select
        className="input"
        value={filters.status}
        onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as TaskFilters["status"] })}
      >
        <option value={"\u5168\u90e8"}>{"\u5168\u90e8\u72b6\u6001"}</option>
        <option value={"\u672a\u5f00\u59cb"}>{"\u672a\u5f00\u59cb"}</option>
        <option value={"\u8fdb\u884c\u4e2d"}>{"\u8fdb\u884c\u4e2d"}</option>
        <option value={"\u5df2\u5b8c\u6210"}>{"\u5df2\u5b8c\u6210"}</option>
        <option value={"\u5ef6\u671f"}>{"\u5ef6\u671f"}</option>
      </select>
      <select
        className="input"
        value={filters.priority}
        onChange={(event) => onFiltersChange({ ...filters, priority: event.target.value as TaskFilters["priority"] })}
      >
        <option value={"\u5168\u90e8"}>{"\u5168\u90e8\u4f18\u5148\u7ea7"}</option>
        <option value={"\u9ad8"}>{"\u9ad8"}</option>
        <option value={"\u4e2d"}>{"\u4e2d"}</option>
        <option value={"\u4f4e"}>{"\u4f4e"}</option>
      </select>
      <select className="input" value={sortBy} onChange={(event) => onSortByChange(event.target.value as SortBy)}>
        {sortOptions.map((option) => (
          <option key={option} value={option}>
            {`\u6392\u5e8f\uff1a${option}`}
          </option>
        ))}
      </select>
    </div>
    <div className="toolbar-right">
      <select className="input" value={viewMode} onChange={(event) => onViewModeChange(event.target.value as ViewModeOption)}>
        <option value={"\u65e5"}>{"\u65e5\u89c6\u56fe"}</option>
        <option value={"\u5468"}>{"\u5468\u89c6\u56fe"}</option>
        <option value={"\u6708"}>{"\u6708\u89c6\u56fe"}</option>
      </select>
      <label className="zoom-control">
        {"\u7f29\u653e"}
        <input type="range" min={40} max={140} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} />
      </label>
      <button className="btn btn-primary" onClick={onAddTask}>
        {"\u65b0\u589e\u4efb\u52a1"}
      </button>
    </div>
  </div>
);
