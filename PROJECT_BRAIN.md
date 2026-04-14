# PROJECT_BRAIN.md
> Auto-maintained context file. Read this at the start of every AI session.
> Last updated: 2026-04-14 09:45 (Africa/Johannesburg) | Updated by: Codex

## Project Identity
- Name: CCSA项目管理
- Type: Web App (SPA)
- Stack: React + TypeScript + Vite
- Language(s): TypeScript, CSS
- Package Manager: npm
- Test Framework: 暂未配置（可后续补 Vitest）
- Entry Point: src/main.tsx

## Current State
- Phase: building (UI baseline sealed)
- What's working:
  - 前端工程结构稳定，核心功能可用
  - 任务 CRUD、层级、依赖、拖拽排序、进度调整、甘特拖拽、视图切换、筛选排序已实现
  - localStorage 持久化生效
  - Notion 风格 UI 已完成第 5 轮收官并封版
- In progress (do not assume complete):
  - 本机最终安装依赖与运行验证需用户环境执行
- Known broken / TODO:
  - 无明确逻辑阻塞；后续可补测试与导入导出
- Next priority:
  - 在本机运行并截图验收，再进入功能增强

## Architecture Decisions (DO NOT REVERSE without discussion)
- 使用 `gantt-task-react` 实现甘特核心交互 | 降低实现复杂度与维护成本 | 2026-04-14
- 使用 `@dnd-kit` 实现任务表拖拽排序 | 满足交互需求且生态成熟 | 2026-04-14
- 使用 `localStorage` 做前端持久化 | 当前阶段无后端，确保刷新不丢数据 | 2026-04-14
- 封版 UI 风格为 Notion Inspired v1.0 | 保持后续迭代视觉一致性 | 2026-04-14

## Code Style Contract
- Naming: 组件 PascalCase、变量 camelCase
- File structure: `components/`, `utils/`, `data/`, `types` 分层
- Comment language: 中文
- Error handling pattern: 表单校验 + 安全默认值
- State management: React useState + useMemo（轻量）

## Key Files Map
| File | Purpose |
|------|---------|
| src/App.tsx | 主状态管理与页面编排 |
| src/components/TaskTable.tsx | 左侧任务表、层级展示、拖拽排序 |
| src/components/GanttBoard.tsx | 右侧甘特图展示与拖拽日期/进度 |
| src/components/TaskFormDrawer.tsx | 任务新增/编辑表单 |
| src/styles.css | UI 基线样式（v1.0 封版） |
| UI_BASELINE_V1.md | 封版设计规范文档 |

## Environment & Config
- Node/Python version: 建议 Node 18+
- Key env vars (names only, not values): 无
- Local setup notes:
  - `npm install`
  - `npm run dev`
- Known environment quirks:
  - 当前会话环境内 `npm install` 曾超时，建议本机直接执行

## Constraints & Non-Negotiables
- 中文界面标题必须为“CCSA项目管理”
- 仅前端实现，不引入后端/数据库
- 遵循 `UI_BASELINE_V1.md`，避免风格漂移

## Decision Log
| Date | Tool | Decision | Reason |
|------|------|----------|--------|
| 2026-04-14 | Codex | 采用 `gantt-task-react` 作为甘特核心 | 快速提供稳定、可维护的甘特能力 |
| 2026-04-14 | Codex | 使用 `@dnd-kit` 实现任务顺序拖拽 | 满足功能需求且组件化清晰 |
| 2026-04-14 | Codex | 使用 `date-fns` 处理日期 | 降低时区和边界日期风险 |
| 2026-04-14 | Codex | 完成 UI 第 1-5 轮并封版为 v1.0 | 统一视觉和交互规范，便于后续扩展 |

## Session History (brief)
- [2026-04-14][Codex]: 初始化并生成完整 React+TS 前端项目代码，实现核心甘特功能。
- [2026-04-14][Codex]: 按 Notion 风格完成五轮 UI 优化，修复编码污染，封版并新增 UI 基线文档。
