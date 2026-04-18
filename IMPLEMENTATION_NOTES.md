# CCSA/TMM 实施笔记

## 执行规则
- 按优先级执行：P0 -> P1 -> P2
- 每完成一个步骤，追加一条“完成笔记”
- 目标：避免上下文变长后丢失执行轨迹

## 小计划（当前）
1. P0-1 建立执行笔记与实施清单
2. P0-2 项目级角色权限（管理员/编辑/只读）
3. P0-3 审计日志（任务名/日期/状态）
4. P0-4 自动保存 + 版本回滚
5. P0-5 备份策略（Supabase + 周导出）

## 完成笔记
### 2026-04-16 Step P0-1 完成
- 新增本文件作为长期执行记录入口。
- 后续每个里程碑在此追加记录，便于回溯。

### 2026-04-16 Step P0-2 完成
- 新增项目级角色模型：`admin / editor / viewer`。
- 新增权限管理面板（管理员可分配角色）。
- 当前用户在“该项目暂无权限记录”时自动引导为项目管理员（bootstrap）。
- 编辑权限收敛为：`admin + editor`；`viewer`只读。
- 数据已持久化到 `PersistedState.projectPermissions`。

### 2026-04-16 Step P0-3 完成
- 已新增审计日志数据结构与持久化字段：`PersistedState.auditLogs`。
- 已接入任务名/日期/状态变更日志写入钩子。
- 顶部新增“审计日志”面板，可按当前项目查看最近变更（谁、何时、前后值）。

### 2026-04-16 Step P0-4 完成
- 已实现自动保存：数据改动后约 1.8s 自动落盘（本地 + 云端）。
- 已实现版本快照：每次保存形成版本（manual/auto/restore）。
- 已实现版本回滚：顶部“版本回滚”面板可一键恢复到历史版本。
- 回滚后会再写入一个 `restore` 版本，保证可撤销回滚。

### 2026-04-16 Step P0-5 完成
- 新增每周导出脚本：`npm run backup:export -- --workspace tmm-main --outdir exports`。
- 导出内容包含 `JSON + CSV`（任务、审计日志、权限、版本等）。
- 新增备份手册：`supabase/BACKUP_RUNBOOK.md`（每日 Supabase + 每周网盘导出）。

### 2026-04-17 Step P1-1 Completed
- Central validation implemented in data layer, not only UI layer.
- Rule 1: reject endDate earlier than startDate for non-milestone tasks in inline/date updates and form submit.
- Rule 2: dependency cycle detection added; save is blocked when cycle is detected.
- Rule 3: milestone normalization enforced (endDate = startDate, duration = 1).
- Added utility: src/utils/taskValidation.ts.

### 2026-04-17 Step P1-2 Completed
- Added baseline fields in task model: baselineStartDate / baselineEndDate.
- Added Baseline panel in header: compares baseline vs actual dates and shows day variance.
- Added "Set New Baseline" action for active project (bulk reset baseline to current plan).
- Baseline values are preserved during task edit and carried through save/revision flow.

### 2026-04-17 Step P1-3 Completed (Heuristic)
- Added risk list panel on header (critical delayed tasks).
- Critical rule (v1 heuristic): milestone OR high-priority OR has downstream dependents.
- Delay rule: status=delayed OR overdue (endDate < today and not completed).
- Critical delayed tasks are highlighted in left rows and rendered in red on Gantt bars.

### 2026-04-17 Step P1-4 Completed
- Added template task packs with one-click apply to active project.
- Added template selector panel in header.
- Template creation includes category, duration, dependency mapping, and baseline initialization.
- Added template source file: src/data/templates.ts.

### 2026-04-17 Step P2-2 Completed
- Added Excel/CSV import entry in header (imports into active project).
- Supports common CN/EN headers for name/category/owner/status/priority/start/end/dependency/parent/milestone.
- Added weekly export panel: PNG and PDF export from current board viewport.
- Added dependencies: xlsx, html2canvas, jspdf.

### 2026-04-17 Step P2-3 Completed
- Added backend mail endpoint: `POST /api/send-email` (Vercel serverless).
- Added header panel: `邮件通知 / Email Alerts`.
- Supports:
  - sending a test email
  - sending delayed + upcoming (7-day) summary email for current project
- Added helper util: `src/utils/notificationUtils.ts` for summary calculation and email body generation.
- Added env requirements to `.env.example` and README (`RESEND_API_KEY`, `EMAIL_FROM`).

### 2026-04-17 Step P2-4 Completed
- Added project health dashboard panel in header: `仪表盘 / Dashboard`.
- Metrics include:
  - total tasks
  - on-time rate
  - delay rate
  - completion rate
  - owner workload breakdown (total/completed/delayed/in-progress/not-started)
- No content logic or persistence schema changed; dashboard is read-only analytics from existing task data.

### 2026-04-17 Step P1-3 Enhanced
- Added critical path calculation (`src/utils/projectAnalysis.ts`) based on dependency DAG longest-path.
- Risk panel now has two sections:
  - critical path sequence (with duration summary)
  - delayed risk list (marks items that are also on critical path)
- Added dependency-cycle warning in risk panel when critical path cannot be computed.
- Added critical-path metrics into dashboard:
  - critical path task count
  - critical path delayed count
  - critical path total duration (days)
- Added left-row visual marker for critical path tasks (`CP` pill + blue side indicator).

### 2026-04-17 Step P1-3 Visual Polish
- Enhanced right-side Gantt bars for critical-path tasks (status-aware deeper CP gradients).
- Preserved status semantics:
  - in-progress remains blue family
  - completed remains green family
  - not-started remains gray family
  - delayed remains amber family
- Delay risk highlighting still takes precedence (red risk bars stay dominant).

### 2026-04-17 Step UI-Settings Consolidation Completed
- Consolidated header utility actions into one `设置 / Settings` panel.
- Moved these actions into settings:
  - Login / Logout
  - Permissions
  - Audit Log
  - Version Rollback
  - Baseline
  - Templates
  - Email Alerts
  - Import Excel
- Kept existing behavior/logic unchanged; only interaction entry was reorganized.

### 2026-04-17 Step UI-Settings Refinement Completed
- Moved signed-in email display from header into `Settings -> Account`.
- Moved timeline start date control from header into `Settings -> Project Settings`.
- Reduced top bar clutter while preserving the same timeline behavior and permissions rules.
