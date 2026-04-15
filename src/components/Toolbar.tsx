import { SORT_OPTIONS, VIEW_MODE_OPTIONS, getSortLabel, getStatusLabel, getViewModeLabel } from "../i18n";
import { Language, SortBy, TaskFilters, ViewModeOption } from "../types";

interface ToolbarProps {
  language: Language;
  t: (key: "searchPlaceholder" | "allOwners" | "allStatuses" | "allPriorities" | "sortPrefix" | "zoom" | "addTask") => string;
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

export const Toolbar = ({
  language,
  t,
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
      <input className="input input-search" placeholder={t("searchPlaceholder")} value={searchText} onChange={(event) => onSearchTextChange(event.target.value)} />
      <select className="input" value={filters.owner} onChange={(event) => onFiltersChange({ ...filters, owner: event.target.value })}>
        <option value="all">{t("allOwners")}</option>
        {owners.map((owner) => (
          <option key={owner} value={owner}>
            {owner}
          </option>
        ))}
      </select>
      <select className="input" value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as TaskFilters["status"] })}>
        <option value="all">{t("allStatuses")}</option>
        <option value="not_started">{getStatusLabel(language, "not_started")}</option>
        <option value="in_progress">{getStatusLabel(language, "in_progress")}</option>
        <option value="completed">{getStatusLabel(language, "completed")}</option>
        <option value="delayed">{getStatusLabel(language, "delayed")}</option>
      </select>
      <select className="input" value={filters.priority} onChange={(event) => onFiltersChange({ ...filters, priority: event.target.value as TaskFilters["priority"] })}>
        <option value="all">{t("allPriorities")}</option>
        <option value="high">{language === "zh" ? "\u9ad8" : "High"}</option>
        <option value="medium">{language === "zh" ? "\u4e2d" : "Medium"}</option>
        <option value="low">{language === "zh" ? "\u4f4e" : "Low"}</option>
      </select>
      <select className="input" value={sortBy} onChange={(event) => onSortByChange(event.target.value as SortBy)}>
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {`${t("sortPrefix")}: ${getSortLabel(language, option)}`}
          </option>
        ))}
      </select>
    </div>
    <div className="toolbar-right">
      <select className="input" value={viewMode} onChange={(event) => onViewModeChange(event.target.value as ViewModeOption)}>
        {VIEW_MODE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {getViewModeLabel(language, option)}
          </option>
        ))}
      </select>
      <label className="zoom-control">
        {t("zoom")}
        <input type="range" min={40} max={140} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} />
      </label>
      <button className="btn btn-primary" onClick={onAddTask}>
        {t("addTask")}
      </button>
    </div>
  </div>
);
