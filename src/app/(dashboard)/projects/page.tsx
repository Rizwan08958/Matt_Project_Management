import { redirect } from "next/navigation";
import { getProjects, getProjectStages } from "@/actions/project.actions";
import { auth, canAccessAction } from "@/lib/auth";
import { ProjectBoardView } from "@/components/projects/project-board-view";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const hasProjectModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("PROJECT");

  if (!hasProjectModuleAccess) {
    redirect("/dashboard");
  }

  const projects = await getProjects(
    session.user.id,
    session.user.role,
    session.user.permissions
  );
  const stages = await getProjectStages();
  const canCreateByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "CREATE",
    module: "PROJECT",
  });
  const canUpdateByPermission =
    canAccessAction({
      role: session.user.role,
      permissions: session.user.permissions,
      action: "UPDATE",
      module: "PROJECT",
    }) ||
    canAccessAction({
      role: session.user.role,
      permissions: session.user.permissions,
      action: "EDIT",
      module: "PROJECT",
    });
  const canDeleteByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "DELETE",
    module: "PROJECT",
  });
  const canManageProjects = canUpdateByPermission;
  const canEditKanban = canUpdateByPermission;
  const canCreateProjects = session.user.role === "ADMIN";
  const canDeleteProjects = canDeleteByPermission;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ProjectBoardView
          projects={projects}
          stages={stages}
          canManageProjects={canManageProjects}
          canEditKanban={canEditKanban}
          canCreateStages={canCreateByPermission}
          canUpdateStages={canUpdateByPermission}
          canDeleteStages={canDeleteByPermission}
          canUpdateProjects={canUpdateByPermission}
          canDeleteProjects={canDeleteProjects}
          createProjectHref={canCreateProjects ? "/projects/new" : undefined}
          showTlDetailsMenu={
            session.user.role === "TEAMLEADER" ||
            session.user.role === "EMPLOYEE" ||
            session.user.role === "BA"
          }
        />
      </div>
    </div>
  );
}
