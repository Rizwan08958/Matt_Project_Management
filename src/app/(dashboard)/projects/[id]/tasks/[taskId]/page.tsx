import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject } from "@/actions/project.actions";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TlTaskDetail } from "@/components/projects/tl-task-detail";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { normalizeTask } from "@/lib/project-task-utils";

interface TlTaskDetailsPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function TlTaskDetailsPage({ params }: TlTaskDetailsPageProps) {
  const { id, taskId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role !== "TEAMLEADER") {
    redirect(`/projects/${id}?view=details`);
  }

  const project = await getProject(id);
  if (!project) {
    notFound();
  }

  const projectWhere = buildProjectWhereForViewer({
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });
  const canViewProject = await db.project.count({
    where: {
      id: project.id,
      ...projectWhere,
    },
  });
  if (canViewProject === 0) {
    notFound();
  }

  const taskState = await getProjectTasks(id);
  if (taskState.error) {
    notFound();
  }

  const task = taskState.data
    .map(normalizeTask)
    .find((item) => item?.id === taskId) ?? null;
  if (!task) {
    notFound();
  }

  if (task.assigneeId !== session.user.id) {
    notFound();
  }

  const stageName =
    taskState.stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do";

  const projectEmployees = project.assignments
    .map((assignment) => assignment.user)
    .filter((user) => user.role === "EMPLOYEE")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${id}?view=kanban`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.code}</p>
        </div>
        <Badge variant="outline">Task Details</Badge>
      </div>

      <TlTaskDetail
        projectId={id}
        task={task}
        stageName={stageName}
        employees={projectEmployees}
      />
    </div>
  );
}

