"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActionPermission, requireAdmin, requireModuleAccess } from "@/lib/auth";
import {
  sanitizeListByFieldPermissions,
  sanitizeRecordByFieldPermissions,
  stripRestrictedFormFields,
} from "@/lib/employee-permissions";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";
import {
  createQuotationSchema,
  paymentTypeSchema,
  upsertInvoiceSchema,
} from "@/lib/validations/quotation.schema";
import { logActivity } from "./activity-log.actions";

export type QuotationStatus = "DRAFT" | "SENT";
export type PaymentType = "FIXED" | "PERCENTAGE" | "MONTHLY";

export interface CrmQuotationItem {
  id: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  serviceName: string | null;
  unitName: string | null;
  unitCount: number | null;
  unitPrice: number | null;
  gstPercent: number | null;
  subtotalAmount: number | null;
  gstAmount: number | null;
  totalAmount: number | null;
  terms: string | null;
  notes: string | null;
  validUntil: Date | null;
  status: QuotationStatus;
  sentAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmQuotationLineItem {
  id: string;
  quotationId: string;
  name: string;
  unitCount: number;
  amount: number;
  gstPercent: number;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationInvoiceItem {
  id: string;
  quotationId: string;
  paymentType: PaymentType;
  amount: number | null;
  percentage: number | null;
  months: number | null;
  balanceAmount: number | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationPaymentItem {
  id: string;
  quotationId: string;
  paymentType: PaymentType;
  amount: number;
  percentage: number | null;
  months: number | null;
  paidAmount: number;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const QUOTATION_PREFIX = "Q-";
const QUOTATION_PAD = 6;

const formatQuotationNo = (value: number) => {
  const safeValue = Math.max(1, Math.floor(value));
  return `${QUOTATION_PREFIX}${String(safeValue).padStart(QUOTATION_PAD, "0")}`;
};

async function getNextQuotationNo() {
  const rows = await db.$queryRaw<Array<{ maxNo: number | null }>>`
    SELECT MAX(
      NULLIF(regexp_replace("quotationNo", '[^0-9]', '', 'g'), '')::int
    ) AS "maxNo"
    FROM "crm_quotations"
  `;
  const currentMax = rows[0]?.maxNo ?? 0;
  return formatQuotationNo(currentMax + 1);
}

export async function generateQuotationNo() {
  return getNextQuotationNo();
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const escapePdfText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function buildSimplePdf(lines: string[]) {
  const safeLines = lines.slice(0, 46);
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    ...safeLines.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      index === safeLines.length - 1 ? "" : "0 -14 Td",
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function createQuotationPdfBuffer(quotation: CrmQuotationItem, items: CrmQuotationLineItem[]) {
  const validUntilText = quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "N/A";
  const formatAmount = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);
  const lines = [
    `Quotation ${quotation.quotationNo}`,
    `Title: ${quotation.title}`,
    `Client: ${quotation.clientName}`,
    `Email: ${quotation.clientEmail}`,
    `Project: ${quotation.projectTitle}`,
    `Service: ${quotation.serviceName || "N/A"}`,
    `Valid Until: ${validUntilText}`,
    "",
    "Items:",
  ];

  if (items.length > 0) {
    for (const [index, item] of items.entries()) {
      const tax = round2(item.amount * (item.gstPercent / 100));
      const total = round2(item.amount + tax);
      lines.push(
        `${index + 1}. ${item.name} | Qty ${item.unitCount} | Subtotal ${item.amount.toFixed(2)} | GST ${item.gstPercent.toFixed(2)}% (${tax.toFixed(2)}) | Total ${total.toFixed(2)}`,
      );
    }
  } else {
    const unitCount = quotation.unitCount ?? 0;
    const subtotalAmount = quotation.subtotalAmount ?? 0;
    const gstPercent = quotation.gstPercent ?? 0;
    const gstAmount = quotation.gstAmount ?? 0;
    const totalAmount = quotation.totalAmount ?? 0;
    lines.push(
      `1. ${quotation.serviceName || quotation.projectTitle} | Qty ${quotation.unitCount ?? 0} | Subtotal ${formatAmount(quotation.subtotalAmount)} | GST ${formatAmount(quotation.gstPercent)}% (${formatAmount(quotation.gstAmount)}) | Total ${formatAmount(quotation.totalAmount)}`,
    );
  }

  const subtotalAmount = quotation.subtotalAmount ?? 0;
  const gstAmount = quotation.gstAmount ?? 0;
  const totalAmount = quotation.totalAmount ?? 0;
  lines.push("");
  lines.push(`Subtotal: ${formatAmount(quotation.subtotalAmount)}`);
  lines.push(`GST: ${formatAmount(quotation.gstAmount)}`);
  lines.push(`Grand Total: ${formatAmount(quotation.totalAmount)}`);
  if (quotation.terms) lines.push(`Terms: ${quotation.terms}`);
  if (quotation.notes) lines.push(`Notes: ${quotation.notes}`);

  return buildSimplePdf(lines);
}

async function ensureQuotationPaymentsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_quotation_payments" (
      "id" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "paymentType" "PaymentType" NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "percentage" DOUBLE PRECISION,
      "months" INTEGER,
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_quotation_payments_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_quotation_payments_quotationId_fkey"
        FOREIGN KEY ("quotationId") REFERENCES "crm_quotations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "crm_quotation_payments_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_quotation_payments"
    ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_quotation_payments_quotationId_createdAt_idx"
    ON "crm_quotation_payments" ("quotationId", "createdAt" DESC)
  `;
}

async function ensureDeletedInvoicesTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_deleted_invoices" (
      "id" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "crmLeadId" TEXT NOT NULL,
      "invoiceRef" TEXT NOT NULL,
      "orderNo" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "salespersonName" TEXT,
      "status" TEXT NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "invoiceCreatedAt" TIMESTAMP(3) NOT NULL,
      "deletedById" TEXT NOT NULL,
      "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "notes" TEXT,
      CONSTRAINT "crm_deleted_invoices_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_deleted_invoices_invoiceId_key"
    ON "crm_deleted_invoices" ("invoiceId")
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_deleted_invoices_deletedAt_idx"
    ON "crm_deleted_invoices" ("deletedAt" DESC)
  `;
}

function buildInvoiceRef(createdAt: Date, quotationNo: string) {
  const cleanedOrder = quotationNo.replace(/^QT?-/, "");
  return `INV/${new Date(createdAt).getFullYear()}/${cleanedOrder}`;
}

async function getQuotationPaidTotal(quotationId: string) {
  await ensureQuotationPaymentsTable();
  const rows = await db.$queryRaw<Array<{ paidTotal: number | null }>>`
    SELECT COALESCE(SUM("paidAmount"), 0) AS "paidTotal"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
  `;
  return round2(Number(rows[0]?.paidTotal || 0));
}

async function syncInvoiceSummary(quotationId: string, quotationTotal: number, userId: string) {
  const paidAmount = await getQuotationPaidTotal(quotationId);
  const balanceAmount = round2(Math.max(quotationTotal - paidAmount, 0));
  const latest = await db.$queryRaw<Array<{ paymentType: PaymentType }>>`
    SELECT "paymentType"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const paymentType = latest[0]?.paymentType ?? "FIXED";
  const existing = await getQuotationInvoice(quotationId);

  if (existing) {
    await db.$executeRaw`
      UPDATE "crm_quotation_invoices"
      SET
        "paymentType" = ${paymentType}::"PaymentType",
        "amount" = ${paidAmount},
        "percentage" = NULL,
        "months" = NULL,
        "balanceAmount" = ${balanceAmount},
        "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "crm_quotation_invoices" (
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "balanceAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${quotationId},
        ${paymentType}::"PaymentType",
        ${paidAmount},
        NULL,
        NULL,
        ${balanceAmount},
        NULL,
        ${userId},
        NOW(),
        NOW()
      )
    `;
  }

  return { paidAmount, balanceAmount };
}

function buildCrmScopeFilterSql(alias: string, allowedCreatorIds: string[] | null) {
  if (allowedCreatorIds === null) {
    return Prisma.sql`TRUE`;
  }

  if (allowedCreatorIds.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`(${Prisma.raw(alias)}."createdById" IN (${Prisma.join(allowedCreatorIds)}) OR ${Prisma.raw(alias)}."ownerId" IN (${Prisma.join(allowedCreatorIds)}))`;
}

async function canAccessCrmLeadForUser(
  crmLeadId: string,
  input: {
    userId: string;
    role: string;
    permissions: unknown;
  }
) {
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    input.userId,
    input.role,
    input.permissions as { recordRules?: string[] } | null
  );
  if (allowedCreatorIds === null) return true;
  if (allowedCreatorIds.length === 0) return false;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${crmLeadId}
      AND ("createdById" IN (${Prisma.join(allowedCreatorIds)}) OR "ownerId" IN (${Prisma.join(allowedCreatorIds)}))
    LIMIT 1
  `;
  return rows.length > 0;
}

async function canAccessQuotationForUser(
  quotationId: string,
  input: {
    userId: string;
    role: string;
    permissions: unknown;
  }
) {
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    input.userId,
    input.role,
    input.permissions as { recordRules?: string[] } | null
  );
  if (allowedCreatorIds === null) return true;
  if (allowedCreatorIds.length === 0) return false;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT q."id"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."id" = ${quotationId}
      AND (l."createdById" IN (${Prisma.join(allowedCreatorIds)}) OR l."ownerId" IN (${Prisma.join(allowedCreatorIds)}))
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getLeadQuotations(crmLeadId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return [];
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."unitName",
      q."unitCount",
      q."unitPrice",
      q."gstPercent",
      q."subtotalAmount",
      q."gstAmount",
      q."totalAmount",
      q."terms",
      q."notes",
      q."validUntil",
      q."status",
      q."sentAt",
      q."createdById",
      q."createdAt",
      q."updatedAt"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."crmLeadId" = ${crmLeadId} AND ${leadScopeFilter}
    ORDER BY q."createdAt" DESC
  `;

  if (user.role === "ADMIN") {
    return rows;
  }

  return sanitizeListByFieldPermissions(
    rows as unknown as Record<string, unknown>[],
    user.permissions
  ) as unknown as CrmQuotationItem[];
}

export async function getAllCrmQuotations() {
  return db.$queryRaw<
    Array<
      Pick<
        CrmQuotationItem,
        "id" | "crmLeadId" | "quotationNo" | "title" | "clientName" | "status" | "totalAmount" | "createdAt"
      > & { salespersonName: string | null }
    >
  >`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."status",
      q."totalAmount",
      q."createdAt",
      u."name" AS "salespersonName"
    FROM "crm_quotations" q
    LEFT JOIN "users" u
      ON u."id" = q."createdById"
    ORDER BY q."createdAt" DESC
  `;
}

export async function getCrmQuotation(id: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."unitName",
      q."unitCount",
      q."unitPrice",
      q."gstPercent",
      q."subtotalAmount",
      q."gstAmount",
      q."totalAmount",
      q."terms",
      q."notes",
      q."validUntil",
      q."status",
      q."sentAt",
      q."createdById",
      q."createdAt",
      q."updatedAt"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  const quotation = rows[0] || null;
  if (!quotation) return null;
  if (user.role === "ADMIN") return quotation;

  return sanitizeRecordByFieldPermissions(
    quotation as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as CrmQuotationItem;
}

export async function getQuotationItems(quotationId: string) {
  return db.$queryRaw<CrmQuotationLineItem[]>`
    SELECT
      "id",
      "quotationId",
      "name",
      "unitCount",
      "amount",
      "gstPercent",
      "tags",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" ASC
  `;
}

const normalizeItems = (items: Array<Partial<CrmQuotationLineItem>>) =>
  items
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      name: String(item.name || "").trim(),
      unitCount: Math.max(1, Number(item.unitCount || 1)),
      amount: Math.max(0, Number(item.amount || 0)),
      gstPercent: Math.max(0, Number(item.gstPercent || 0)),
      tags: item.tags ? String(item.tags).trim() : null,
    }))
    .filter((item) => item.name.length > 0);

export async function upsertQuotationItems(quotationId: string, items: Array<Partial<CrmQuotationLineItem>>) {
  const user = await requireAdmin();
  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const normalized = normalizeItems(items);

  await db.$executeRaw`
    DELETE FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
  `;

  for (const item of normalized) {
    await db.$executeRaw`
      INSERT INTO "crm_quotation_items" (
        "id",
        "quotationId",
        "name",
        "unitCount",
        "amount",
        "gstPercent",
        "tags",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${item.id},
        ${quotationId},
        ${item.name},
        ${item.unitCount},
        ${item.amount},
        ${item.gstPercent},
        ${item.tags},
        NOW(),
        NOW()
      )
    `;
  }

  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = normalized.reduce((sum, item) => sum + item.amount * (item.gstPercent / 100), 0);
  const totalAmount = subtotal + gstAmount;
  const gstPercent = subtotal > 0 ? (gstAmount / subtotal) * 100 : 0;
  const primaryName = normalized[0]?.name || quotation.serviceName || quotation.projectTitle;

  await db.$executeRaw`
    UPDATE "crm_quotations"
    SET
      "serviceName" = ${primaryName},
      "unitName" = 'Project',
      "unitCount" = 1,
      "unitPrice" = ${subtotal},
      "gstPercent" = ${gstPercent},
      "subtotalAmount" = ${subtotal},
      "gstAmount" = ${gstAmount},
      "totalAmount" = ${totalAmount},
      "updatedAt" = NOW()
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      itemsUpdated: true,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  return { success: true };
}

export async function createCrmQuotation(crmLeadId: string, formData: FormData) {
  const user = await requireActionPermission("CREATE", "SALES");
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  if (
    user.role !== "ADMIN" &&
    !(await canAccessCrmLeadForUser(crmLeadId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const leadRows = await db.$queryRaw<Array<{ id: string; title: string; clientName: string | null; email: string | null }>>`
    SELECT "id", "title", "clientName", "email"
    FROM "crm_leads"
    WHERE "id" = ${crmLeadId}
    LIMIT 1
  `;

  if (leadRows.length === 0) {
    return { error: "CRM lead not found" };
  }

  const parsed = createQuotationSchema.safeParse({
    title: formData.get("title"),
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    projectTitle: formData.get("projectTitle"),
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount"),
    unitPrice: formData.get("unitPrice"),
    gstPercent: formData.get("gstPercent"),
    terms: formData.get("terms") || undefined,
    notes: formData.get("notes") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const sendNow = formData.get("sendNow") === "true";

  const rawItems = formData.get("items");
  const parsedItems = typeof rawItems === "string"
    ? normalizeItems(JSON.parse(rawItems))
    : [];

  const itemsSubtotal = parsedItems.length > 0
    ? parsedItems.reduce((sum, item) => sum + item.amount, 0)
    : parsed.data.unitCount * parsed.data.unitPrice;
  const itemsGstAmount = parsedItems.length > 0
    ? parsedItems.reduce((sum, item) => sum + item.amount * (item.gstPercent / 100), 0)
    : itemsSubtotal * (parsed.data.gstPercent / 100);
  const subtotalAmount = round2(itemsSubtotal);
  const gstAmount = round2(itemsGstAmount);
  const totalAmount = round2(subtotalAmount + gstAmount);
  const derivedGstPercent = subtotalAmount > 0 ? round2((gstAmount / subtotalAmount) * 100) : parsed.data.gstPercent;
  const derivedServiceName = parsedItems[0]?.name || parsed.data.serviceName || parsed.data.projectTitle;
  const rawQuotationNo = formData.get("quotationNo");
  const quotationNo = typeof rawQuotationNo === "string" && rawQuotationNo.trim()
    ? rawQuotationNo.trim()
    : await getNextQuotationNo();
  const id = crypto.randomUUID();

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    INSERT INTO "crm_quotations" (
      "id",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "clientEmail",
      "projectTitle",
      "serviceName",
      "unitName",
      "unitCount",
      "unitPrice",
      "gstPercent",
      "subtotalAmount",
      "gstAmount",
      "totalAmount",
      "terms",
      "notes",
      "validUntil",
      "status",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${crmLeadId},
      ${quotationNo},
      ${parsed.data.title},
      ${parsed.data.clientName},
      ${parsed.data.clientEmail},
      ${parsed.data.projectTitle},
      ${derivedServiceName || null},
      ${parsed.data.unitName || null},
      ${parsed.data.unitCount},
      ${parsed.data.unitPrice},
      ${derivedGstPercent},
      ${subtotalAmount},
      ${gstAmount},
      ${totalAmount},
      ${parsed.data.terms || null},
      ${parsed.data.notes || null},
      ${parsed.data.validUntil ?? null},
      'DRAFT'::"QuotationStatus",
      ${user.id},
      NOW(),
      NOW()
    )
    RETURNING
      "id",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "clientEmail",
      "projectTitle",
      "serviceName",
      "unitName",
      "unitCount",
      "unitPrice",
      "gstPercent",
      "subtotalAmount",
      "gstAmount",
      "totalAmount",
      "terms",
      "notes",
      "validUntil",
      "status",
      "sentAt",
      "createdById",
      "createdAt",
      "updatedAt"
  `;

  await logActivity({
    action: "CREATE",
    entityType: "crm_quotation",
    entityId: id,
    createdById: user.id,
    metadata: {
      crmLeadId,
      quotationNo,
      totalAmount,
    },
  });

  let mailMessage: string | undefined;
  let mailSent = false;
  let createdQuotation = rows[0];

  if (parsedItems.length > 0) {
    for (const item of parsedItems) {
      await db.$executeRaw`
        INSERT INTO "crm_quotation_items" (
          "id",
          "quotationId",
          "name",
          "unitCount",
          "amount",
          "gstPercent",
          "tags",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${item.id},
          ${id},
          ${item.name},
          ${item.unitCount},
          ${item.amount},
          ${item.gstPercent},
          ${item.tags},
          NOW(),
          NOW()
        )
      `;
    }
  }

  if (sendNow) {
    const mail = await sendQuotationEmail(rows[0]);
    mailMessage = mail.message;
    mailSent = mail.sent;

    if (mail.sent) {
      const sentRows = await db.$queryRaw<CrmQuotationItem[]>`
        UPDATE "crm_quotations"
        SET
          "status" = 'SENT'::"QuotationStatus",
          "sentAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${rows[0].id}
        RETURNING
          "id",
          "crmLeadId",
          "quotationNo",
          "title",
          "clientName",
          "clientEmail",
          "projectTitle",
          "serviceName",
          "unitName",
          "unitCount",
          "unitPrice",
          "gstPercent",
          "subtotalAmount",
          "gstAmount",
          "totalAmount",
          "terms",
          "notes",
          "validUntil",
          "status",
          "sentAt",
          "createdById",
          "createdAt",
          "updatedAt"
      `;
      createdQuotation = sentRows[0];

      await logActivity({
        action: "UPDATE",
        entityType: "crm_quotation",
        entityId: rows[0].id,
        createdById: user.id,
        metadata: {
          status: "SENT",
          email: rows[0].clientEmail,
          mailSent: true,
        },
      });
    }
  }

  revalidatePath(`/crm/${crmLeadId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${crmLeadId}/quotations`);
  revalidatePath(`/crm/${crmLeadId}/quotations/${id}`);
  return {
    success: true,
    data: createdQuotation,
    mailSent,
    mailMessage,
  };
}

async function sendQuotationEmail(quotation: CrmQuotationItem) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, message: "Mail provider not configured. Set RESEND_API_KEY and MAIL_FROM." };
  }

  const items = await getQuotationItems(quotation.id);
  const pdfBuffer = createQuotationPdfBuffer(quotation, items);
  const itemsHtml = items.length
    ? `
      <h3 style="margin:16px 0 8px;">Line Items</h3>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#d1d5db;">
        <thead style="background:#f8fafc;">
          <tr>
            <th align="left">Item</th>
            <th align="right">Qty</th>
            <th align="right">Amount</th>
            <th align="right">GST %</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td align="right">${item.unitCount}</td>
                  <td align="right">${item.amount.toFixed(2)}</td>
                  <td align="right">${item.gstPercent.toFixed(2)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `
    : "";
  const validUntilText = quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "N/A";
  const formatAmount = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);
  const termsHtml = quotation.terms
    ? `<p><strong>Terms:</strong> ${escapeHtml(quotation.terms)}</p>`
    : "";
  const notesHtml = quotation.notes
    ? `<p><strong>Notes:</strong> ${escapeHtml(quotation.notes)}</p>`
    : "";
  const subtotalDisplay = Number(quotation.subtotalAmount || 0).toFixed(2);
  const gstDisplay = Number(quotation.gstAmount || 0).toFixed(2);
  const totalDisplay = Number(quotation.totalAmount || 0).toFixed(2);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [quotation.clientEmail],
      subject: `Quotation ${quotation.quotationNo} - ${quotation.projectTitle}`,
      attachments: [
        {
          filename: `Quotation-${quotation.quotationNo}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
      html: `
        <p>Hello ${escapeHtml(quotation.clientName)},</p>
        <p>Please find your quotation details below and the attached PDF document.</p>
        <ul>
          <li><strong>Quotation No:</strong> ${escapeHtml(quotation.quotationNo)}</li>
          <li><strong>Project:</strong> ${escapeHtml(quotation.projectTitle)}</li>
          <li><strong>Service:</strong> ${escapeHtml(quotation.serviceName || "N/A")}</li>
          <li><strong>Valid Until:</strong> ${validUntilText}</li>
          <li><strong>Subtotal:</strong> ${formatAmount(quotation.subtotalAmount)}</li>
          <li><strong>GST:</strong> ${formatAmount(quotation.gstAmount)}</li>
          <li><strong>Total:</strong> ${formatAmount(quotation.totalAmount)}</li>
        </ul>
        ${itemsHtml}
        ${termsHtml}
        ${notesHtml}
        <p>Thanks.</p>
      `,
    }),
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    return { sent: false, message: `Email failed: ${errorText}` };
  }

  return { sent: true, message: "Quotation email sent" };
}

export async function sendCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("UPDATE", "SALES");
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const mail = await sendQuotationEmail(quotation);

  if (mail.sent) {
    await db.$executeRaw`
      UPDATE "crm_quotations"
      SET
        "status" = 'SENT'::"QuotationStatus",
        "sentAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = ${quotationId}
    `;
  }

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      status: mail.sent ? "SENT" : quotation.status,
      email: quotation.clientEmail,
      mailSent: mail.sent,
      mailMessage: mail.message,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);

  return {
    success: true,
    message: mail.message,
    mailSent: mail.sent,
  };
}

export async function confirmCrmQuotation(quotationId: string) {
  const user = await requireAdmin();

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  await db.$executeRaw`
    UPDATE "crm_quotations"
    SET
      "status" = 'SENT'::"QuotationStatus",
      "sentAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      status: "SENT",
      confirmed: true,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm");
  return { success: true };
}

export async function getQuotationInvoice(quotationId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<QuotationInvoiceItem[]>`
    SELECT
      i."id",
      i."quotationId",
      i."paymentType",
      i."amount",
      i."percentage",
      i."months",
      i."balanceAmount",
      i."notes",
      i."createdById",
      i."createdAt",
      i."updatedAt"
    FROM "crm_quotation_invoices" i
    INNER JOIN "crm_quotations" q ON q."id" = i."quotationId"
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE i."quotationId" = ${quotationId} AND ${leadScopeFilter}
    LIMIT 1
  `;
  const invoice = rows[0] || null;
  if (!invoice) return null;
  if (user.role === "ADMIN") return invoice;

  return sanitizeRecordByFieldPermissions(
    invoice as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as QuotationInvoiceItem;
}

export async function getQuotationPayments(quotationId: string) {
  await ensureQuotationPaymentsTable();
  return db.$queryRaw<QuotationPaymentItem[]>`
    SELECT
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" DESC
  `;
}

export async function upsertQuotationInvoice(quotationId: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "SALES");
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const parsed = upsertInvoiceSchema.safeParse({
    paymentType: formData.get("paymentType"),
    amount: formData.get("amount") || undefined,
    percentage: formData.get("percentage") || undefined,
    months: formData.get("months") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const paymentType = paymentTypeSchema.parse(parsed.data.paymentType);
  const quoteTotal = Number(quotation.totalAmount || 0);
  const alreadyPaid = await getQuotationPaidTotal(quotationId);
  const remaining = round2(Math.max(quoteTotal - alreadyPaid, 0));
  if (remaining <= 0) {
    return { error: "Invoice already fully paid" };
  }

  let amount = 0;
  let percentage: number | null = null;
  let months: number | null = null;
  let calculatedPaid = 0;

  if (paymentType === "FIXED") {
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = amount;
  } else if (paymentType === "PERCENTAGE") {
    percentage = round2(parsed.data.percentage || 0);
    calculatedPaid = round2((quoteTotal * percentage) / 100);
    amount = calculatedPaid;
  } else {
    months = parsed.data.months || 1;
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = round2(amount * months);
  }

  if (calculatedPaid <= 0) {
    return { error: "Payment amount must be greater than zero" };
  }

  const appliedPaidAmount = round2(Math.min(calculatedPaid, remaining));
  await ensureQuotationPaymentsTable();
  const paymentId = crypto.randomUUID();
  const paymentRows = await db.$queryRaw<QuotationPaymentItem[]>`
    INSERT INTO "crm_quotation_payments" (
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "paidAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${paymentId},
        ${quotationId},
        ${paymentType}::"PaymentType",
        ${amount},
        ${percentage},
        ${months},
        ${appliedPaidAmount},
        ${parsed.data.notes || null},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "paidAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
  `;
  const payment = paymentRows[0];
  const totals = await syncInvoiceSummary(quotationId, quoteTotal, user.id);

  await logActivity({
    action: "UPDATE",
    entityType: "crm_invoice",
    entityId: payment.id,
    createdById: user.id,
    metadata: {
      quotationId,
      paymentType,
      amount,
      paidAmount: payment.paidAmount,
      totalPaidAmount: totals.paidAmount,
      balanceAmount: totals.balanceAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm");
  return {
    success: true,
    data: payment,
    paidAmount: totals.paidAmount,
    balanceAmount: totals.balanceAmount,
  };
}

export async function updateQuotationPayment(paymentId: string, formData: FormData) {
  const user = await requireAdmin();
  await ensureQuotationPaymentsTable();

  const existingRows = await db.$queryRaw<QuotationPaymentItem[]>`
    SELECT
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_payments"
    WHERE "id" = ${paymentId}
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    return { error: "Payment record not found" };
  }

  const quotation = await getCrmQuotation(existing.quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const parsed = upsertInvoiceSchema.safeParse({
    paymentType: formData.get("paymentType"),
    amount: formData.get("amount") || undefined,
    percentage: formData.get("percentage") || undefined,
    months: formData.get("months") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const paymentType = paymentTypeSchema.parse(parsed.data.paymentType);
  const quoteTotal = Number(quotation.totalAmount || 0);
  const otherPaidRows = await db.$queryRaw<Array<{ paidTotal: number | null }>>`
    SELECT COALESCE(SUM("paidAmount"), 0) AS "paidTotal"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${existing.quotationId}
      AND "id" <> ${paymentId}
  `;
  const otherPaid = round2(Number(otherPaidRows[0]?.paidTotal || 0));
  const remaining = round2(Math.max(quoteTotal - otherPaid, 0));
  if (remaining <= 0) {
    return { error: "Invoice already fully paid" };
  }

  let amount = 0;
  let percentage: number | null = null;
  let months: number | null = null;
  let calculatedPaid = 0;

  if (paymentType === "FIXED") {
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = amount;
  } else if (paymentType === "PERCENTAGE") {
    percentage = round2(parsed.data.percentage || 0);
    calculatedPaid = round2((quoteTotal * percentage) / 100);
    amount = calculatedPaid;
  } else {
    months = parsed.data.months || 1;
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = round2(amount * months);
  }

  if (calculatedPaid <= 0) {
    return { error: "Payment amount must be greater than zero" };
  }

  const appliedPaidAmount = round2(Math.min(calculatedPaid, remaining));
  const updatedRows = await db.$queryRaw<QuotationPaymentItem[]>`
    UPDATE "crm_quotation_payments"
    SET
      "paymentType" = ${paymentType}::"PaymentType",
      "amount" = ${amount},
      "percentage" = ${percentage},
      "months" = ${months},
      "paidAmount" = ${appliedPaidAmount},
      "notes" = ${parsed.data.notes || null},
      "updatedAt" = NOW()
    WHERE "id" = ${paymentId}
    RETURNING
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
  `;
  const updated = updatedRows[0];
  const totals = await syncInvoiceSummary(existing.quotationId, quoteTotal, user.id);

  await logActivity({
    action: "UPDATE",
    entityType: "crm_invoice",
    entityId: paymentId,
    createdById: user.id,
    metadata: {
      quotationId: existing.quotationId,
      paymentEdited: true,
      paymentType,
      amount,
      paidAmount: updated.paidAmount,
      totalPaidAmount: totals.paidAmount,
      balanceAmount: totals.balanceAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice/create`);
  revalidatePath("/crm");

  return {
    success: true,
    data: updated,
    paidAmount: totals.paidAmount,
    balanceAmount: totals.balanceAmount,
  };
}

export async function deleteQuotationPayment(paymentId: string) {
  void paymentId;
  return { error: "Payment records are locked and cannot be removed once saved" };
}

export async function deleteQuotationInvoice(quotationId: string) {
  const user = await requireAdmin();
  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  await ensureDeletedInvoicesTable();

  const invoiceRows = await db.$queryRaw<Array<{ id: string; createdAt: Date }>>`
    SELECT "id", "createdAt"
    FROM "crm_quotation_invoices"
    WHERE "quotationId" = ${quotationId}
    LIMIT 1
  `;
  if (!invoiceRows[0]?.id) {
    return { error: "Invoice not found" };
  }

  const salespersonRows = await db.$queryRaw<Array<{ name: string | null }>>`
    SELECT "name" FROM "users" WHERE "id" = ${quotation.createdById} LIMIT 1
  `;
  const invoiceRef = buildInvoiceRef(quotation.createdAt, quotation.quotationNo);
  await db.$executeRaw`
    INSERT INTO "crm_deleted_invoices" (
      "id",
      "invoiceId",
      "quotationId",
      "crmLeadId",
      "invoiceRef",
      "orderNo",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "invoiceCreatedAt",
      "deletedById",
      "deletedAt",
      "notes"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${invoiceRows[0].id},
      ${quotationId},
      ${quotation.crmLeadId},
      ${invoiceRef},
      ${quotation.quotationNo},
      ${quotation.clientName},
      ${salespersonRows[0]?.name ?? null},
      ${quotation.status},
      ${Number(quotation.totalAmount || 0)},
      ${invoiceRows[0].createdAt},
      ${user.id},
      NOW(),
      ${"Deleted from Orders to Invoice"}
    )
    ON CONFLICT ("invoiceId") DO NOTHING
  `;

  await db.$executeRaw`
    DELETE FROM "crm_quotation_invoices"
    WHERE "id" = ${invoiceRows[0].id}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_invoice",
    entityId: invoiceRows[0].id,
    createdById: user.id,
    metadata: { quotationId },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true };
}

export async function bulkDeleteQuotationInvoices(invoiceIds: string[]) {
  const user = await requireAdmin();
  const uniqueIds = Array.from(new Set((invoiceIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { error: "No invoices selected" };
  }

  await ensureDeletedInvoicesTable();

  const invoiceRows = await db.$queryRaw<
    Array<{
      invoiceId: string;
      quotationId: string;
      crmLeadId: string;
      quotationNo: string;
      clientName: string;
      status: string;
      totalAmount: number;
      quotationCreatedAt: Date;
      invoiceCreatedAt: Date;
      createdById: string;
      salespersonName: string | null;
    }>
  >`
    SELECT
      i."id" AS "invoiceId",
      q."id" AS "quotationId",
      q."crmLeadId",
      q."quotationNo",
      q."clientName",
      q."status",
      q."totalAmount",
      q."createdAt" AS "quotationCreatedAt",
      i."createdAt" AS "invoiceCreatedAt",
      q."createdById",
      u."name" AS "salespersonName"
    FROM "crm_quotation_invoices" i
    INNER JOIN "crm_quotations" q
      ON q."id" = i."quotationId"
    LEFT JOIN "users" u
      ON u."id" = q."createdById"
    WHERE i."id" IN (${Prisma.join(uniqueIds)})
  `;

  let deletedCount = 0;

  for (const row of invoiceRows) {
    await db.$executeRaw`
      INSERT INTO "crm_deleted_invoices" (
        "id",
        "invoiceId",
        "quotationId",
        "crmLeadId",
        "invoiceRef",
        "orderNo",
        "clientName",
        "salespersonName",
        "status",
        "totalAmount",
        "invoiceCreatedAt",
        "deletedById",
        "deletedAt",
        "notes"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${row.invoiceId},
        ${row.quotationId},
        ${row.crmLeadId},
        ${buildInvoiceRef(row.quotationCreatedAt, row.quotationNo)},
        ${row.quotationNo},
        ${row.clientName},
        ${row.salespersonName},
        ${row.status},
        ${Number(row.totalAmount || 0)},
        ${row.invoiceCreatedAt},
        ${user.id},
        NOW(),
        ${"Deleted from Orders to Invoice"}
      )
      ON CONFLICT ("invoiceId") DO NOTHING
    `;

    await db.$executeRaw`
      DELETE FROM "crm_quotation_invoices"
      WHERE "id" = ${row.invoiceId}
    `;

    await logActivity({
      action: "DELETE",
      entityType: "crm_invoice",
      entityId: row.invoiceId,
      createdById: user.id,
      metadata: { quotationId: row.quotationId, bulk: true },
    });

    deletedCount += 1;
  }

  const missingCount = Math.max(0, uniqueIds.length - invoiceRows.length);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");

  return { success: true, deletedCount, blockedCount: 0, missingCount };
}

export async function deleteCrmQuotation(quotationId: string) {
  const user = await requireAdmin();
  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  await ensureQuotationPaymentsTable();
  const paymentRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
  `;
  if (Number(paymentRows[0]?.count || 0) > 0) {
    return { error: "Remove invoice payment records first" };
  }

  const invoiceRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotation_invoices"
    WHERE "quotationId" = ${quotationId}
  `;
  if (Number(invoiceRows[0]?.count || 0) > 0) {
    return { error: "Remove invoice first, then remove quotation" };
  }

  await db.$executeRaw`
    DELETE FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
  `;
  await db.$executeRaw`
    DELETE FROM "crm_quotations"
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      crmLeadId: quotation.crmLeadId,
      quotationNo: quotation.quotationNo,
      totalAmount: quotation.totalAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true, crmLeadId: quotation.crmLeadId };
}

export async function bulkDeleteCrmQuotations(quotationIds: string[]) {
  await requireAdmin();
  const uniqueIds = Array.from(new Set((quotationIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { error: "No quotations selected" };
  }

  let deletedCount = 0;
  let blockedCount = 0;
  let missingCount = 0;
  const errors: string[] = [];

  for (const quotationId of uniqueIds) {
    const result = await deleteCrmQuotation(quotationId);
    if (result.success) {
      deletedCount += 1;
      continue;
    }
    if (result.error === "Quotation not found") {
      missingCount += 1;
    } else {
      blockedCount += 1;
    }
    if (result.error && errors.length < 5) {
      errors.push(result.error);
    }
  }

  return { success: true, deletedCount, blockedCount, missingCount, errors };
}
