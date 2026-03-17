import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllCrmQuotations } from "@/actions/quotation.actions";
import { getCrmProjectTypes } from "@/actions/crm-project-types.actions";
import { db } from "@/lib/db";
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  BarChart3,
  CircleDollarSign,
  FileText,
  Send,
  Trophy,
} from "lucide-react";
import { QuotationsFilterDropdown } from "@/components/crm/quotations-filter-dropdown";
import { OrdersTabDropdown } from "@/components/crm/orders-tab-dropdown";
import { CrmProjectTypesManager } from "@/components/crm/crm-project-types-manager";
import { CrmToolbarSearch } from "@/components/crm/crm-toolbar-search";
import { OrdersToInvoiceTable } from "@/components/crm/orders-to-invoice-table";
import { OrdersToInvoiceSettings } from "@/components/crm/orders-to-invoice-settings";
import { OrdersToInvoiceSelectionToolbar } from "@/components/crm/orders-to-invoice-selection-toolbar";
import { QuotationsOrdersListTable } from "@/components/crm/quotations-orders-list-table";
import { SalesSummaryListTable } from "@/components/crm/sales-summary-list-table";
import { SalesViewSwitcher, type SalesViewKey } from "@/components/crm/sales-view-switcher";

interface CrmQuotationsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    tab?: string;
    view?: string;
    filterPreset?: string;
    documentType?: string;
    dateField?: string;
    customFilter?: string;
    groupBy?: string;
    projectPreset?: string;
    projectCategory?: string;
    projectBudgetRanges?: string;
    budgetMin?: string;
    budgetMax?: string;
    newProject?: string;
    deleted?: string;
  }>;
}

