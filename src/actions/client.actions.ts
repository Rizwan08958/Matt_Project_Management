"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { createClientSchema, updateClientSchema } from "@/lib/validations/client.schema";
import { logActivity } from "./activity-log.actions";

export interface ClientListItem {
  id: string;
  name: string;
  collegeName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  serviceName: string | null;
  projectName: string | null;
  tags: string | null;
  isActive: boolean;
  createdAt: Date;
  activityCount: number;
}

interface ClientRow extends Omit<ClientListItem, "activityCount"> {
  activityCount: bigint | number;
}

interface GetClientsInput {
  query?: string;
  page?: number;
  pageSize?: number;
}

async function requireClientModuleAccess() {
  const user = await requireAuth();
  if (user.role === "ADMIN") {
    return user;
  }

  const permissions = normalizeEmployeePermissions(user.permissions);
  const hasClientsModule = permissions.moduleAccess.includes("CRM");

  if (!hasClientsModule) {
    throw new Error("Forbidden: Missing module access CRM");
  }

  return user;
}

async function requireClientActionPermission(action: "CREATE" | "UPDATE" | "DELETE") {
  const user = await requireClientModuleAccess();
  if (user.role === "ADMIN") {
    return user;
  }

  const permissions = normalizeEmployeePermissions(user.permissions);
  if (!permissions.actionPermissions.includes(action)) {
    throw new Error(`Forbidden: Missing permission actionPermissions:${action}`);
  }

  return user;
}

