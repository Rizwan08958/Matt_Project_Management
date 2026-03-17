"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export interface CrmProjectTypeItem {
  id: string;
  name: string;
  budget: number;
  category: string;
  gstPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PROJECT_TYPES: Array<{ name: string; budget: number }> = [
  { name: "Hardware Project", budget: 15000 },
  { name: "Software Project", budget: 10000 },
  { name: "Internship Project", budget: 5000 },
];

function deriveCategory(name: string) {
  const value = name.trim().toLowerCase();
  if (value.includes("hardware")) return "Hardware";
  if (value.includes("software")) return "Software";
  if (value.includes("internship")) return "Internship";
  if (value.includes("support")) return "Support";
  return "Other";
}

async function ensureCrmProjectTypesTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_project_types" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "category" TEXT NULL,
      "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_project_types_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_project_types_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_project_types_name_idx"
    ON "crm_project_types" ("name")
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_project_types_name_lower_unique_idx"
    ON "crm_project_types" (LOWER("name"))
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "category" TEXT NULL
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18
  `;
}

async function seedDefaultProjectTypesIfEmpty() {
  const countRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count" FROM "crm_project_types"
  `;
  const total = Number(countRows[0]?.count || 0);
  if (total > 0) return;

  const userRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "users"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;
  const createdById = userRows[0]?.id;
  if (!createdById) return;

  for (const entry of DEFAULT_PROJECT_TYPES) {
    await db.$executeRaw`
      INSERT INTO "crm_project_types" (
        "id",
        "name",
        "budget",
        "category",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${entry.name},
        ${entry.budget},
        ${deriveCategory(entry.name)},
        ${createdById},
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function getCrmProjectTypes() {
  await ensureCrmProjectTypesTable();
  await seedDefaultProjectTypesIfEmpty();
  return db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      cpt."id",
      cpt."name",
      cpt."budget",
      COALESCE(cpt."gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF(cpt."category", ''), CASE
        WHEN LOWER(cpt."name") LIKE '%hardware%' THEN 'Hardware'
        WHEN LOWER(cpt."name") LIKE '%software%' THEN 'Software'
        WHEN LOWER(cpt."name") LIKE '%internship%' THEN 'Internship'
        WHEN LOWER(cpt."name") LIKE '%support%' THEN 'Support'
        ELSE 'Other'
      END) AS "category",
      cpt."createdAt",
      cpt."updatedAt"
    FROM "crm_project_types" cpt
    ORDER BY cpt."createdAt" DESC
  `;
}

export async function getCrmProjectTypeById(id: string) {
  await ensureCrmProjectTypesTable();
  const rows = await db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      cpt."id",
      cpt."name",
      cpt."budget",
      COALESCE(cpt."gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF(cpt."category", ''), CASE
        WHEN LOWER(cpt."name") LIKE '%hardware%' THEN 'Hardware'
        WHEN LOWER(cpt."name") LIKE '%software%' THEN 'Software'
        WHEN LOWER(cpt."name") LIKE '%internship%' THEN 'Internship'
        WHEN LOWER(cpt."name") LIKE '%support%' THEN 'Support'
        ELSE 'Other'
      END) AS "category",
      cpt."createdAt",
      cpt."updatedAt"
    FROM "crm_project_types" cpt
    WHERE cpt."id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function createCrmProjectType(formData: FormData) {
  const user = await requireAdmin();
  await ensureCrmProjectTypesTable();

  const rawName = formData.get("name");
  const rawBudget = formData.get("budget");
  const rawCategory = formData.get("category");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const budget = Number(rawBudget || 0);
  const category =
    typeof rawCategory === "string" && rawCategory.trim() ? rawCategory.trim() : deriveCategory(name);

  if (!name) {
    return { error: "Project type is required" };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: "Budget must be greater than 0" };
  }

  await db.$executeRaw`
    INSERT INTO "crm_project_types" (
      "id",
      "name",
      "budget",
      "category",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${name},
      ${budget},
      ${category},
      ${user.id},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
  `;

  const rows = await db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      "id",
      "name",
      "budget",
      COALESCE("gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF("category", ''), ${category}) AS "category",
      "createdAt",
      "updatedAt"
    FROM "crm_project_types"
    WHERE LOWER("name") = LOWER(${name})
    LIMIT 1
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  return { success: true, data: rows[0] };
}

export async function deleteCrmProjectType(id: string) {
  await requireAdmin();
  await ensureCrmProjectTypesTable();

  await db.$executeRaw`
    DELETE FROM "crm_project_types"
    WHERE "id" = ${id}
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  return { success: true };
}

export async function updateCrmProjectType(id: string, formData: FormData) {
  await requireAdmin();
  await ensureCrmProjectTypesTable();

  const rawName = formData.get("name");
  const rawBudget = formData.get("budget");
  const rawCategory = formData.get("category");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const budget = Number(rawBudget || 0);
  const category =
    typeof rawCategory === "string" && rawCategory.trim() ? rawCategory.trim() : deriveCategory(name);

  if (!id) {
    return { error: "Project type id is required" };
  }
  if (!name) {
    return { error: "Project type is required" };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: "Budget must be greater than 0" };
  }

  await db.$executeRaw`
    UPDATE "crm_project_types"
    SET
      "name" = ${name},
      "budget" = ${budget},
      "category" = ${category},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  return { success: true };
}
