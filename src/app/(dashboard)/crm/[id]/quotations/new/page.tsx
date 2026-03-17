import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmProjectTypes } from "@/actions/crm-project-types.actions";
import { CrmQuotationForm } from "@/components/crm/crm-quotation-form";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";

interface NewCrmQuotationPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewCrmQuotationPage({ params }: NewCrmQuotationPageProps) {
  const { id } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const lead = await getCrmLead(id);
  const projectTypes = await getCrmProjectTypes();
  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="orders" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Quotation</h1>
          <p className="text-sm text-slate-600">Lead: {lead.title}</p>
          <div className="mt-2">
            <CrmQuotationNav leadId={id} />
          </div>
        </div>
      </div>

      <CrmQuotationForm lead={lead} salespersonName={session.user.name || "Sales"} projectTypes={projectTypes} />
    </div>
  );
}
