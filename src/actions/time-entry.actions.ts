"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAuth,
  requireModuleAccess,
  requireProjectRecordAccess,
} from "@/lib/auth";
import { buildProjectWhereForViewer, normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { createTimeEntrySchema, updateTimeEntrySchema } from "@/lib/validations/time-entry.schema";
import { logActivity } from "./activity-log.actions";

function shouldLimitToOwnRecords(permissions: unknown) {
  const normalized = normalizeEmployeePermissions(permissions);
  const rules = normalized.recordRules;
  if (rules.includes("RECORD_RULES")) {
    return false;
  }
  const hasTeamScope = rules.includes("TEAM_RECORD") || rules.includes("ASSIGN_PROJECT");
  return rules.includes("OWN_RECORD") && !hasTeamScope;
}

export async function getTimeEntries() {
  const user = await requireModuleAccess("PROJECT");
  const ownOnly = user.role !== "ADMIN" && shouldLimitToOwnRecords(user.permissions);
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });
  const where = {
    project: projectWhere,
    ...(ownOnly && { userId: user.id }),
  };

  return db.timeEntry.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
    take: 100,
  });
}

export async function getMyTimeEntries(userId: string, startDate?: Date, endDate?: Date) {
  const user = await requireModuleAccess("PROJECT");
  const targetUserId = user.role === "ADMIN" ? userId : user.id;
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      project: projectWhere,
      ...(startDate && endDate && {
        date: { gte: startDate, lte: endDate },
      }),
    },
    orderBy: { date: "desc" },
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function getAssignedProjects(userId?: string) {
  const user = await requireModuleAccess("PROJECT");
  const targetUserId = user.role === "ADMIN" ? (userId ?? user.id) : user.id;
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.project.findMany({
    where: {
      ...projectWhere,
      status: { in: ["PLANNING", "IN_PROGRESS"] },
      assignments: { some: { userId: targetUserId, isActive: true } },
    },
    select: { id: true, name: true, code: true },
  });
}

export async function getAllActiveProjects() {
  const user = await requireModuleAccess("PROJECT");
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.project.findMany({
    where: {
      ...projectWhere,
      status: { in: ["PLANNING", "IN_PROGRESS"] },
    },
    select: { id: true, name: true, code: true },
  });
}

export async function createTimeEntry(formData: FormData) {
  const user = await requireAuth();

  const validatedFields = createTimeEntrySchema.safeParse({
    projectId: formData.get("projectId"),
    date: formData.get("date"),
    hours: formData.get("hours"),
    description: formData.get("description") || undefined,
    isBillable: formData.get("isBillable") === "true",
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }
  await requireActionPermission("CREATE", "PROJECT");
  await requireProjectRecordAccess(validatedFields.data.projectId);

  const entry = await db.timeEntry.create({
    data: {
      ...validatedFields.data,
      userId: user.id,
    },
  });

  // Update project actual hours
  const totalHours = await db.timeEntry.aggregate({
    where: { projectId: validatedFields.data.projectId },
    _sum: { hours: true },
  });

  await db.project.update({
    where: { id: validatedFields.data.projectId },
    data: { actualHours: totalHours._sum.hours || 0 },
  });

  await logActivity({
    action: "CREATE",
    entityType: "time_entry",
    entityId: entry.id,
    userId: user.id,
    createdById: user.id,
    metadata: { hours: entry.hours, projectId: entry.projectId },
  });

  revalidatePath("/work-tracking");
  revalidatePath(`/projects/${validatedFields.data.projectId}`);
  return { success: true, data: entry };
}

export async function updateTimeEntry(id: string, formData: FormData) {
  const user = await requireAuth();

  const entry = await db.timeEntry.findUnique({ where: { id } });

  if (!entry) {
    return { error: "Time entry not found" };
  }
  await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(entry.projectId);

  // Check if user can edit (own entry or admin/manager)
  if (entry.userId !== user.id && user.role === "EMPLOYEE") {
    return { error: "You can only edit your own time entries" };
  }

  const validatedFields = updateTimeEntrySchema.safeParse({
    projectId: formData.get("projectId") || undefined,
    date: formData.get("date") || undefined,
    hours: formData.get("hours") || undefined,
    description: formData.get("description") || undefined,
    isBillable: formData.has("isBillable") ? formData.get("isBillable") === "true" : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }
  if (validatedFields.data.projectId && validatedFields.data.projectId !== entry.projectId) {
    await requireProjectRecordAccess(validatedFields.data.projectId);
  }

  const updated = await db.timeEntry.update({
    where: { id },
    data: validatedFields.data,
  });

  // Update project actual hours for both old and new project
  const projectsToUpdate = [entry.projectId];
  if (validatedFields.data.projectId && validatedFields.data.projectId !== entry.projectId) {
    projectsToUpdate.push(validatedFields.data.projectId);
  }

  for (const projectId of projectsToUpdate) {
    const totalHours = await db.timeEntry.aggregate({
      where: { projectId },
      _sum: { hours: true },
    });
    await db.project.update({
      where: { id: projectId },
      data: { actualHours: totalHours._sum.hours || 0 },
    });
  }

  await logActivity({
    action: "UPDATE",
    entityType: "time_entry",
    entityId: id,
    userId: entry.userId,
    createdById: user.id,
    metadata: { changes: Object.keys(validatedFields.data) },
  });

  revalidatePath("/work-tracking");
  return { success: true, data: updated };
}

export async function deleteTimeEntry(id: string) {
  const user = await requireAuth();

  const entry = await db.timeEntry.findUnique({ where: { id } });

  if (!entry) {
    return { error: "Time entry not found" };
  }
  await requireActionPermission("DELETE", "PROJECT");
  await requireProjectRecordAccess(entry.projectId);

  // Check if user can delete (own entry or admin/manager)
  if (entry.userId !== user.id && user.role === "EMPLOYEE") {
    return { error: "You can only delete your own time entries" };
  }

  await db.timeEntry.delete({ where: { id } });

  // Update project actual hours
  const totalHours = await db.timeEntry.aggregate({
    where: { projectId: entry.projectId },
    _sum: { hours: true },
  });

  await db.project.update({
    where: { id: entry.projectId },
    data: { actualHours: totalHours._sum.hours || 0 },
  });

  await logActivity({
    action: "DELETE",
    entityType: "time_entry",
    entityId: id,
    userId: entry.userId,
    createdById: user.id,
    metadata: { hours: entry.hours, projectId: entry.projectId },
  });

  revalidatePath("/work-tracking");
  revalidatePath(`/projects/${entry.projectId}`);
  return { success: true };
}

export async function getWeeklyTimesheet(userId: string, weekStart: Date) {
  const user = await requireModuleAccess("PROJECT");
  const targetUserId = user.role === "ADMIN" ? userId : user.id;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const entries = await db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
    orderBy: { date: "asc" },
  });

  // Group by day
  const days: Record<string, typeof entries> = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    days[day.toISOString().split("T")[0]] = [];
  }

  for (const entry of entries) {
    const dateKey = new Date(entry.date).toISOString().split("T")[0];
    if (days[dateKey]) {
      days[dateKey].push(entry);
    }
  }

  return { entries, days };
}
