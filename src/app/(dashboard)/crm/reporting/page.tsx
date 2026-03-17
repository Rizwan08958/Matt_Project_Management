import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmReportingData, type CrmReportingFilters } from "@/lib/crm-reporting";
import { ModuleTopNav } from "@/components/layout/module-top-nav";
import { CrmReportingContent } from "@/components/crm/reporting/crm-reporting-content";

interface CrmReportingPageProps {
  searchParams: Promise<CrmReportingFilters>;
}

export default async function CrmReportingPage({ searchParams }: CrmReportingPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" &&
      !session.user.moduleAccess.includes("CRM") &&
      !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const report = await getCrmReportingData(params, {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });

  return (
    <div className="space-y-4">
      <ModuleTopNav
        title="CRM"
        titleHref="/crm"
        items={[
          { label: "Reporting", href: "/crm/reporting", active: true },
          { label: "Configuration", href: "/crm/quotations?tab=configuration" },
        ]}
      />
      <CrmReportingContent
        report={report}
        basePath="/crm/reporting"
        exportBasePath="/api/crm-reporting/export"
      />
    </div>
  );
}
