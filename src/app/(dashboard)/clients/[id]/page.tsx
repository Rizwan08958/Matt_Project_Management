import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Mail, Phone, MapPin, Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { getClient, getClientActivityLogs } from "@/actions/client.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientActivityPanel } from "@/components/clients/client-activity-panel";

interface ClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
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

  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");

  const client = await getClient(id);
  if (!client) {
    notFound();
  }

  const logs = await getClientActivityLogs(id, 20);

  const initials = client.name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Client Details</h1>
            <p className="text-sm text-muted-foreground">View contact information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.isActive ? "default" : "secondary"}>
            {client.isActive ? "Active" : "Inactive"}
          </Badge>
          {canUpdate && (
            <Button asChild>
              <Link href={`/clients/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-white p-5">
          <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-amber-600 text-2xl font-semibold text-white">
              {initials || "C"}
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{client.name}</h2>
              <p className="text-sm text-muted-foreground">{client.collegeName || "College not provided"}</p>
            </div>
          </div>

          <div className="grid gap-6 pt-5 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Contact</h3>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-slate-500" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-slate-500" />
                <span>{client.phone || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{client.country || "-"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Address</h3>
              <p className="text-sm text-muted-foreground">{client.street || "-"}</p>
              <p className="text-sm text-muted-foreground">
                {[client.city, client.state, client.zip].filter(Boolean).join(", ") || "-"}
              </p>
              <p className="text-sm text-muted-foreground">{client.country || "-"}</p>
              {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Project Name</h3>
              <p className="text-sm text-muted-foreground">{client.projectName || "-"}</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700">Tags</h3>
              <p className="text-sm text-muted-foreground">{client.tags || "-"}</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes || "-"}</p>
            </div>
          </div>

          <div className="mt-5 border-t pt-4 text-xs text-slate-500">
            <p>Created: {format(new Date(client.createdAt), "MMM d, yyyy h:mm a")}</p>
            <p>Updated: {format(new Date(client.updatedAt), "MMM d, yyyy h:mm a")}</p>
          </div>
        </div>

        <ClientActivityPanel
          clientId={client.id}
          clientName={client.name}
          clientEmail={client.email}
          logs={logs}
        />
      </div>
    </div>
  );
}
