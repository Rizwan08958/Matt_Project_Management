"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAdmin,
  requireAuth,
  requireModuleAccess,
  requireProjectRecordAccess,
} from "@/lib/auth";
import {
  createProjectSchema,
  updateProjectSchema,
  holdProjectSchema,
} from "@/lib/validations/project.schema";
import {
  buildProjectWhereForViewer,
  normalizeEmployeePermissions,
  sanitizeListByFieldPermissions,
  sanitizeRecordByFieldPermissions,
  type EmployeePermissions,
} from "@/lib/employee-permissions";
import { logActivity } from "./activity-log.actions";
import { Prisma, ProjectStatus } from "@prisma/client";

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  );
}

async function ensureDefaultProjectStages() {
  const count = await db.projectStage.count();
  if (count > 0) return;

  await db.projectStage.createMany({
    data: [
      { name: "Planning", sortOrder: 0 },
      { name: "In Progress", sortOrder: 1 },
      { name: "On Hold", sortOrder: 2 },
      { name: "Completed", sortOrder: 3 },
      { name: "Cancelled", sortOrder: 4 },
    ],
  });
}

export async function getProjectStages() {
  await ensureDefaultProjectStages();

  return db.projectStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function getStageIdForStatus(status: ProjectStatus) {
  const stageNameByStatus: Record<ProjectStatus, string> = {
    PLANNING: "Planning",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const stage = await db.projectStage.findFirst({
    where: { name: { equals: stageNameByStatus[status], mode: "insensitive" } },
    select: { id: true },
  });

  return stage?.id;
}

async function generateProjectCode() {
  const latestProject = await db.project.findFirst({
    where: { code: { startsWith: "PRJ-" } },
    orderBy: [{ createdAt: "desc" }],
    select: { code: true },
  });

  const latestNumber = latestProject?.code.match(/^PRJ-(\d+)$/)?.[1];
  const startNumber = latestNumber ? Number(latestNumber) + 1 : 1;

  for (let offset = 0; offset < 1000; offset += 1) {
    const candidate = `PRJ-${String(startNumber + offset).padStart(3, "0")}`;
    const exists = await db.project.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `PRJ-${Date.now()}`;
}

type ProjectTemplateKey = "HARDWARE" | "SOFTWARE" | "INTERNSHIP";

const PROJECT_TEMPLATES: Record<
  ProjectTemplateKey,
  { name: string; amount: number; tags: string }
> = {
  HARDWARE: { name: "Hardware Project", amount: 15000, tags: "hardware" },
  SOFTWARE: { name: "Software Project", amount: 10000, tags: "software" },
  INTERNSHIP: { name: "Internship Project", amount: 5000, tags: "internship" },
};

const round2 = (value: number) => Math.round(value * 100) / 100;

async function getNextProjectCode(prefix = "PRJ") {
  const rows = await db.$queryRaw<Array<{ maxNo: number | null }>>`
    SELECT MAX(
      NULLIF(regexp_replace("code", '[^0-9]', '', 'g'), '')::int
    ) AS "maxNo"
    FROM "projects"
  `;
  const nextNo = (rows[0]?.maxNo ?? 0) + 1;
  return `${prefix}-${String(nextNo).padStart(4, "0")}`;
}

export async function getProjects(userId?: string, role?: string, permissions?: EmployeePermissions) {
  const where = userId && role
    ? buildProjectWhereForViewer({ userId, role, permissions })
    : {};

  const projects = await db.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      manager: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, email: true, serviceName: true } },
      stage: { select: { id: true, name: true, sortOrder: true } },
      assignments: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      _count: {
        select: { timeEntries: true },
      },
    },
  });

  if (!role || role === "ADMIN" || !permissions) {
    return projects;
  }

  return sanitizeListByFieldPermissions(
    projects as unknown as Record<string, unknown>[],
    permissions
  ) as typeof projects;
}

export async function getProject(id: string) {
  try {
    const user = await requireAuth();
    await requireModuleAccess("PROJECT");
    await requireProjectRecordAccess(id);

    const project = await db.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, email: true, serviceName: true, projectName: true } },
        stage: { select: { id: true, name: true, sortOrder: true } },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                position: true,
              },
            },
          },
        },
        timeEntries: {
          orderBy: { date: "desc" },
          take: 10,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!project) {
      return null;
    }

    if (user.role === "ADMIN") {
      return project;
    }

    return sanitizeRecordByFieldPermissions(
      project as unknown as Record<string, unknown>,
      user.permissions
    ) as typeof project;
  } catch (error) {
    if (
      isDatabaseConnectionError(error) ||
      (error instanceof Error && error.message.startsWith("Forbidden"))
    ) {
      return null;
    }
    throw error;
  }
}

