"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee.schema";
import { parseEmployeePermissionsFromFormData } from "@/lib/employee-permissions";
import { logActivity } from "./activity-log.actions";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

export async function getEmployees() {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      permissions: true,
      phone: true,
      hireDate: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          assignments: { where: { isActive: true } },
          timeEntries: true,
        },
      },
    },
  });
}

export async function getEmployee(id: string) {
  return db.user.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          project: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
      },
      timeEntries: {
        orderBy: { date: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

export async function createEmployee(formData: FormData) {
  const admin = await requireAdmin();

  const validatedFields = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate") || undefined,
    permissions: parseEmployeePermissionsFromFormData(formData),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password, permissions, ...data } = validatedFields.data;

  const existingUser = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    return { error: "Email already in use" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const createData: Prisma.UserCreateInput = {
    ...data,
    password: hashedPassword,
    permissions,
  };

  const employee = await db.user.create({ data: createData });

  await logActivity({
    action: "CREATE",
    entityType: "user",
    entityId: employee.id,
    userId: employee.id,
    createdById: admin.id,
    metadata: { name: employee.name, email: employee.email, role: employee.role },
  });

  revalidatePath("/employees");
  return { success: true, data: employee };
}

export async function updateEmployee(id: string, formData: FormData) {
  const admin = await requireAdmin();

  const validatedFields = updateEmployeeSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
    role: formData.get("role") || undefined,
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate") || undefined,
    isActive: formData.get("isActive") === "true",
    permissions: parseEmployeePermissionsFromFormData(formData),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password, permissions, ...data } = validatedFields.data;

  // Check if email is being changed and if it's already in use
  if (data.email) {
    const existingUser = await db.user.findFirst({
      where: { email: data.email, NOT: { id } },
    });

    if (existingUser) {
      return { error: "Email already in use" };
    }
  }

  const updateData: Prisma.UserUpdateInput = { ...data };

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }
  updateData.permissions = permissions;

  const employee = await db.user.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    userId: id,
    createdById: admin.id,
    metadata: { changes: Object.keys(data) },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { success: true, data: employee };
}

export async function deleteEmployee(id: string) {
  const admin = await requireAdmin();

  const employee = await db.user.findUnique({ where: { id } });

  if (!employee) {
    return { error: "Employee not found" };
  }

  if (employee.id === admin.id) {
    return { error: "Cannot delete yourself" };
  }

  await db.user.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "user",
    entityId: id,
    createdById: admin.id,
    metadata: { name: employee.name, email: employee.email },
  });

  revalidatePath("/employees");
  return { success: true };
}

export async function toggleEmployeeStatus(id: string) {
  const admin = await requireAdmin();

  const employee = await db.user.findUnique({ where: { id } });

  if (!employee) {
    return { error: "Employee not found" };
  }

  if (employee.id === admin.id) {
    return { error: "Cannot deactivate yourself" };
  }

  const updated = await db.user.update({
    where: { id },
    data: { isActive: !employee.isActive },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    userId: id,
    createdById: admin.id,
    metadata: { isActive: updated.isActive },
  });

  revalidatePath("/employees");
  return { success: true, data: updated };
}
