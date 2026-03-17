import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClients } from "@/actions/client.actions";
import { ClientTable } from "@/components/clients/client-table";

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");

  if (!hasClientModuleAccess) {
    redirect("/dashboard");
  }

  const canCreate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("CREATE");
  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");
  const canDelete =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("DELETE");

  const params = await searchParams;
  const query = params.q || "";
  const page = Number(params.page || 1);
  const data = await getClients({ query, page, pageSize: 10 });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-8 text-lg">
          <span className="font-semibold text-slate-900">Contacts</span>
          <span className="text-slate-500">Configuration</span>
        </div>
        <p className="text-muted-foreground">Manage your client contacts and activity</p>
      </div>
      <ClientTable
        clients={data.clients}
        page={data.page}
        pages={data.pages}
        query={data.query}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </div>
  );
}
