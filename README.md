# CCSA项目管理

基于 `React + TypeScript + Vite` 的前端甘特图项目管理系统（SPA）。  
默认中文界面，系统标题为 **CCSA项目管理**，支持本地持久化，刷新不丢数据。

## 当前版本状态

- UI 已完成第 5 轮收官（Notion 风格高贴合）
- 功能核心可用：项目管理、任务管理、甘特展示、筛选排序、拖拽调整、本地存储
- 已封版：见 [UI_BASELINE_V1.md](./UI_BASELINE_V1.md)

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
