import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");
  const canCreate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("CREATE");

  if (!hasClientModuleAccess || !canCreate) {
    redirect("/dashboard");
  }

  return (
    <ClientForm />
  );
}
