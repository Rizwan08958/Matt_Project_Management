import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmProjectTypes } from "@/actions/crm-project-types.actions";
import { CrmProjectTypesManager } from "@/components/crm/crm-project-types-manager";

export default async function CrmProjectsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const items = await getCrmProjectTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-8 text-lg">
        <Link href="/crm" className="font-semibold text-slate-900 hover:underline">CRM</Link>
        <Link href="/crm/quotations" className="text-slate-700 hover:underline">Sales</Link>
        <span className="font-semibold text-slate-900">Project</span>
        <span className="text-slate-700">Reporting</span>
        <span className="text-slate-700">Configuration</span>
      </div>

      <div className="rounded-md border bg-slate-50 p-4">
        <h1 className="text-2xl font-semibold">Project Types & Budgets</h1>
        <p className="text-sm text-slate-600">Create and manage project type entries with budget values.</p>
      </div>

      <CrmProjectTypesManager items={items} />
    </div>
  );
}
