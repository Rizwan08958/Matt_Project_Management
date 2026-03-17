export interface TaskUpdate {
  id: string;
  byUserId: string;
  comment: string;
  completedToday: number;
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assignedTlId?: string;
  employeeAssigneeId?: string;
  dueDate?: string;
  stageId?: string;
  progress?: number;
  createdAt: string;
  updates: TaskUpdate[];
}

export function getTaskCompletionPercent(task: ProjectTask): number {
  if (typeof task.progress === "number") {
    return Math.max(0, Math.min(100, task.progress));
  }
  return 0;
}

export function getTaskStatus(task: ProjectTask): "TODO" | "IN_PROGRESS" | "DONE" {
  const percent = getTaskCompletionPercent(task);
  if (percent >= 100) return "DONE";
  if (percent > 0) return "IN_PROGRESS";
  return "TODO";
}

export function normalizeTask(raw: unknown): ProjectTask | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;

  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title : "";
  const description = typeof value.description === "string" ? value.description : "";
  const assigneeId = typeof value.assigneeId === "string" ? value.assigneeId : "";
  const assignedTlId = typeof value.assignedTlId === "string" ? value.assignedTlId : undefined;
  const employeeAssigneeId =
    typeof value.employeeAssigneeId === "string" ? value.employeeAssigneeId : undefined;
  const dueDate = typeof value.dueDate === "string" ? value.dueDate : undefined;
  const stageId = typeof value.stageId === "string" ? value.stageId : undefined;
  const rawProgress =
    typeof value.progress === "number"
      ? Math.max(0, Math.min(100, value.progress))
      : typeof value.progress === "string"
        ? Math.max(0, Math.min(100, Number(value.progress)))
        : undefined;
  const progress = typeof rawProgress === "number" && !Number.isNaN(rawProgress) ? rawProgress : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();

  if (!id || !title || !assigneeId) return null;

  const updatesRaw = Array.isArray(value.updates) ? value.updates : [];
  const updates: TaskUpdate[] = updatesRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const u = item as Record<string, unknown>;
      const updateId = typeof u.id === "string" ? u.id : "";
      const byUserId = typeof u.byUserId === "string" ? u.byUserId : "";
      const comment = typeof u.comment === "string" ? u.comment : "";
      const completedToday =
        typeof u.completedToday === "number"
          ? u.completedToday
          : typeof u.completedToday === "string"
            ? Number(u.completedToday)
            : 0;
      const updateCreatedAt =
        typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString();

      if (!updateId || !byUserId || Number.isNaN(completedToday)) return null;
      return {
        id: updateId,
        byUserId,
        comment,
        completedToday: Math.max(0, Math.min(100, completedToday)),
        createdAt: updateCreatedAt,
      };
    })
    .filter((item): item is TaskUpdate => Boolean(item));

  return {
    id,
    title,
    description,
    assigneeId,
    assignedTlId,
    employeeAssigneeId,
    dueDate,
    stageId,
    progress,
    createdAt,
    updates,
  };
}