export async function createProject(formData: FormData) {
  const user = await requireAdmin();

  const validatedFields = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    code: formData.get("code") || undefined,
    clientId: formData.get("clientId") && formData.get("clientId") !== "none" ? formData.get("clientId") : undefined,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    type: formData.get("type"),
    priority: formData.get("priority"),
    estimatedHours: formData.get("estimatedHours") || undefined,
    startDate: formData.get("startDate") || undefined,
    deadline: formData.get("deadline") || undefined,
    managerId: formData.get("managerId") && formData.get("managerId") !== "none" ? formData.get("managerId") : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  if (!validatedFields.data.managerId) {
    return { error: "Please assign a BA as project manager" };
  }

  const selectedBa = await db.user.findUnique({
    where: { id: validatedFields.data.managerId },
    select: { id: true, role: true, isActive: true, permissions: true },
  });

  if (!selectedBa || !selectedBa.isActive || selectedBa.role !== "BA") {
    return { error: "Project manager must be an active BA" };
  }

  const hasProjectModuleAccess = normalizeEmployeePermissions(
    selectedBa.permissions
  ).moduleAccess.includes("PROJECT");

  if (!hasProjectModuleAccess) {
    return { error: "Selected BA does not have Projects module access" };
  }

  await ensureDefaultProjectStages();
  const firstStage = await db.projectStage.findFirst({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  let project = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedCode = await generateProjectCode();

    try {
      project = await db.project.create({
        data: {
          ...validatedFields.data,
          code: generatedCode,
          stageId: firstStage?.id,
        },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!project) {
    return { error: "Could not generate unique project code. Please try again." };
  }

  await logActivity({
    action: "CREATE",
    entityType: "project",
    entityId: project.id,
    createdById: user.id,
    metadata: { name: project.name, code: project.code },
  });

  if (project.managerId) {
    const manager = await db.user.findUnique({
      where: { id: project.managerId },
      select: { id: true, name: true },
    });

    await logActivity({
      action: "ASSIGN",
      entityType: "project_manager",
      entityId: project.id,
      userId: project.managerId,
      createdById: user.id,
      metadata: {
        projectName: project.name,
        managerName: manager?.name ?? "BA",
      },
    });
  }

  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function createProjectFromTemplate(templateKey: ProjectTemplateKey) {
  const user = await requireAdmin();
  const template = PROJECT_TEMPLATES[templateKey];
  if (!template) {
    return { error: "Invalid template" };
  }

  const code = await getNextProjectCode();
  const subtotalAmount = round2(template.amount);
  const gstPercent = 18;
  const gstAmount = round2(subtotalAmount * (gstPercent / 100));
  const finalAmount = round2(subtotalAmount + gstAmount);

  const project = await db.project.create({
    data: {
      name: template.name,
      code,
      serviceName: template.name,
      unitName: "Project",
      unitCount: 1,
      unitPrice: subtotalAmount,
      costPerUnit: 0,
      subtotalAmount,
      gstPercent,
      gstAmount,
      finalAmount,
      profitAmount: subtotalAmount,
      invoicingPolicy: "fixed_price",
      tags: template.tags,
      type: "INDIVIDUAL",
      priority: "MEDIUM",
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "project",
    entityId: project.id,
    createdById: user.id,
    metadata: { template: templateKey, name: project.name, code: project.code },
  });

  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function updateProject(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);
  const existingProject = await db.project.findUnique({
    where: { id },
    select: { id: true, managerId: true, name: true },
  });

  if (!existingProject) {
    return { error: "Project not found" };
  }

  const validatedFields = updateProjectSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    clientId: formData.get("clientId") && formData.get("clientId") !== "none" ? formData.get("clientId") : undefined,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    progress: formData.get("progress") ? Number(formData.get("progress")) : undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    startDate: formData.get("startDate") || undefined,
    deadline: formData.get("deadline") || undefined,
    managerId: formData.get("managerId") && formData.get("managerId") !== "none" ? formData.get("managerId") : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const project = await db.project.update({
    where: { id },
    data: validatedFields.data,
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { changes: Object.keys(validatedFields.data) },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: project };
}

export async function deleteProject(id: string) {
  const user = await requireActionPermission("DELETE", "PROJECT");

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }
  await requireProjectRecordAccess(id);

  await db.project.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { name: project.name, code: project.code },
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  const updateData: Record<string, unknown> = { status };
  const mappedStageId = await getStageIdForStatus(status);
  if (mappedStageId) {
    updateData.stageId = mappedStageId;
  }

  if (status === "COMPLETED") {
    updateData.completedAt = new Date();
    updateData.progress = 100;
  }

  if (status === "IN_PROGRESS" && !project.startDate) {
    updateData.startDate = new Date();
  }

  const updated = await db.project.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "STATUS_CHANGE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { oldStatus: project.status, newStatus: status },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function holdProject(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const validatedFields = holdProjectSchema.safeParse({
    reason: formData.get("reason"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  if (project.status === "ON_HOLD") {
    return { error: "Project is already on hold" };
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      status: "ON_HOLD",
      stageId: await getStageIdForStatus("ON_HOLD"),
      holdReason: validatedFields.data.reason,
      holdStartDate: new Date(),
    },
  });

  await logActivity({
    action: "HOLD",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { reason: validatedFields.data.reason },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function restartProject(id: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  if (project.status !== "ON_HOLD") {
    return { error: "Project is not on hold" };
  }

  let holdDays = 0;
  if (project.holdStartDate) {
    holdDays = Math.ceil(
      (new Date().getTime() - project.holdStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const updateData: Record<string, unknown> = {
    status: "IN_PROGRESS",
    stageId: await getStageIdForStatus("IN_PROGRESS"),
    holdReason: null,
    holdStartDate: null,
    totalHoldDays: project.totalHoldDays + holdDays,
  };

  // Optionally extend deadline by hold days
  if (project.deadline) {
    updateData.deadline = new Date(
      project.deadline.getTime() + holdDays * 24 * 60 * 60 * 1000
    );
  }

  const updated = await db.project.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "RESTART",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { holdDays },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function updateProjectProgress(id: string, progress: number) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  if (progress < 0 || progress > 100) {
    return { error: "Progress must be between 0 and 100" };
  }

  const project = await db.project.update({
    where: { id },
    data: { progress },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { progress },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: project };
}

export async function updateProjectStage(projectId: string, stageId: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(projectId);

  const [project, stage] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { id: true, stageId: true } }),
    db.projectStage.findUnique({ where: { id: stageId }, select: { id: true, name: true } }),
  ]);

  if (!project) return { error: "Project not found" };
  if (!stage) return { error: "Stage not found" };

  const updated = await db.project.update({
    where: { id: projectId },
    data: { stageId: stage.id },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: projectId,
    createdById: user.id,
    metadata: { oldStageId: project.stageId, newStageId: stage.id, newStageName: stage.name },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: updated };
}

export async function createProjectStage(formData: FormData) {
  const user = await requireActionPermission("CREATE", "PROJECT");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Stage name is required" };

  const existing = await db.projectStage.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return { error: "Stage already exists" };

  const last = await db.projectStage.findFirst({
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
  });

  const stage = await db.projectStage.create({
    data: {
      name,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "project-stage",
    entityId: stage.id,
    createdById: user.id,
    metadata: { name: stage.name },
  });

  revalidatePath("/projects");
  return { success: true, data: stage };
}

export async function renameProjectStage(stageId: string, name: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  const trimmedName = name.trim();

  if (!trimmedName) return { error: "Stage name is required" };

  const stage = await db.projectStage.findUnique({ where: { id: stageId } });
  if (!stage) return { error: "Stage not found" };

  const existing = await db.projectStage.findFirst({
    where: {
      id: { not: stageId },
      name: { equals: trimmedName, mode: "insensitive" },
    },
  });
  if (existing) return { error: "Stage already exists" };

  const updated = await db.projectStage.update({
    where: { id: stageId },
    data: { name: trimmedName },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project-stage",
    entityId: stageId,
    createdById: user.id,
    metadata: { oldName: stage.name, newName: updated.name },
  });

  revalidatePath("/projects");
  return { success: true, data: updated };
}

export async function deleteProjectStage(stageId: string) {
  const user = await requireActionPermission("DELETE", "PROJECT");

  const stage = await db.projectStage.findUnique({ where: { id: stageId } });
  if (!stage) return { error: "Stage not found" };

  const allStages = await db.projectStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (allStages.length <= 1) {
    return { error: "At least one stage is required" };
  }

  const fallback = allStages.find((item) => item.id !== stageId);
  if (!fallback) {
    return { error: "Fallback stage not found" };
  }

  await db.project.updateMany({
    where: { stageId },
    data: { stageId: fallback.id },
  });

  await db.projectStage.delete({ where: { id: stageId } });

  await logActivity({
    action: "DELETE",
    entityType: "project-stage",
    entityId: stageId,
    createdById: user.id,
    metadata: { name: stage.name, movedTo: fallback.name },
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function getProjectStats(projectId: string) {
  try {
    await requireModuleAccess("PROJECT");
    await requireProjectRecordAccess(projectId);

    const totalHours = await db.timeEntry.aggregate({
      where: { projectId },
      _sum: { hours: true },
    });

    const hoursByUser = await db.timeEntry.groupBy({
      by: ["userId"],
      where: { projectId },
      _sum: { hours: true },
    });

    return {
      totalHours: totalHours._sum.hours || 0,
      hoursByUser,
    };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        totalHours: 0,
        hoursByUser: [],
      };
    }
    throw error;
  }
}
