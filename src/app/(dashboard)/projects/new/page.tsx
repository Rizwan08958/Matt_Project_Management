import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasProjectModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("PROJECT");
  const isAdmin = session.user.role === "ADMIN";

  if (!hasProjectModuleAccess || !isAdmin) {
    redirect("/dashboard");
  }

  const managerCandidates = await db.user.findMany({
    where: {
      role: "BA",
      isActive: true,
    },
    select: { id: true, name: true, permissions: true },
  });
  const managers = managerCandidates
    .filter((manager) =>
      normalizeEmployeePermissions(manager.permissions).moduleAccess.includes("PROJECT")
    )
    .map((manager) => ({
      id: manager.id,
      name: manager.name,
    }));

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      serviceName: true,
      projectName: true,
      tags: true,
      phone: true,
      country: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">Create a new project</p>
      </div>

      <ProjectForm
        managers={managers}
        clients={clients}
        compactCreate
      />
    </div>
  );
}

