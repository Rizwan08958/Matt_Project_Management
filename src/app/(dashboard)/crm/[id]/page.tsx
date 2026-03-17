import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArchivedCrmLeads, getCrmLead, getCrmStages, getDeletedCrmLeads } from "@/actions/crm.actions";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CrmLeadRegister } from "@/components/crm/crm-lead-register";
import { CrmLeadArrowNav } from "@/components/crm/crm-lead-arrow-nav";
import { CrmPageShareDownload } from "@/components/crm/crm-page-share-download";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import Link from "next/link";
import { CalendarDays, Settings, Star } from "lucide-react";

interface CrmLeadPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; label?: string; scope?: string }>;
}

function getVisibleLeadTags(tags: string | null) {
  if (!tags) return "";
  const marker = "__client_meta__:";
  const markerIndex = tags.indexOf(marker);
  const userTags = markerIndex >= 0 ? tags.slice(0, markerIndex) : tags;
  return userTags.replace(/[,\s]+$/g, "").trim();
}

export default async function CrmLeadPage({ params, searchParams }: CrmLeadPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  let stages: Awaited<ReturnType<typeof getCrmStages>> = [];
  let lead: Awaited<ReturnType<typeof getCrmLead>> = null;
  let clients: Array<{
    name: string;
    email: string;
    phone: string | null;
    street: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }> = [];
  try {
    stages = await getCrmStages();
    lead = await getCrmLead(id);
    if (!lead) {
      notFound();
    }
    clients = await db.client.findMany({
      where: { isActive: true },
      select: {
        name: true,
        email: true,
        phone: true,
        street: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        country: true,
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("CRM lead page failed to load", error);
    return (
      <div className="rounded-md border bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">CRM is temporarily unavailable</h1>
        <p className="mt-2 text-sm">
          Could not connect to the database. Please check `DATABASE_URL` and Neon connectivity, then refresh.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/crm">Back to CRM</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!lead) {
    notFound();
  }

  const backHref =
    typeof resolvedSearchParams.from === "string" && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/crm";
  const backLabel =
    typeof resolvedSearchParams.label === "string" && resolvedSearchParams.label.trim().length > 0
      ? `Back to ${resolvedSearchParams.label.trim()}`
      : "Back to CRM";
  const scope =
    resolvedSearchParams.scope === "deleted" || resolvedSearchParams.scope === "archive"
      ? resolvedSearchParams.scope
      : null;

  const stageOrder = stages.findIndex((stage) => stage.key === lead.stage);
  const expectedRevenueValue = lead.value ?? 0;
  const expectedRevenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(expectedRevenueValue);
  const probabilityLevel = Math.min(3, Math.max(1, lead.probabilityLevel ?? 1));
  const probabilityPercent = probabilityLevel === 1 ? 25 : probabilityLevel === 2 ? 50 : 75;
  const probabilityLabel = probabilityLevel === 1 ? "Low" : probabilityLevel === 2 ? "Medium" : "High";
  const visibleTags = getVisibleLeadTags(lead.tags);
  const leadHeaderTitle = lead.title || lead.clientName || "Opportunity";
  const shouldHideArchived = session.user.role !== "ADMIN";
  const hiddenStageKeys = new Set(
    stages
      .filter((stage) => {
        if (!shouldHideArchived) return false;
        const normalized = stage.label.trim().toLowerCase();
        return normalized === "archived" || normalized === "deleted";
      })
      .map((stage) => stage.key)
  );
  const leadIds = scope === "deleted"
    ? (await getDeletedCrmLeads()).map((item) => item.id)
    : scope === "archive"
      ? (await getArchivedCrmLeads()).map((item) => item.id)
      : (
          await db.crmLead.findMany({
            where: shouldHideArchived ? { stage: { notIn: Array.from(hiddenStageKeys) } } : undefined,
            select: { id: true },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          })
        ).map((item) => item.id);
  const currentIndex = Math.max(0, leadIds.indexOf(lead.id));
  const totalCount = leadIds.length || 1;
  const currentCount = leadIds.length ? currentIndex + 1 : 1;
  const prevLeadId = currentIndex > 0 ? leadIds[currentIndex - 1] : null;
  const nextLeadId = currentIndex < leadIds.length - 1 ? leadIds[currentIndex + 1] : null;
  const navQuery = (() => {
    const query = new URLSearchParams();
    if (backHref) query.set("from", backHref);
    if (typeof resolvedSearchParams.label === "string" && resolvedSearchParams.label.trim()) {
      query.set("label", resolvedSearchParams.label.trim());
    }
    if (scope) query.set("scope", scope);
    const value = query.toString();
    return value ? `?${value}` : "";
  })();

  return (
    <div className="space-y-4 pb-0">
      <div className="flex flex-wrap items-center gap-4 text-lg md:gap-8">
        <Link href={backHref} className="font-semibold text-slate-900 hover:underline">{backLabel}</Link>
        <Link href="/crm" className="text-slate-700 hover:underline">CRM</Link>
        <Link href="/crm/quotations" className="text-slate-700 hover:underline">Sales</Link>
        <Link href="/crm/projects" className="text-slate-700 hover:underline">Project</Link>
        <span className="text-slate-700">Reporting</span>
        <span className="text-slate-700">Configuration</span>
      </div>

      <div className="rounded-md border bg-white">
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 leading-tight">
                <div className="mt-0.5 flex items-start gap-2">
                  <p className="truncate text-3xl font-medium text-slate-900">{leadHeaderTitle}</p>
                  <Settings className="h-4 w-4 shrink-0 text-slate-700" />
                </div>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
              <CrmPageShareDownload path={`/crm/${lead.id}`} shareTitle={leadHeaderTitle} />
              <Button variant="outline" className="h-10 gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>No Meeting</span>
              </Button>
              <CrmLeadArrowNav
                currentCount={currentCount}
                totalCount={totalCount}
                prevLeadId={prevLeadId}
                nextLeadId={nextLeadId}
                queryString={navQuery}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CrmQuotationNav leadId={lead.id} backHref={backHref} />
              <div className="ml-2 flex flex-wrap items-center gap-2">
                {stages.map((stage, index) => {
                  const current = index === stageOrder;
                  const passed = index < stageOrder;
                  return (
                    <div
                      key={stage.key}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        current
                          ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                          : passed
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {stage.label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-[#7c4a69] hover:bg-[#6d425d]">Won</Button>
              <Button size="sm" variant="secondary">Enrich</Button>
              <Button size="sm" variant="secondary">Lost</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-4 pt-4 pb-2 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-md border">
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-slate-500">Expected Revenue</p>
                  <p className="mt-1 text-4xl font-light text-slate-900">{expectedRevenue}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Probability</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-4xl font-light text-slate-900">{probabilityPercent}%</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((level) => (
                        <Star
                          key={level}
                          className={`h-5 w-5 ${level <= probabilityLevel ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-600">{probabilityLabel}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-500">Contact</p>
                    <p className="font-medium text-slate-900">{lead.clientName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{lead.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium text-slate-900">{lead.phone || "-"}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-slate-500">Salesperson</p>
                    <p className="font-medium text-slate-900">{session.user.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Expected Closing</p>
                    <p className="font-medium text-slate-900">
                      {lead.expectedClosingDate ? new Date(lead.expectedClosingDate).toLocaleDateString() : "No closing estimate"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tags</p>
                    <p className="font-medium text-slate-900">{visibleTags || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t bg-slate-50">
              <CrmLeadRegister lead={lead} clients={clients} />
            </div>
          </div>

          <div className="self-start rounded-md border p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" className="bg-[#7c4a69] hover:bg-[#6d425d]">Send message</Button>
              <Button size="sm" variant="secondary">Log note</Button>
              <Button size="sm" variant="secondary">Activity</Button>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-400">Today</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-amber-600 text-sm font-semibold text-white">
                  {(lead.clientName || lead.title).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{(lead.clientName || "Lead").toUpperCase()}</p>
                  <p className="text-xs text-slate-500">{new Date(lead.createdAt).toLocaleTimeString()}</p>
                  <p className="text-sm text-slate-700">Lead/Opportunity created</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
