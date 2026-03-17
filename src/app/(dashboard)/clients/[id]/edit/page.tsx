import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClient } from "@/actions/client.actions";
import { ClientForm } from "@/components/clients/client-form";

interface EditClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");
  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");

  if (!hasClientModuleAccess || !canUpdate) {
    redirect("/dashboard");
  }

  const client = await getClient(id);
  if (!client) {
    notFound();
  }

  return (
    <ClientForm client={client} />
  );
}
