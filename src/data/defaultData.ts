import { PersistedState, TaskItem } from "../types";
import { calcDuration } from "../utils/date";

const createTask = (task: Omit<TaskItem, "duration">): TaskItem => ({
  ...task,
  duration: calcDuration(task.startDate, task.endDate)
});

export const defaultState: PersistedState = {
  projects: [
    {
      id: "project-ccsa-main",
      name: "CCSA主项目",
      description: "默认示例工程，包含完整阶段任务"
    }
  ],
  activeProjectId: "project-ccsa-main",
  tasks: [
    createTask({
      id: "task-design-parent",
      projectId: "project-ccsa-main",
      name: "设计阶段",
      startDate: "2026-04-01",
      endDate: "2026-04-12",
      owner: "李工",
      progress: 100,
      priority: "高",
      status: "已完成",
      dependencyIds: [],
      notes: "完成总图与施工图设计",
      isMilestone: false,
      order: 10
    }),
    createTask({
      id: "task-design-review",
      projectId: "project-ccsa-main",
      parentId: "task-design-parent",
      name: "方案设计与评审",
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      owner: "李工",
      progress: 100,
      priority: "高",
      status: "已完成",
      dependencyIds: [],
      notes: "确认设计方案并评审通过",
      isMilestone: false,
      order: 11
    }),
    createTask({
      id: "task-design-delivery",
      projectId: "project-ccsa-main",
      parentId: "task-design-parent",
      name: "施工图交付",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      owner: "周工",
      progress: 100,
      priority: "中",
      status: "已完成",
      dependencyIds: ["task-design-review"],
      notes: "图纸归档完成",
      isMilestone: false,
      order: 12
    }),
    createTask({
      id: "task-procurement",
      projectId: "project-ccsa-main",
      name: "采购阶段",
      startDate: "2026-04-13",
      endDate: "2026-04-24",
      owner: "王经理",
      progress: 65,
      priority: "高",
      status: "进行中",
      dependencyIds: ["task-design-delivery"],
      notes: "设备与主材分批采购",
      isMilestone: false,
      order: 20
    }),
    createTask({
      id: "task-construction",
      projectId: "project-ccsa-main",
      name: "施工阶段",
      startDate: "2026-04-25",
      endDate: "2026-05-20",
      owner: "陈工",
      progress: 30,
      priority: "高",
      status: "进行中",
      dependencyIds: ["task-procurement"],
      notes: "现场安装与系统集成",
      isMilestone: false,
      order: 30
    }),
    createTask({
      id: "task-commissioning",
      projectId: "project-ccsa-main",
      name: "调试阶段",
      startDate: "2026-05-21",
      endDate: "2026-05-30",
      owner: "赵工",
      progress: 0,
      priority: "中",
      status: "未开始",
      dependencyIds: ["task-construction"],
      notes: "联调、故障清单处理",
      isMilestone: false,
      order: 40
    }),
    createTask({
      id: "task-acceptance",
      projectId: "project-ccsa-main",
      name: "验收里程碑",
      startDate: "2026-06-02",
      endDate: "2026-06-02",
      owner: "项目办",
      progress: 0,
      priority: "高",
      status: "未开始",
      dependencyIds: ["task-commissioning"],
      notes: "组织最终验收会议",
      isMilestone: true,
      order: 50
    })
  ]
};
