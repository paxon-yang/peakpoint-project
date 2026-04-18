# CCSA项目管理

基于 `React + TypeScript + Vite` 的前端甘特图项目管理系统（SPA）。  
默认中文界面，系统标题为 **CCSA项目管理**，支持本地持久化，刷新不丢数据。

## 当前版本状态

- UI 已完成第 5 轮收官（Notion 风格高贴合）
- 功能核心可用：项目管理、任务管理、甘特展示、筛选排序、拖拽调整、本地存储
- 已封版：见 [UI_BASELINE_V1.md](./UI_BASELINE_V1.md)

## 使用教材

- 基础图文教程：[使用教材-基础版.md](./使用教材-基础版.md)

## 功能概览

- 左表右图布局（左侧任务表 + 右侧甘特图）
- 新增项目、新增任务、编辑任务、删除任务（含子任务级联删除）
- 任务字段：名称、开始/结束日期、工期、负责人、进度、优先级、状态、依赖、备注、里程碑
- 父子任务层级、折叠/展开
- 左侧任务拖拽排序
- 甘特条拖拽调整开始/结束时间
- 甘特进度调整（甘特拖拽 + 表格滑块）
- 依赖连线显示
- 日/周/月视图切换
- 时间轴缩放、滚动查看
- 当前日期高亮
- 搜索、筛选（负责人/状态/优先级）、排序
- 表单基础校验
- localStorage 持久化
- 默认示例项目：`CCSA主项目`（设计、采购、施工、调试、验收）

## 技术选型

- React + TypeScript + Vite
- `gantt-task-react`：甘特图核心能力（依赖线、拖拽日期、进度、视图切换）
- `@dnd-kit`：任务表拖拽排序
- `date-fns`：稳定日期处理

## 项目结构

```text
ccsa project/
├─ index.html
├─ package.json
├─ README.md
├─ UI_BASELINE_V1.md
├─ PROJECT_BRAIN.md
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ styles.css
   ├─ types.ts
   ├─ data/
   │  └─ defaultData.ts
   ├─ utils/
   │  ├─ date.ts
   │  └─ taskUtils.ts
   └─ components/
      ├─ GanttBoard.tsx
      ├─ ProjectDialog.tsx
      ├─ TaskFormDrawer.tsx
      ├─ TaskTable.tsx
      └─ Toolbar.tsx
```

## 安装与运行

```bash
npm install
npm run dev
```

生产构建与预览：

```bash
npm run build
npm run preview
```

## 封版说明

- 本次封版将 UI 规范固定为 `v1.0`
- 后续迭代请优先遵循 [UI_BASELINE_V1.md](./UI_BASELINE_V1.md)
- 若需大改视觉风格，请先更新基线文档再改样式

---

## Shared Cloud Database (Supabase)

This project now supports a shared backend store so multiple users can see the same data.

### 1) Create table and policies

Run SQL in your Supabase SQL editor:

```sql
-- file: supabase/schema.sql
create table if not exists public.workspaces (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

drop policy if exists "workspace_read_all" on public.workspaces;
create policy "workspace_read_all"
on public.workspaces
for select
to anon
using (true);

drop policy if exists "workspace_write_all" on public.workspaces;
create policy "workspace_write_all"
on public.workspaces
for insert
to anon
with check (true);

drop policy if exists "workspace_update_all" on public.workspaces;
create policy "workspace_update_all"
on public.workspaces
for update
to anon
using (true)
with check (true);
```

### 2) Configure env vars

Copy `.env.example` to `.env.local` and fill values:

```bash
VITE_REMOTE_STORE_ENABLED=true
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKSPACE_ID=tmm-main
```

### 3) Deploy on Vercel

Set the same `VITE_...` variables in Vercel Project Settings -> Environment Variables.

### 4) Save behavior

- Edits are staged locally in memory.
- Click `Save` to persist.
- With Supabase configured, `Save` writes to:
  - Supabase (shared data for all users)
  - localStorage (local backup)
- If Supabase is not configured, `Save` writes to localStorage only.
- If `VITE_REMOTE_STORE_ENABLED=false`, remote storage is forced off even when Supabase env vars are present.

### 5) Email notifications (P2)

This version adds a backend mail endpoint for:

- Sending a **test email**
- Sending **delayed + upcoming task summary**

Setup on Vercel (Project Settings -> Environment Variables):

```bash
RESEND_API_KEY=re_xxx
EMAIL_FROM=TMM Project <onboarding@resend.dev>
```

Notes:

- The endpoint is `POST /api/send-email`
- Frontend entry is the new **Email Alerts / 邮件通知** menu in the header
- If you run `npm run dev` locally, Vi