export async function getClients(input: GetClientsInput = {}) {
  await requireClientModuleAccess();
  const query = input.query?.trim() || "";
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 10));
  const offset = (page - 1) * pageSize;

  const searchTerm = `%${query}%`;
  const whereClause = query
    ? Prisma.sql`
      WHERE
        c."name" ILIKE ${searchTerm}
        OR COALESCE(c."collegeName", '') ILIKE ${searchTerm}
        OR c."email" ILIKE ${searchTerm}
        OR COALESCE(c."phone", '') ILIKE ${searchTerm}
        OR COALESCE(c."country", '') ILIKE ${searchTerm}
        OR COALESCE(c."serviceName", '') ILIKE ${searchTerm}
        OR COALESCE(c."projectName", '') ILIKE ${searchTerm}
        OR COALESCE(c."tags", '') ILIKE ${searchTerm}
    `
    : Prisma.empty;

  const countRows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "clients" c
    ${whereClause}
  `;

  const clients = await db.$queryRaw<ClientRow[]>`
    SELECT
      c."id",
      c."name",
      c."collegeName",
      c."email",
      c."phone",
      c."country",
      c."serviceName",
      c."projectName",
      c."tags",
      c."isActive",
      c."createdAt",
      COUNT(a."id")::bigint AS "activityCount"
    FROM "clients" c
    LEFT JOIN "activity_logs" a
      ON a."entityType" = 'client'
      AND a."entityId" = c."id"
    ${whereClause}
    GROUP BY c."id"
    ORDER BY c."createdAt" DESC
    OFFSET ${offset}
    LIMIT ${pageSize}
  `;

  const total = Number(countRows[0]?.count || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const items: ClientListItem[] = clients.map((client) => ({
    ...client,
    activityCount: Number(client.activityCount || 0),
  }));

  return {
    clients: items,
    total,
    pages,
    page,
    pageSize,
    query,
  };
}

export async function getClient(id: string) {
  await requireClientModuleAccess();
  const rows = await db.$queryRaw<
    {
      id: string;
      name: string;
      collegeName: string | null;
      email: string;
      phone: string | null;
      street: string | null;
      city: string | null;
      zip: string | null;
      state: string | null;
      country: string | null;
      serviceName: string | null;
      projectName: string | null;
      tags: string | null;
      address: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >`
    SELECT
      "id",
      "name",
      "collegeName",
      "email",
      "phone",
      "street",
      "city",
      "zip",
      "state",
      "country",
      "serviceName",
      "projectName",
      "tags",
      "address",
      "notes",
      "isActive",
      "createdAt",
      "updatedAt"
    FROM "clients"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function createClient(formData: FormData) {
  const user = await requireClientActionPermission("CREATE");

  const validatedFields = createClientSchema.safeParse({
    name: formData.get("name"),
    collegeName: formData.get("collegeName") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    street: formData.get("street") || undefined,
    city: formData.get("city") || undefined,
    zip: formData.get("zip") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    serviceName: formData.get("serviceName") || undefined,
    projectName: formData.get("projectName") || undefined,
    tags: formData.get("tags") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }
  const email = validatedFields.data.email.trim().toLowerCase();
  let client: { id: string; name: string; email: string };

  try {
    client = await db.client.create({
      data: {
        name: validatedFields.data.name,
        collegeName: validatedFields.data.collegeName || null,
        email,
        phone: validatedFields.data.phone || null,
        street: validatedFields.data.street || null,
        city: validatedFields.data.city || null,
        zip: validatedFields.data.zip || null,
        state: validatedFields.data.state || null,
        country: validatedFields.data.country || null,
        serviceName: validatedFields.data.serviceName || null,
        projectName: validatedFields.data.projectName || null,
        tags: validatedFields.data.tags || null,
        address: validatedFields.data.address || null,
        notes: validatedFields.data.notes || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "Email already exists" };
      }
      if (error.code === "P2024") {
        return {
          error:
            "Database is busy right now. Please try again in a few seconds.",
        };
      }
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return {
        error:
          "Cannot connect to the database right now. Please check your DB connection and try again.",
      };
    }

    return {
      error:
        "Unable to create client due to a temporary server issue. Please try again.",
    };
  }

  await logActivity({
    action: "CREATE",
    entityType: "client",
    entityId: client.id,
    createdById: user.id,
    metadata: { name: client.name, email: client.email },
  });

  revalidatePath("/clients");
  return { success: true, data: client };
}

export async function updateClient(id: string, formData: FormData) {
  const user = await requireClientActionPermission("UPDATE");

  const validatedFields = updateClientSchema.safeParse({
    name: formData.get("name") || undefined,
    collegeName: formData.get("collegeName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    street: formData.get("street") || undefined,
    city: formData.get("city") || undefined,
    zip: formData.get("zip") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    serviceName: formData.get("serviceName") || undefined,
    projectName: formData.get("projectName") || undefined,
    tags: formData.get("tags") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
    isActive: formData.get("isActive")
      ? formData.get("isActive") === "true"
      : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const current = await getClient(id);
  if (!current) {
    return { error: "Client not found" };
  }

  if (validatedFields.data.email && validatedFields.data.email !== current.email) {
    const existing = await db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "clients" WHERE "email" = ${validatedFields.data.email} AND "id" <> ${id} LIMIT 1
    `;

    if (existing.length > 0) {
      return { error: "Email already exists" };
    }
  }

  const rows = await db.$queryRaw<
    {
      id: string;
      name: string;
      email: string;
      isActive: boolean;
    }[]
  >`
    UPDATE "clients"
    SET
      "name" = ${validatedFields.data.name ?? current.name},
      "collegeName" = ${validatedFields.data.collegeName ?? current.collegeName},
      "email" = ${validatedFields.data.email ?? current.email},
      "phone" = ${validatedFields.data.phone ?? current.phone},
      "street" = ${validatedFields.data.street ?? current.street},
      "city" = ${validatedFields.data.city ?? current.city},
      "zip" = ${validatedFields.data.zip ?? current.zip},
      "state" = ${validatedFields.data.state ?? current.state},
      "country" = ${validatedFields.data.country ?? current.country},
      "serviceName" = ${validatedFields.data.serviceName ?? current.serviceName},
      "projectName" = ${validatedFields.data.projectName ?? current.projectName},
      "tags" = ${validatedFields.data.tags ?? current.tags},
      "address" = ${validatedFields.data.address ?? current.address},
      "notes" = ${validatedFields.data.notes ?? current.notes},
      "isActive" = ${validatedFields.data.isActive ?? current.isActive},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING "id", "name", "email", "isActive"
  `;

  const updated = rows[0];

  await logActivity({
    action: "UPDATE",
    entityType: "client",
    entityId: id,
    createdById: user.id,
    metadata: { changes: Object.keys(validatedFields.data) },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true, data: updated };
}

export async function deleteClient(id: string) {
  const user = await requireClientActionPermission("DELETE");
  const client = await getClient(id);

  if (!client) {
    return { error: "Client not found" };
  }

  await db.$executeRaw`
    DELETE FROM "clients" WHERE "id" = ${id}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "client",
    entityId: id,
    createdById: user.id,
    metadata: { name: client.name, email: client.email },
  });

  revalidatePath("/clients");
  return { success: true };
}

export async function toggleClientStatus(id: string) {
  const client = await getClient(id);

  if (!client) {
    return { error: "Client not found" };
  }

  const formData = new FormData();
  formData.set("name", client.name);
  if (client.collegeName) formData.set("collegeName", client.collegeName);
  formData.set("email", client.email);
  if (client.phone) formData.set("phone", client.phone);
  if (client.street) formData.set("street", client.street);
  if (client.city) formData.set("city", client.city);
  if (client.zip) formData.set("zip", client.zip);
  if (client.state) formData.set("state", client.state);
  if (client.country) formData.set("country", client.country);
  if (client.serviceName) formData.set("serviceName", client.serviceName);
  if (client.projectName) formData.set("projectName", client.projectName);
  if (client.tags) formData.set("tags", client.tags);
  if (client.address) formData.set("address", client.address);
  if (client.notes) formData.set("notes", client.notes);
  formData.set("isActive", (!client.isActive).toString());

  return updateClient(id, formData);
}

export async function addClientNote(id: string, note: string) {
  const user = await requireClientActionPermission("UPDATE");
  const trimmed = note.trim();

  if (!trimmed) {
    return { error: "Note is required" };
  }

  const client = await getClient(id);
  if (!client) {
    return { error: "Client not found" };
  }

  await logActivity({
    action: "UPDATE",
    entityType: "client",
    entityId: id,
    createdById: user.id,
    metadata: {
      note: trimmed,
      name: client.name,
      email: client.email,
    },
  });

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { success: true };
}

export async function getClientActivityLogs(clientId: string, limit = 20) {
  await requireClientModuleAccess();

  return db.activityLog.findMany({
    where: {
      entityType: "client",
      entityId: clientId,
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: {
      createdBy: { select: { name: true } },
    },
  });
}
