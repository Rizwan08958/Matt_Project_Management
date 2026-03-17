import { Priority, ProjectStatus, ProjectType } from "@prisma/client";

export type ProjectFilterKey =
  | "all"
  | "active"
  | "completed"
  | "team"
  | "individual"
  | "high_priority";

export type ProjectGroupByKey = "none" | "status" | "priority" | "manager" | "deadline";

export interface ProjectFilterableItem {
  name: string;
  code: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  manager: { name: string } | null;
  deadline: Date | null;
}

export function applyProjectBoardFilters<T extends ProjectFilterableItem>(
  projects: T[],
  searchQuery: string,
  activeFilter: ProjectFilterKey,
  activeGroupBy: ProjectGroupByKey
) {
  const q = searchQuery.trim().toLowerCase();

  let next = projects.filter((project) => {
    const text = [
      project.name,
      project.code,
      project.manager?.name || "",
      project.type,
      project.priority,
      project.status,
    ]
      .join(" ")
      .toLowerCase();
    return !q || text.includes(q);
  });

  next = next.filter((project) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") {
      return project.status !== "COMPLETED" && project.status !== "CANCELLED";
    }
    if (activeFilter === "completed") return project.status === "COMPLETED";
    if (activeFilter === "team") return project.type === "TEAM";
    if (activeFilter === "individual") return project.type === "INDIVIDUAL";
    if (activeFilter === "high_priority") {
      return project.priority === "HIGH" || project.priority === "CRITICAL";
    }
    return true;
  });

  if (activeGroupBy === "none") {
    return next;
  }

  const sorted = [...next];
  sorted.sort((a, b) => {
    if (activeGroupBy === "status") {
      const statusOrder: Record<ProjectStatus, number> = {
        PLANNING: 0,
        IN_PROGRESS: 1,
        ON_HOLD: 2,
        COMPLETED: 3,
        CANCELLED: 4,
      };
      return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "priority") {
      const priorityOrder: Record<Priority, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "manager") {
      return (a.manager?.name || "Unassigned").localeCompare(b.manager?.name || "Unassigned");
    }

    const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.name.localeCompare(b.name);
  });

  return sorted;
}