export default async function CrmQuotationsPage({ searchParams }: CrmQuotationsPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  type QuotationsList = Awaited<ReturnType<typeof getAllCrmQuotations>>;
  type ProjectTypesList = Awaited<ReturnType<typeof getCrmProjectTypes>>;
  type ProjectListRow = {
    id: string;
    name: string;
    category: string | null;
    price: number;
    gstPercent: number;
    createdAt: Date;
    updatedAt: Date;
  };
  type InvoiceRow = {
    invoiceId: string;
    quotationId: string;
    crmLeadId: string;
    invoiceRef: string;
    orderNo: string;
    clientName: string;
    salespersonName: string | null;
    paymentType: string | null;
    status: string;
    totalAmount: number;
    createdAt: Date;
  };

  let dbErrorMessage: string | null = null;
  let quotations: QuotationsList = [];
  let projectTypes: ProjectTypesList = [];
  let projectRows: ProjectListRow[] = [];
  let invoiceRows: InvoiceRow[] = [];

  try {
    quotations = await getAllCrmQuotations();
  } catch {
    dbErrorMessage = "Database is currently unreachable. Showing cached/empty results.";
  }

  try {
    projectTypes = await getCrmProjectTypes();
  } catch {
    dbErrorMessage = dbErrorMessage || "Database is currently unreachable. Showing cached/empty results.";
  }
  try {
    projectRows = await db.$queryRaw<ProjectListRow[]>`
      SELECT
        "id",
        "name",
        "category",
        "price",
        "gstPercent",
        "createdAt",
        "updatedAt"
      FROM "crm_projects"
      ORDER BY "createdAt" DESC
    `;
  } catch {
    // ignore; project type list can still be used
  }
  const rawTab = (params.tab || "quotations").toLowerCase();
  const activeTab = rawTab === "products" ? "projects" : rawTab;
  const orderTabs = ["quotations", "orders", "sales-teams", "customers"] as const;
  const isOrderTab = (orderTabs as readonly string[]).includes(activeTab);
  const selectedOrderTab = (orderTabs as readonly string[]).includes(activeTab) ? activeTab : "orders";
  const selectedOrderLabel =
    selectedOrderTab === "quotations"
      ? "Quotations"
      : selectedOrderTab === "sales-teams"
        ? "Sales Teams"
        : selectedOrderTab === "customers"
          ? "Customers"
          : "Orders";
  const toInvoiceTabs = ["to-invoice", "orders-to-invoice", "orders-to-upsell"] as const;
  const selectedToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab) ? activeTab : "to-invoice";
  const isToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab);
  const isProjectsTab = activeTab === "projects";
  const isReportingTab = activeTab === "reporting";
  const isConfigurationTab = activeTab === "configuration";
  if (isReportingTab) {
    redirect("/crm/reporting");
  }
  const isQuotationLikeTab =
    isOrderTab && !isToInvoiceTab && (selectedOrderTab === "orders" || selectedOrderTab === "quotations");
  const selectedToInvoiceLabel =
    selectedToInvoiceTab === "orders-to-invoice"
      ? "Orders to Invoice"
      : selectedToInvoiceTab === "orders-to-upsell"
        ? "Orders to Upsell"
        : "To Invoice";
  const tabLabelMap: Record<string, string> = {
    orders: "Orders",
    quotations: "Quotations",
    "sales-teams": "Sales Teams",
    customers: "Customers",
    "to-invoice": "To Invoice",
    "orders-to-invoice": "Orders to Invoice",
    "orders-to-upsell": "Orders to Upsell",
    projects: "Projects",
    reporting: "Reporting",
    configuration: "Configuration",
  };
  const activeView = (params.view || "list").toLowerCase();
  const allowedViews = new Set(["list", "kanban", "map", "calendar", "table", "chart", "history"]);
  const viewMode = allowedViews.has(activeView) ? activeView : "list";
  const filterPreset = (params.filterPreset || "my_quotations").toLowerCase();
  const documentType = (params.documentType || "quotations").toLowerCase();
  const dateField = (params.dateField || "create_date").toLowerCase();
  const groupBy = (params.groupBy || "").toLowerCase();
  const projectPreset = (params.projectPreset || "").toLowerCase();
  const query = (params.q || "").trim().toLowerCase();
  const customFilter = (params.customFilter || "").trim().toLowerCase();
  const projectCategory = (params.projectCategory || "").trim();
  const projectCategoryValues = projectCategory
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const projectBudgetRangeValues = (params.projectBudgetRanges || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const rawBudgetMin = (params.budgetMin || "").trim();
  const rawBudgetMax = (params.budgetMax || "").trim();
  const budgetMin = rawBudgetMin === "" ? Number.NaN : Number(rawBudgetMin.replace(/,/g, ""));
  const budgetMax = rawBudgetMax === "" ? Number.NaN : Number(rawBudgetMax.replace(/,/g, ""));
  const deletedView = params.deleted === "1";
  const pageSize = 20;
  const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  const username = (session.user.name || "").trim().toLowerCase();
  const toSearchDate = (value: Date | null | undefined) =>
    value ? new Date(value).toISOString().slice(0, 10) : "";
  const toSearchAmount = (value: number | null | undefined) => {
    if (!Number.isFinite(Number(value))) return "";
    return Number(value).toFixed(2);
  };
  const matchesTextFilters = (searchableText: string) => {
    const normalized = searchableText.toLowerCase();
    const matchesSearch = !query || normalized.includes(query);
    const matchesCustomFilter = !customFilter || normalized.includes(customFilter);
    return matchesSearch && matchesCustomFilter;
  };
  const newQuotationHref = quotations[0]?.crmLeadId ? `/crm/${quotations[0].crmLeadId}/quotations/new` : "/crm";
  const newProjectHref = "/crm/projects/new?next=%2Fcrm%2Fquotations%3Ftab%3Dprojects";
  const newActionHref = isProjectsTab ? newProjectHref : newQuotationHref;
  const newActionLabel = isProjectsTab ? "New Project" : "New";

  try {
    invoiceRows = await db.$queryRaw<InvoiceRow[]>`
      SELECT
        i."id" AS "invoiceId",
        q."id" AS "quotationId",
        q."crmLeadId",
        CONCAT('INV/', EXTRACT(YEAR FROM q."createdAt")::text, '/', REPLACE(q."quotationNo", 'QT-', '')) AS "invoiceRef",
        q."quotationNo" AS "orderNo",
        q."clientName",
        u."name" AS "salespersonName",
        i."paymentType"::text AS "paymentType",
        q."status",
        q."totalAmount",
        i."createdAt"
      FROM "crm_quotation_invoices" i
      INNER JOIN "crm_quotations" q
        ON q."id" = i."quotationId"
      LEFT JOIN "users" u
        ON u."id" = q."createdById"
      ORDER BY i."createdAt" DESC
    `;
  } catch {
    invoiceRows = [];
    dbErrorMessage = dbErrorMessage || "Database is currently unreachable. Showing cached/empty results.";
  }
  const paymentTypeByQuotationId = invoiceRows.reduce<Record<string, string>>((acc, row) => {
    if (!acc[row.quotationId] && row.paymentType) {
      acc[row.quotationId] = row.paymentType;
    }
    return acc;
  }, {});
  const filteredQuotations = quotations
    .filter((quotation) => {
      const paymentType = paymentTypeByQuotationId[quotation.id] || "";
      const searchableText = [
        quotation.quotationNo,
        quotation.title,
        quotation.clientName,
        quotation.salespersonName || "",
        quotation.status,
        paymentType,
        toSearchAmount(quotation.totalAmount),
        toSearchDate(quotation.createdAt),
      ].join(" ");

      const matchesUser =
        filterPreset !== "my_quotations" ||
        !username ||
        (quotation.salespersonName || "").toLowerCase().includes(username);
      const matchesDocument =
        documentType !== "sales_orders" ||
        ["CONFIRMED", "SALES_ORDER", "ORDERED"].includes(quotation.status.toUpperCase());
      return matchesTextFilters(searchableText) && matchesUser && matchesDocument;
    })
    .sort((a, b) => {
      if (groupBy === "salesperson") {
        return (a.salespersonName || "").localeCompare(b.salespersonName || "");
      }
      if (groupBy === "customer") {
        return a.clientName.localeCompare(b.clientName);
      }
      if (groupBy === "payment_method") {
        return (paymentTypeByQuotationId[a.id] || "").localeCompare(paymentTypeByQuotationId[b.id] || "");
      }
      if (groupBy === "order_date" || dateField === "create_date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  const toInvoiceRows = invoiceRows.filter((row) => {
    const searchableText = [
      row.invoiceRef,
      row.orderNo,
      row.clientName,
      row.salespersonName || "",
      row.paymentType || "",
      row.status,
      toSearchAmount(row.totalAmount),
      toSearchDate(row.createdAt),
    ].join(" ");
    if (!matchesTextFilters(searchableText)) return false;
    if (selectedToInvoiceTab === "orders-to-upsell") {
      const status = row.status.toUpperCase();
      return status === "SENT" || status === "CONFIRMED" || status === "SALES_ORDER";
    }
    return true;
  });
  let deletedInvoiceRows: Array<{
    invoiceId: string;
    quotationId: string;
    crmLeadId: string;
    invoiceRef: string;
    orderNo: string;
    clientName: string;
    salespersonName: string | null;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }> = [];
  if (isToInvoiceTab && deletedView) {
    try {
      deletedInvoiceRows = await db.$queryRaw<
        Array<{
          invoiceId: string;
          quotationId: string;
          crmLeadId: string;
          invoiceRef: string;
          orderNo: string;
          clientName: string;
          salespersonName: string | null;
          status: string;
          totalAmount: number;
          createdAt: Date;
        }>
      >`
        SELECT
          d."invoiceId",
          d."quotationId",
          d."crmLeadId",
          d."invoiceRef",
          d."orderNo",
          d."clientName",
          d."salespersonName",
          d."status",
          d."totalAmount",
          d."deletedAt" AS "createdAt"
        FROM "crm_deleted_invoices" d
        ORDER BY d."deletedAt" DESC
      `;
    } catch {
      deletedInvoiceRows = [];
    }
  }
  const filteredDeletedRows = deletedInvoiceRows.filter((row) => {
    const searchableText = [
      row.invoiceRef,
      row.orderNo,
      row.clientName,
      row.salespersonName || "",
      row.status,
      toSearchAmount(row.totalAmount),
      toSearchDate(row.createdAt),
    ].join(" ");
    return matchesTextFilters(searchableText);
  });
  const totalItems = isToInvoiceTab
    ? (deletedView ? filteredDeletedRows.length : toInvoiceRows.length)
    : filteredQuotations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = Number(params.page || "1");
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages)
    : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pagedQuotations = filteredQuotations.slice(startIndex, startIndex + pageSize);
  const pagedToInvoiceRows = toInvoiceRows.slice(startIndex, startIndex + pageSize);
  const pagedToInvoiceRowsView = pagedToInvoiceRows.map((row) => ({
    ...row,
    totalLabel: currency.format(row.totalAmount),
    createdLabel: new Date(row.createdAt).toLocaleDateString(),
  }));
  const rangeStart = totalItems === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, totalItems);
  const statusBuckets = filteredQuotations.reduce<Record<string, number>>((acc, quotation) => {
    const key = quotation.status || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const calendarBuckets = pagedQuotations.reduce<Record<string, typeof pagedQuotations>>((acc, quotation) => {
    const dateKey = new Date(quotation.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(quotation);
    return acc;
  }, {});
  const customerBuckets = pagedQuotations.reduce<
    Record<string, { client: string; count: number; total: number; quotations: string[] }>
  >((acc, quotation) => {
    const key = quotation.clientName || "Unknown";
    if (!acc[key]) acc[key] = { client: key, count: 0, total: 0, quotations: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].quotations.push(quotation.quotationNo);
    return acc;
  }, {});
  const customerDetails = filteredQuotations.reduce<
    Record<string, { name: string; count: number; total: number; lastDate: number; quotationIds: string[] }>
  >((acc, quotation) => {
    const key = quotation.clientName || "Unknown";
    if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0, quotationIds: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
    acc[key].quotationIds.push(quotation.id);
    return acc;
  }, {});
  const salesTeamDetails = filteredQuotations.reduce<
    Record<string, { name: string; count: number; total: number; lastDate: number; quotationIds: string[] }>
  >((acc, quotation) => {
    const key = quotation.salespersonName || "Unassigned";
    if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0, quotationIds: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
    acc[key].quotationIds.push(quotation.id);
    return acc;
  }, {});
  const pageTitle = tabLabelMap[activeTab] || (isToInvoiceTab ? selectedToInvoiceLabel : selectedOrderLabel);
  const displayTitle = isToInvoiceTab && deletedView ? "Deleted Invoices" : pageTitle;
  const confirmedStatuses = new Set(["CONFIRMED", "SALES_ORDER", "ORDERED"]);
  const draftStatuses = new Set(["DRAFT"]);
  const sentStatuses = new Set(["SENT"]);
  const reportingRows = filteredQuotations;
  const reportingRowCount = reportingRows.length;
  const reportingTotalValue = reportingRows.reduce((sum, quotation) => sum + Number(quotation.totalAmount || 0), 0);
  const confirmedRows = reportingRows.filter((quotation) => confirmedStatuses.has((quotation.status || "").toUpperCase()));
  const confirmedValue = confirmedRows.reduce((sum, quotation) => sum + Number(quotation.totalAmount || 0), 0);
  const draftRows = reportingRows.filter((quotation) => draftStatuses.has((quotation.status || "").toUpperCase()));
  const sentRows = reportingRows.filter((quotation) => sentStatuses.has((quotation.status || "").toUpperCase()));
  const averageQuotationValue = reportingRowCount > 0 ? reportingTotalValue / reportingRowCount : 0;
  const conversionRate = reportingRowCount > 0 ? (confirmedRows.length / reportingRowCount) * 100 : 0;
  const statusSummaryRows = Object.entries(
    reportingRows.reduce<Record<string, { count: number; total: number }>>((acc, quotation) => {
      const key = quotation.status || "UNKNOWN";
      if (!acc[key]) acc[key] = { count: 0, total: 0 };
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      return acc;
    }, {}),
  )
    .map(([status, bucket]) => ({
      status,
      count: bucket.count,
      total: bucket.total,
      share: reportingRowCount > 0 ? (bucket.count / reportingRowCount) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
  const reportingSalespeople = Object.values(
    reportingRows.reduce<
      Record<string, { name: string; count: number; total: number; confirmed: number; lastDate: number }>
    >((acc, quotation) => {
      const key = quotation.salespersonName || "Unassigned";
      if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, confirmed: 0, lastDate: 0 };
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      if (confirmedStatuses.has((quotation.status || "").toUpperCase())) {
        acc[key].confirmed += 1;
      }
      acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);
  const reportingCustomers = Object.values(
    reportingRows.reduce<Record<string, { name: string; count: number; total: number; lastDate: number }>>(
      (acc, quotation) => {
        const key = quotation.clientName || "Unknown";
        if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0 };
        acc[key].count += 1;
        acc[key].total += Number(quotation.totalAmount || 0);
        acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total);
  const reportingMonthlyTrend = Object.values(
    reportingRows.reduce<
      Record<string, { key: string; label: string; count: number; total: number; confirmed: number }>
    >((acc, quotation) => {
      const createdAt = new Date(quotation.createdAt);
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          label: createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          count: 0,
          total: 0,
          confirmed: 0,
        };
      }
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      if (confirmedStatuses.has((quotation.status || "").toUpperCase())) {
        acc[key].confirmed += 1;
      }
      return acc;
    }, {}),
  )
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);
  const reportingRecentRows = [...reportingRows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
  const mergedProjectItems: ProjectTypesList = [
    ...projectTypes,
    ...projectRows
      .filter((project) => !projectTypes.some((item) => item.name.toLowerCase() === project.name.toLowerCase()))
      .map((project) => ({
        id: project.id,
        name: project.name,
        budget: Number(project.price || 0),
        category: (project.category || "Other").trim() || "Other",
        gstPercent: Number(project.gstPercent || 18),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
  ];
  const projectCategories = Array.from(
    new Set(mergedProjectItems.map((item) => (item.category || "Other").trim() || "Other"))
  ).sort((a, b) => a.localeCompare(b));
  const filteredProjectTypes = mergedProjectItems.filter((item) => {
    if (!isProjectsTab) return true;
    const normalizedCategory = (item.category || "Other").trim() || "Other";
    const searchableText = [
      item.name,
      normalizedCategory,
      toSearchAmount(item.budget),
      toSearchDate(item.createdAt),
      toSearchDate(item.updatedAt),
    ].join(" ");
    const matchesText = matchesTextFilters(searchableText);
    const matchesCategory =
      projectCategoryValues.length === 0 || projectCategoryValues.includes(normalizedCategory);
    const matchesBudgetPreset =
      projectBudgetRangeValues.length === 0 ||
      projectBudgetRangeValues.some((range) => {
        if (range === "lte_5000") return item.budget <= 5000;
        if (range === "range_5001_20000") return item.budget >= 5001 && item.budget <= 20000;
        if (range === "gte_20001") return item.budget >= 20001;
        return false;
      });
    const matchesBudgetMin = !Number.isFinite(budgetMin) || item.budget >= budgetMin;
    const matchesBudgetMax = !Number.isFinite(budgetMax) || item.budget <= budgetMax;
    return matchesText && matchesCategory && matchesBudgetPreset && matchesBudgetMin && matchesBudgetMax;
  });
  const projectViewItems = [...filteredProjectTypes].sort((a, b) => {
    if (groupBy === "category") {
      return (a.category || "Other").localeCompare(b.category || "Other");
    }
    if (groupBy === "budget") {
      return Number(b.budget || 0) - Number(a.budget || 0);
    }
    if (groupBy === "create_date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (groupBy === "project_name") {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const projectsTotalPages = Math.max(1, Math.ceil(projectViewItems.length / pageSize));
  const uiTotalItems = isProjectsTab ? projectViewItems.length : isReportingTab ? reportingRowCount : totalItems;
  const uiCurrentPage = isProjectsTab || isReportingTab ? 1 : currentPage;
  const uiTotalPages = isProjectsTab ? projectsTotalPages : isReportingTab ? 1 : totalPages;
  const uiRangeStart = isProjectsTab
    ? (projectViewItems.length === 0 ? 0 : 1)
    : isReportingTab
      ? (reportingRowCount === 0 ? 0 : 1)
      : rangeStart;
  const uiRangeEnd = isProjectsTab ? projectViewItems.length : isReportingTab ? reportingRowCount : rangeEnd;

  const pageHref = (
    page: number,
    overrides?: {
      tab?: string;
      view?: string;
      filterPreset?: string;
      documentType?: string;
      dateField?: string;
      customFilter?: string;
      groupBy?: string;
      projectPreset?: string;
      deleted?: string;
      q?: string;
      projectCategory?: string;
      projectBudgetRanges?: string;
      budgetMin?: string;
      budgetMax?: string;
      clearFilters?: boolean;
    }
  ) => {
    const next = new URLSearchParams();

    const filterPresetValue = overrides?.filterPreset ?? (overrides?.clearFilters ? undefined : params.filterPreset);
    const documentTypeValue = overrides?.documentType ?? (overrides?.clearFilters ? undefined : params.documentType);
    const dateFieldValue = overrides?.dateField ?? (overrides?.clearFilters ? undefined : params.dateField);
    const customFilterValue = overrides?.customFilter ?? (overrides?.clearFilters ? undefined : params.customFilter);
    const groupByValue = overrides?.groupBy ?? (overrides?.clearFilters ? undefined : params.groupBy);
    const projectPresetValue = overrides?.projectPreset ?? (overrides?.clearFilters ? undefined : params.projectPreset);
    const deletedValue = overrides?.deleted ?? (overrides?.clearFilters ? undefined : params.deleted);
    const projectCategoryValue =
      overrides?.projectCategory ?? (overrides?.clearFilters ? undefined : params.projectCategory);
    const projectBudgetRangesValue =
      overrides?.projectBudgetRanges ?? (overrides?.clearFilters ? undefined : params.projectBudgetRanges);
    const budgetMinValue = overrides?.budgetMin ?? (overrides?.clearFilters ? undefined : params.budgetMin);
    const budgetMaxValue = overrides?.budgetMax ?? (overrides?.clearFilters ? undefined : params.budgetMax);

    if (filterPresetValue && filterPresetValue !== "my_quotations") next.set("filterPreset", filterPresetValue);
    if (documentTypeValue && documentTypeValue !== "quotations") next.set("documentType", documentTypeValue);
    if (dateFieldValue && dateFieldValue !== "create_date") next.set("dateField", dateFieldValue);
    if (customFilterValue) next.set("customFilter", customFilterValue);
    if (groupByValue) next.set("groupBy", groupByValue);
    if (projectPresetValue) next.set("projectPreset", projectPresetValue);
    if (deletedValue === "1") next.set("deleted", "1");
    if (projectCategoryValue) next.set("projectCategory", projectCategoryValue);
    if (projectBudgetRangesValue) next.set("projectBudgetRanges", projectBudgetRangesValue);
    if (budgetMinValue) next.set("budgetMin", budgetMinValue);
    if (budgetMaxValue) next.set("budgetMax", budgetMaxValue);

    const qValue = overrides?.q ?? params.q;
    if (qValue && qValue.trim()) next.set("q", qValue.trim());

    const tabValue = overrides?.tab || activeTab;
    const viewValue = overrides?.view || activeView;
    if (tabValue && tabValue !== "orders") next.set("tab", tabValue);
    if (viewValue && viewValue !== "list") next.set("view", viewValue);
    if (page > 1) next.set("page", String(page));
    const queryString = next.toString();
    return queryString ? `/crm/quotations?${queryString}` : "/crm/quotations";
  };

  const viewLabelByKey: Record<SalesViewKey, string> = {
    list: "List view",
    kanban: "Kanban view",
    map: "Map view",
    calendar: "Calendar view",
    table: "Table view",
    chart: "Chart view",
    history: "History view",
  };
  const availableViewKeys: SalesViewKey[] = isQuotationLikeTab
    ? ["list", "kanban", "map", "calendar", "table", "chart", "history"]
    : isProjectsTab
      ? ["list", "kanban", "map", "calendar", "table", "chart", "history"]
      : isReportingTab
        ? ["list", "table", "chart", "history"]
      : isToInvoiceTab
        ? ["list", "kanban", "table"]
        : selectedOrderTab === "sales-teams" || selectedOrderTab === "customers"
          ? ["list", "kanban", "table"]
          : ["list"];
  const currentViewMode: SalesViewKey = availableViewKeys.includes(viewMode as SalesViewKey)
    ? (viewMode as SalesViewKey)
    : availableViewKeys[0];
  const availableViews = availableViewKeys.map((key) => ({
    key,
    label: viewLabelByKey[key],
    href: pageHref(1, { view: key }),
  }));

  const activeFilterChips: Array<{ key: string; label: string; href: string; icon?: "group" | "filter" }> = [];
  if (isProjectsTab) {
    if (projectPreset === "all_projects") {
      activeFilterChips.push({
        key: "projectPreset",
        label: "All Projects",
        href: pageHref(1, { projectPreset: "" }),
        icon: "filter",
      });
    }
    projectCategoryValues.forEach((category) => {
      const nextCategories = projectCategoryValues.filter((value) => value !== category);
      activeFilterChips.push({
        key: `projectCategory-${category}`,
        label: category,
        href: pageHref(1, { projectCategory: nextCategories.join(",") }),
        icon: "filter",
      });
    });
    projectBudgetRangeValues.forEach((range) => {
      const nextRanges = projectBudgetRangeValues.filter((value) => value !== range);
      const rangeLabel =
        range === "lte_5000"
          ? "Budget <= 5,000"
          : range === "range_5001_20000"
            ? "Budget 5,001 - 20,000"
            : "Budget >= 20,001";
      activeFilterChips.push({
        key: `projectBudgetRange-${range}`,
        label: rangeLabel,
        href: pageHref(1, { projectBudgetRanges: nextRanges.join(",") }),
        icon: "filter",
      });
    });
    if (Number.isFinite(budgetMin)) {
      activeFilterChips.push({
        key: "budgetMin",
        label: `Min Budget: ${budgetMin}`,
        href: pageHref(1, { budgetMin: "" }),
      });
    }
    if (Number.isFinite(budgetMax)) {
      activeFilterChips.push({
        key: "budgetMax",
        label: `Max Budget: ${budgetMax}`,
        href: pageHref(1, { budgetMax: "" }),
      });
    }
    if (groupBy) {
      const groupByLabel =
        groupBy === "project_name"
          ? "Project Name"
          : groupBy === "category"
            ? "Category"
            : groupBy === "budget"
              ? "Budget"
              : groupBy === "create_date"
                ? "Create Date"
                : groupBy;
      activeFilterChips.push({
        key: "projectGroupBy",
        label: groupByLabel,
        href: pageHref(1, { groupBy: "" }),
        icon: "group",
      });
    }
    if (customFilter) {
      activeFilterChips.push({
        key: "projectCustomFilter",
        label: `Custom: ${customFilter}`,
        href: pageHref(1, { customFilter: "" }),
      });
    }
  } else {
    const rawFilterPreset = (params.filterPreset || "").toLowerCase();
    const rawDocumentType = (params.documentType || "").toLowerCase();
    const rawDateField = (params.dateField || "").toLowerCase();

    if (rawFilterPreset === "my_quotations") {
      activeFilterChips.push({
        key: "filterPreset",
        label: "My Quotations",
        href: pageHref(1, { filterPreset: "" }),
        icon: "filter",
      });
    }
    if (rawDocumentType === "sales_orders") {
      activeFilterChips.push({
        key: "documentType",
        label: "Sales Orders",
        href: pageHref(1, { tab: "quotations", documentType: "" }),
        icon: "filter",
      });
    } else if (rawDocumentType === "quotations") {
      activeFilterChips.push({
        key: "documentType",
        label: "Quotations",
        href: pageHref(1, { tab: "quotations", documentType: "" }),
        icon: "filter",
      });
    }
    if (rawDateField === "create_date") {
      activeFilterChips.push({
        key: "dateField",
        label: "Create Date",
        href: pageHref(1, { dateField: "" }),
      });
    }
    if (groupBy) {
      const groupByLabel =
        groupBy === "salesperson"
          ? "Salesperson"
          : groupBy === "customer"
            ? "Customer"
            : groupBy === "order_date"
              ? "Order Date"
              : groupBy === "payment_method"
                ? "Payment Method"
                : groupBy;
      activeFilterChips.push({
        key: "groupBy",
        label: groupByLabel,
        href: pageHref(1, { groupBy: "" }),
        icon: "group",
      });
    }
    if (customFilter) {
      activeFilterChips.push({
        key: "customFilter",
        label: `Custom: ${customFilter}`,
        href: pageHref(1, { customFilter: "" }),
      });
    }
  }

  const sortedCustomerDetails = Object.values(customerDetails).sort((a, b) => b.total - a.total);
  const sortedSalesTeamDetails = Object.values(salesTeamDetails).sort((a, b) => b.total - a.total);
  const groupedQuotationKanbanColumns = isQuotationLikeTab && groupBy
    ? Object.values(
        pagedQuotations.reduce<
          Record<
            string,
            {
              key: string;
              label: string;
              count: number;
              total: number;
              quotations: typeof pagedQuotations;
            }
          >
        >((acc, quotation) => {
          const columnLabel =
            groupBy === "salesperson"
              ? quotation.salespersonName || "Unassigned"
              : groupBy === "customer"
                ? quotation.clientName || "Unknown"
                : groupBy === "payment_method"
                  ? paymentTypeByQuotationId[quotation.id] || "Unspecified"
                  : groupBy === "order_date"
                    ? new Date(quotation.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Other";

          if (!acc[columnLabel]) {
            acc[columnLabel] = {
              key: columnLabel,
              label: columnLabel,
              count: 0,
              total: 0,
              quotations: [],
            };
          }

          acc[columnLabel].count += 1;
          acc[columnLabel].total += Number(quotation.totalAmount || 0);
          acc[columnLabel].quotations.push(quotation);
          return acc;
        }, {}),
      ).sort((a, b) => {
        if (groupBy === "order_date") {
          const aDate = a.quotations[0] ? new Date(a.quotations[0].createdAt).getTime() : 0;
          const bDate = b.quotations[0] ? new Date(b.quotations[0].createdAt).getTime() : 0;
          return bDate - aDate;
        }

        if (groupBy === "salesperson" || groupBy === "customer" || groupBy === "payment_method") {
          return a.label.localeCompare(b.label);
        }

        return 0;
      })
    : [];
  const quotationListRows = pagedQuotations.map((quotation) => ({
    id: quotation.id,
    crmLeadId: quotation.crmLeadId,
    quotationNo: quotation.quotationNo,
    title: quotation.title,
    clientName: quotation.clientName,
    salespersonName: quotation.salespersonName,
    status: quotation.status,
    totalLabel: currency.format(Number(quotation.totalAmount || 0)),
    createdLabel: new Date(quotation.createdAt).toLocaleDateString(),
  }));
  const salesTeamRows = sortedSalesTeamDetails.map((team) => ({
    key: team.name,
    name: team.name,
    count: team.count,
    totalLabel: currency.format(team.total),
    lastDateLabel: team.lastDate ? new Date(team.lastDate).toLocaleDateString() : "-",
    quotationIds: team.quotationIds,
    quotationsHref: pageHref(1, { tab: "orders", q: team.name }),
  }));
  const customerRows = sortedCustomerDetails.map((customer) => ({
    key: customer.name,
    name: customer.name,
    count: customer.count,
    totalLabel: currency.format(customer.total),
    lastDateLabel: customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-",
    quotationIds: customer.quotationIds,
    quotationsHref: pageHref(1, { tab: "orders", q: customer.name }),
  }));
  const searchSuggestions = (() => {
    if (isProjectsTab) {
      return projectViewItems.slice(0, 12).map((item) => ({
        id: item.id,
        label: item.name,
        description: `${item.category || "Other"} - ${currency.format(item.budget)}`,
        href: `/crm/projects/${item.id}`,
      }));
    }
    if (isToInvoiceTab && deletedView) {
      return filteredDeletedRows.slice(0, 12).map((row) => ({
        id: row.invoiceId,
        label: row.invoiceRef,
        description: `${row.clientName} - ${row.status}`,
        href: pageHref(1, { q: row.invoiceRef }),
      }));
    }
    if (isToInvoiceTab) {
      return toInvoiceRows.slice(0, 12).map((row) => ({
        id: row.invoiceId,
        label: row.invoiceRef,
        description: `${row.clientName} - ${currency.format(row.totalAmount)}`,
        href: `/crm/${row.crmLeadId}/quotations/${row.quotationId}/invoice`,
      }));
    }
    if (selectedOrderTab === "sales-teams") {
      return sortedSalesTeamDetails.slice(0, 12).map((team) => ({
        id: team.name,
        label: team.name,
        description: `${team.count} quotations - ${currency.format(team.total)}`,
        href: pageHref(1, { tab: "sales-teams", q: team.name }),
      }));
    }
    if (selectedOrderTab === "customers") {
      return sortedCustomerDetails.slice(0, 12).map((customer) => ({
        id: customer.name,
        label: customer.name,
        description: `${customer.count} quotations - ${currency.format(customer.total)}`,
        href: pageHref(1, { tab: "customers", q: customer.name }),
      }));
    }
    return filteredQuotations.slice(0, 12).map((quotation) => ({
      id: quotation.id,
      label: `${quotation.quotationNo} - ${quotation.title}`,
      description: `${quotation.clientName} - ${currency.format(Number(quotation.totalAmount || 0))}`,
      href: `/crm/${quotation.crmLeadId}/quotations/${quotation.id}`,
    }));
  })();
  const projectCategoryBuckets = projectViewItems.reduce<Record<string, { count: number; total: number }>>((acc, item) => {
    const key = (item.category || "Other").trim() || "Other";
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Number(item.budget || 0);
    return acc;
  }, {});
  const projectCalendarBuckets = projectViewItems.reduce<Record<string, typeof projectViewItems>>((acc, item) => {
    const dateKey = new Date(item.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
  const recentProjectHistory = [...projectViewItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  return (
    <div className="space-y-3">
      {dbErrorMessage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dbErrorMessage}
        </div>
      ) : null}

      <div className="rounded-md border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-6 text-base">
            <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="inline-block h-6 w-5 rounded-sm bg-gradient-to-t from-red-400 via-orange-400 to-amber-300" />
              <span>Sales</span>
            </span>
            <OrdersTabDropdown
              selectedLabel={selectedOrderLabel}
              selectedKey={selectedOrderTab}
              active={isOrderTab}
              options={[
                { key: "quotations", label: "Quotations", href: pageHref(1, { tab: "quotations", documentType: "quotations" }) },
                { key: "orders", label: "Orders", href: pageHref(1, { tab: "orders", documentType: "sales_orders" }) },
                { key: "sales-teams", label: "Sales Teams", href: pageHref(1, { tab: "sales-teams", documentType: "quotations" }) },
                { key: "customers", label: "Customers", href: pageHref(1, { tab: "customers", documentType: "quotations" }) },
              ]}
            />
            <OrdersTabDropdown
              selectedLabel={selectedToInvoiceLabel}
              selectedKey={selectedToInvoiceTab}
              active={isToInvoiceTab}
              options={[
                { key: "orders-to-invoice", label: "Orders to Invoice", href: pageHref(1, { tab: "orders-to-invoice", documentType: "sales_orders" }) },
                { key: "orders-to-upsell", label: "Orders to Upsell", href: pageHref(1, { tab: "orders-to-upsell", documentType: "sales_orders" }) },
              ]}
            />
            {[
              { key: "projects", label: "Projects" },
              { key: "reporting", label: "Reporting" },
              { key: "configuration", label: "Configuration" },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={pageHref(1, { tab: tab.key })}
                className={`rounded px-1 py-0.5 ${
                  activeTab === tab.key
                    ? "font-semibold text-slate-900 underline underline-offset-4"
                    : "text-slate-800 hover:text-slate-900 hover:underline hover:underline-offset-4"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {!(isToInvoiceTab && deletedView) ? (
              <Link
                href={newActionHref}
                className="rounded bg-[#7c5a77] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#6d4f69]"
              >
                {newActionLabel}
              </Link>
            ) : null}
            <span className="text-2xl font-semibold text-slate-900">{displayTitle}</span>
            <OrdersToInvoiceSettings
              isToInvoiceTab={isToInvoiceTab}
              isDeletedView={deletedView}
              activeHref={pageHref(1, { deleted: undefined })}
              deletedHref={pageHref(1, { deleted: "1" })}
            />
          </div>

          {!(isToInvoiceTab && deletedView) ? (
            <div className="flex w-full flex-wrap items-center gap-3">
            <OrdersToInvoiceSelectionToolbar isToInvoiceTab={isToInvoiceTab && !deletedView}>
              <div className="relative flex h-9 w-full items-stretch overflow-hidden rounded-md border border-slate-300 sm:w-auto">
                <CrmToolbarSearch
                  query={params.q || ""}
                  placeholder="Search..."
                  chips={activeFilterChips}
                  suggestions={searchSuggestions}
                  hiddenFields={{
                    tab: activeTab,
                    view: activeView,
                    filterPreset,
                    documentType,
                    dateField,
                    customFilter: params.customFilter || "",
                    groupBy: params.groupBy || "",
                    projectPreset: params.projectPreset || "",
                    projectCategory: params.projectCategory || "",
                    projectBudgetRanges: params.projectBudgetRanges || "",
                    budgetMin: params.budgetMin || "",
                    budgetMax: params.budgetMax || "",
                    deleted: deletedView ? "1" : "",
                  }}
                />
                <QuotationsFilterDropdown
                  filterPreset={filterPreset}
                  documentType={documentType}
                  dateField={dateField}
                  groupBy={groupBy}
                  activeTab={activeTab}
                  activeView={activeView}
                  deletedView={deletedView}
                  query={params.q || ""}
                  customFilter={params.customFilter || ""}
                  projectPreset={params.projectPreset || ""}
                  projectCategory={params.projectCategory || ""}
                  projectBudgetRanges={params.projectBudgetRanges || ""}
                  budgetMin={params.budgetMin || ""}
                  budgetMax={params.budgetMax || ""}
                  projectCategories={projectCategories}
                  saveSearchHref={pageHref(1)}
                  clearAllHref={pageHref(1, {
                    clearFilters: true,
                    filterPreset: "all_quotations",
                    documentType: "quotations",
                    dateField: "create_date",
                    customFilter: "",
                    groupBy: "",
                    projectPreset: "",
                    projectCategory: "",
                    projectBudgetRanges: "",
                    budgetMin: "",
                    budgetMax: "",
                    q: "",
                  })}
                  groupByLinks={[
                    { key: "salesperson", label: "Salesperson", href: pageHref(1, { groupBy: "salesperson" }) },
                    { key: "customer", label: "Customer", href: pageHref(1, { groupBy: "customer" }) },
                    { key: "order_date", label: "Order Date", href: pageHref(1, { groupBy: "order_date" }) },
                    { key: "payment_method", label: "Payment Method", href: pageHref(1, { groupBy: "payment_method" }) },
                  ]}
                />
              </div>
            </OrdersToInvoiceSelectionToolbar>

            <span className="text-xs text-slate-700">
              {uiRangeStart}-{uiRangeEnd} / {uiTotalItems}
            </span>

            <Link
              href={pageHref(Math.max(1, uiCurrentPage - 1))}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 ${
                uiCurrentPage <= 1 ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={pageHref(Math.min(uiTotalPages, uiCurrentPage + 1))}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 ${
                uiCurrentPage >= uiTotalPages ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>

            <SalesViewSwitcher activeView={currentViewMode} items={availableViews} />
            </div>
          ) : (
            <Link href="/crm" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Back to CRM
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-white">
        {isProjectsTab && (currentViewMode === "list" || currentViewMode === "table" || currentViewMode === "kanban") && (
          <div className="p-4">
            <CrmProjectTypesManager
              items={projectViewItems}
              defaultShowNew={params.newProject === "1"}
              showNewToggle={false}
              viewMode={currentViewMode === "kanban" ? "kanban" : currentViewMode === "table" ? "table" : "list"}
              groupBy={groupBy}
              projectCategoryValues={projectCategoryValues}
              projectBudgetRangeValues={projectBudgetRangeValues}
              hasBudgetLimits={Number.isFinite(budgetMin) || Number.isFinite(budgetMax)}
            />
          </div>
        )}

        {isProjectsTab && currentViewMode === "map" && (
          <div className="p-4">
            <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              Map view is grouped by project category because project geo-location is not available.
            </div>
            <div className="space-y-2">
              {Object.entries(projectCategoryBuckets).length === 0 ? (
                <p className="text-sm text-slate-500">No project data to display.</p>
              ) : (
                Object.entries(projectCategoryBuckets).map(([category, bucket]) => (
                  <div key={category} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{category}</p>
                    <p className="text-sm text-slate-600">
                      {bucket.count} project(s) - {currency.format(bucket.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isProjectsTab && currentViewMode === "calendar" && (
          <div className="space-y-3 p-4">
            {Object.entries(projectCalendarBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No projects yet</p>
            ) : (
              Object.entries(projectCalendarBuckets).map(([date, items]) => (
                <div key={date} className="rounded-md border border-slate-200">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{date}</div>
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">{currency.format(item.budget)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isProjectsTab && currentViewMode === "chart" && (
          <div className="space-y-3 p-4">
            {Object.entries(projectCategoryBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No chart data</p>
            ) : (
              Object.entries(projectCategoryBuckets).map(([category, bucket]) => {
                const width = Math.max(8, Math.round((bucket.count / Math.max(projectViewItems.length, 1)) * 100));
                return (
                  <div key={category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{category}</span>
                      <span className="text-slate-600">{bucket.count}</span>
                    </div>
                    <div className="h-3 rounded bg-slate-100">
                      <div className="h-3 rounded bg-cyan-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {isProjectsTab && currentViewMode === "history" && (
          <div className="divide-y">
            {recentProjectHistory.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No history available.</p>
            ) : (
              recentProjectHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-slate-600">{item.category || "Other"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{currency.format(item.budget)}</p>
                    <p className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isReportingTab && (
          <div className="space-y-6 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Quotation Value</p>
                  <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{currency.format(reportingTotalValue)}</p>
                <p className="mt-1 text-xs text-slate-500">{reportingRowCount} quotations in current filter</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Confirmed Orders</p>
                  <Trophy className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{confirmedRows.length}</p>
                <p className="mt-1 text-xs text-slate-500">{currency.format(confirmedValue)} won revenue</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Average Quotation</p>
                  <BarChart3 className="h-4 w-4 text-cyan-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{currency.format(averageQuotationValue)}</p>
                <p className="mt-1 text-xs text-slate-500">Useful for checking deal size quality</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Conversion</p>
                  <Activity className="h-4 w-4 text-violet-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{conversionRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-slate-500">
                  {draftRows.length} draft, {sentRows.length} sent
                </p>
              </div>
            </div>

            {(currentViewMode === "list" || currentViewMode === "table") && (
              <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pipeline by Status</p>
                      <p className="text-xs text-slate-500">Odoo-style sales stage health based on quotation status</p>
                    </div>
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-4 p-4">
                    {statusSummaryRows.length === 0 ? (
                      <p className="text-sm text-slate-500">No reporting data for the current filters.</p>
                    ) : (
                      statusSummaryRows.map((row) => (
                        <div key={row.status}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-800">{row.status}</span>
                            <span className="text-slate-600">
                              {row.count} docs - {currency.format(row.total)}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100">
                            <div
                              className="h-2.5 rounded-full bg-cyan-600"
                              style={{ width: `${Math.max(6, Math.round(row.share))}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Sales Snapshot</p>
                    <p className="text-xs text-slate-500">Quick checkpoints for the current pipeline</p>
                  </div>
                  <div className="space-y-3 p-4 text-sm">
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Draft Quotations</span>
                      <span className="font-semibold text-slate-900">{draftRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Sent Quotations</span>
                      <span className="font-semibold text-slate-900">{sentRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Confirmed Revenue</span>
                      <span className="font-semibold text-slate-900">{currency.format(confirmedValue)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Open Pipeline</span>
                      <span className="font-semibold text-slate-900">
                        {currency.format(Math.max(reportingTotalValue - confirmedValue, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Top Salespeople</p>
                    <p className="text-xs text-slate-500">Ranked by quotation value in the selected scope</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="px-4 py-3">Salesperson</th>
                          <th className="px-4 py-3">Quotations</th>
                          <th className="px-4 py-3">Confirmed</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-4 py-3">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportingSalespeople.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              No salesperson data.
                            </td>
                          </tr>
                        ) : (
                          reportingSalespeople.slice(0, 8).map((row) => (
                            <tr key={row.name} className="border-b last:border-b-0 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                              <td className="px-4 py-3 text-slate-600">{row.count}</td>
                              <td className="px-4 py-3 text-slate-600">{row.confirmed}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">{currency.format(row.total)}</td>
                              <td className="px-4 py-3 text-slate-600">
                                {row.lastDate ? new Date(row.lastDate).toLocaleDateString() : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Top Customers</p>
                    <p className="text-xs text-slate-500">Customers generating the highest quotation value</p>
                  </div>
                  <div className="space-y-3 p-4">
                    {reportingCustomers.length === 0 ? (
                      <p className="text-sm text-slate-500">No customer data.</p>
                    ) : (
                      reportingCustomers.slice(0, 6).map((customer) => (
                        <div key={customer.name} className="rounded-md border border-slate-200 px-3 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-slate-900">{customer.name}</p>
                              <p className="text-xs text-slate-500">{customer.count} quotations</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">{currency.format(customer.total)}</p>
                              <p className="text-xs text-slate-500">
                                {customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentViewMode === "chart" && (
              <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Monthly Trend</p>
                    <p className="text-xs text-slate-500">Revenue and confirmed orders over the last visible months</p>
                  </div>
                  <div className="space-y-4 p-4">
                    {reportingMonthlyTrend.length === 0 ? (
                      <p className="text-sm text-slate-500">No monthly trend available.</p>
                    ) : (
                      reportingMonthlyTrend.map((month) => {
                        const width = reportingTotalValue > 0 ? (month.total / reportingTotalValue) * 100 : 0;
                        return (
                          <div key={month.key}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-900">{month.label}</span>
                              <span className="text-slate-600">
                                {currency.format(month.total)} - {month.confirmed} confirmed
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100">
                              <div
                                className="h-3 rounded-full bg-emerald-500"
                                style={{ width: `${Math.max(8, Math.round(width))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Status Mix</p>
                    <p className="text-xs text-slate-500">Distribution of documents inside the current reporting scope</p>
                  </div>
                  <div className="space-y-4 p-4">
                    {statusSummaryRows.length === 0 ? (
                      <p className="text-sm text-slate-500">No status data.</p>
                    ) : (
                      statusSummaryRows.map((row) => (
                        <div key={row.status} className="rounded-md border border-slate-200 px-3 py-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900">{row.status}</p>
                            <span className="text-sm text-slate-600">{row.share.toFixed(1)}%</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {row.count} quotations - {currency.format(row.total)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentViewMode === "table" && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-500">
                      <th className="px-4 py-3">Quotation</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Salesperson</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportingRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                          No quotations match the current reporting filters.
                        </td>
                      </tr>
                    ) : (
                      reportingRows.slice(0, 20).map((quotation) => (
                        <tr key={quotation.id} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{quotation.quotationNo}</td>
                          <td className="px-4 py-3 text-slate-600">{quotation.clientName}</td>
                          <td className="px-4 py-3 text-slate-600">{quotation.salespersonName || "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {quotation.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {currency.format(Number(quotation.totalAmount || 0))}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(quotation.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {currentViewMode === "history" && (
              <div className="rounded-lg border border-slate-200">
                <div className="border-b bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Recent Sales Activity</p>
                  <p className="text-xs text-slate-500">Latest quotations and their current stage</p>
                </div>
                <div className="divide-y">
                  {reportingRecentRows.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No recent activity.</p>
                  ) : (
                    reportingRecentRows.map((quotation) => (
                      <div key={quotation.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{quotation.quotationNo} · {quotation.title}</p>
                          <p className="text-slate-600">
                            {quotation.clientName} · {quotation.salespersonName || "Unassigned"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            <Send className="h-3 w-3" />
                            {quotation.status}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(quotation.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isConfigurationTab && (
          <div className="p-8 text-sm text-slate-600">
            Configuration view is selected. Sales configuration options will appear here.
          </div>
        )}

        {isToInvoiceTab && !deletedView && (currentViewMode === "list" || currentViewMode === "table") && (
          <OrdersToInvoiceTable
            rows={pagedToInvoiceRowsView}
            emptyLabel={selectedToInvoiceLabel}
            selectionEnabled
          />
        )}

        {isToInvoiceTab && !deletedView && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedToInvoiceRowsView.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices available.</p>
            ) : (
              pagedToInvoiceRowsView.map((row) => (
                <Link
                  key={row.invoiceId}
                  href={`/crm/${row.crmLeadId}/quotations/${row.quotationId}/invoice`}
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{row.invoiceRef}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{row.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{row.clientName}</p>
                  <p className="text-xs text-slate-500">{row.salespersonName || "-"}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{row.totalLabel}</p>
                </Link>
              ))
            )}
          </div>
        )}

        {isToInvoiceTab && deletedView && (currentViewMode === "list" || currentViewMode === "table") && (
          <div className="p-6">
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3">Order No</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        No deleted invoices
                      </td>
                    </tr>
                  ) : (
                    filteredDeletedRows.map((row) => (
                      <tr key={row.invoiceId} className="border-b last:border-b-0">
                        <td className="p-3 font-medium">{row.invoiceRef}</td>
                        <td className="p-3">{row.orderNo}</td>
                        <td className="p-3">{row.clientName}</td>
                        <td className="p-3">{row.salespersonName || "-"}</td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isToInvoiceTab && deletedView && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDeletedRows.length === 0 ? (
              <p className="text-sm text-slate-500">No deleted invoices.</p>
            ) : (
              filteredDeletedRows.map((row) => (
                <div key={row.invoiceId} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{row.invoiceRef}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{row.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{row.clientName}</p>
                  <p className="text-xs text-slate-500">{row.salespersonName || "-"}</p>
                  <p className="mt-3 text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {selectedOrderTab === "sales-teams" && (currentViewMode === "list" || currentViewMode === "table") && (
          <SalesSummaryListTable
            rows={salesTeamRows}
            firstColumnLabel="Sales Team"
            emptyText="No sales team data"
          />
        )}

        {selectedOrderTab === "sales-teams" && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSalesTeamDetails.length === 0 ? (
              <p className="text-sm text-slate-500">No sales team data</p>
            ) : (
              sortedSalesTeamDetails.map((team) => (
                <Link
                  key={team.name}
                  href={pageHref(1, { tab: "orders", q: team.name })}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold text-slate-900">{team.name}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Quotations</span>
                      <span className="font-medium text-slate-900">{team.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Value</span>
                      <span className="font-medium text-slate-900">{currency.format(team.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last Activity</span>
                      <span className="font-medium text-slate-900">
                        {team.lastDate ? new Date(team.lastDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {selectedOrderTab === "customers" && (currentViewMode === "list" || currentViewMode === "table") && (
          <SalesSummaryListTable
            rows={customerRows}
            firstColumnLabel="Customer"
            emptyText="No customer data"
          />
        )}

        {selectedOrderTab === "customers" && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedCustomerDetails.length === 0 ? (
              <p className="text-sm text-slate-500">No customer data</p>
            ) : (
              sortedCustomerDetails.map((customer) => (
                <Link
                  key={customer.name}
                  href={pageHref(1, { tab: "orders", q: customer.name })}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold text-slate-900">{customer.name}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Quotations</span>
                      <span className="font-medium text-slate-900">{customer.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Value</span>
                      <span className="font-medium text-slate-900">{currency.format(customer.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last Quotation</span>
                      <span className="font-medium text-slate-900">
                        {customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {isQuotationLikeTab && (currentViewMode === "list" || currentViewMode === "table") && (
          <QuotationsOrdersListTable rows={quotationListRows} emptyLabel={selectedOrderLabel} />
        )}

        {isQuotationLikeTab && currentViewMode === "kanban" && (
          <div className="p-4">
            {pagedQuotations.length === 0 ? (
              <p className="text-sm text-slate-500">No quotations yet</p>
            ) : groupBy === "salesperson" && groupedQuotationKanbanColumns.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-2 sm:gap-5">
                {groupedQuotationKanbanColumns.map((column) => (
                  <div
                    key={column.key}
                    className="w-[252px] min-w-[252px] max-w-[252px] overflow-hidden border border-slate-300 bg-white sm:w-[312px] sm:min-w-[312px] sm:max-w-[312px]"
                  >
                    <div className="border-b border-slate-300 bg-cyan-50 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold leading-tight text-slate-950">{column.label}</p>
                          <p className="mt-1 text-sm text-slate-600">{column.count}</p>
                        </div>
                        <p className="text-[15px] font-semibold leading-tight text-slate-900">{currency.format(column.total)}</p>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {column.quotations.map((quotation) => (
                        <Link
                          key={quotation.id}
                          href={`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`}
                          className="block bg-white px-3 py-3 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[18px] font-semibold leading-tight text-slate-950">{quotation.quotationNo}</p>
                              <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-800">{quotation.title}</p>
                            </div>
                            <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                              {quotation.status}
                            </span>
                          </div>
                          <p className="mt-4 text-[22px] font-semibold leading-tight text-slate-950">
                            {currency.format(Number(quotation.totalAmount || 0))}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{quotation.clientName || "-"}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagedQuotations.map((quotation) => (
                  <Link
                    key={quotation.id}
                    href={`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`}
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{quotation.quotationNo}</p>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{quotation.status}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-slate-700">{quotation.title}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{quotation.clientName}</p>
                    <p className="text-xs text-slate-500">{quotation.salespersonName || "-"}</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{currency.format(Number(quotation.totalAmount || 0))}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "map" && (
          <div className="p-4">
            <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              Map view is grouped by customer because quotation addresses are not available in current data.
            </div>
            <div className="space-y-2">
              {Object.values(customerBuckets).length === 0 ? (
                <p className="text-sm text-slate-500">No customer data to display.</p>
              ) : (
                Object.values(customerBuckets).map((bucket) => (
                  <div key={bucket.client} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{bucket.client}</p>
                    <p className="text-sm text-slate-600">
                      {bucket.count} quotation(s) - {currency.format(bucket.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "calendar" && (
          <div className="space-y-3 p-4">
            {Object.entries(calendarBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No quotations yet</p>
            ) : (
              Object.entries(calendarBuckets).map(([date, items]) => (
                <div key={date} className="rounded-md border border-slate-200">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{date}</div>
                  <div className="divide-y">
                    {items.map((quotation) => (
                      <Link
                        key={quotation.id}
                        href={`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span>{quotation.quotationNo} - {quotation.clientName}</span>
                        <span className="font-medium">{currency.format(Number(quotation.totalAmount || 0))}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "chart" && (
          <div className="space-y-3 p-4">
            {Object.keys(statusBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No chart data</p>
            ) : (
              Object.entries(statusBuckets).map(([status, count]) => {
                const width = Math.max(8, Math.round((count / Math.max(totalItems, 1)) * 100));
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{status}</span>
                      <span className="text-slate-600">{count}</span>
                    </div>
                    <div className="h-3 rounded bg-slate-100">
                      <div className="h-3 rounded bg-cyan-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "history" && (
          <div className="divide-y">
            {filteredQuotations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No history available.</p>
            ) : (
              filteredQuotations.slice(0, 30).map((quotation) => (
                <Link
                  key={quotation.id}
                  href={`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{quotation.quotationNo} - {quotation.title}</p>
                    <p className="text-slate-600">{quotation.clientName} - {quotation.salespersonName || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{currency.format(Number(quotation.totalAmount || 0))}</p>
                    <p className="text-xs text-slate-500">{new Date(quotation.createdAt).toLocaleString()}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}


