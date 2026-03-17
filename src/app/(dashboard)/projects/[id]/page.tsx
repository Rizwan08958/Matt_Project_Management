import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject, getProjectStats } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pencil, ArrowLeft, Users, Clock, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ProjectStatus, Priority } from "@prisma/client";
import { AssignmentManager } from "@/components/projects/assignment-manager";
import { ProjectActions } from "@/components/projects/project-actions";
import { TlTaskSplitter } from "@/components/projects/tl-task-splitter";
import { EmployeeTaskList } from "@/components/projects/employee-task-list";
import { TaskProgressOverview } from "@/components/projects/task-progress-overview";
import { IndividualProjectUpdates } from "@/components/projects/individual-project-updates";
import { ProjectComments } from "@/components/projects/project-comments";
import { ProjectActivityHistory } from "@/components/projects/project-activity-history";
import { BaProjectTasks } from "@/components/projects/ba-project-tasks";
import { TlProjectKanban } from "@/components/projects/tl-project-kanban";
import { TlTeamMembers } from "@/components/projects/tl-team-members";
import { AdminProjectTaskMonitor } from "@/components/projects/admin-project-task-monitor";
import { AdminProjectReports } from "@/components/projects/admin-project-reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { canAccessAction } from "@/lib/auth";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}

const statusColors: Record<ProjectStatus, string> = {
  PLANNING: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-gray-400",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = await auth();
  if (!session?.user) return null;

  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const projectWhere = buildProjectWhereForViewer({
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });
  const matchingProjectCount = await db.project.count({
    where: {
      id: project.id,
      ...projectWhere,
    },
  });
  const canViewProject = matchingProjectCount > 0;

  if (!canViewProject) {
    notFound();
  }

  const stats = await getProjectStats(id);
  let projectLogs: Awaited<ReturnType<typeof db.activityLog.findMany>> = [];
  try {
    projectLogs = await db.activityLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  } catch {
    projectLogs = [];
  }
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
  const hasTaskManagementPermission =
    canCreateByPermission || canUpdateByPermission || canDeleteByPermission;
  const canManage = canUpdateByPermission;
  const canAssignMembers = canUpdateByPermission;
  const roleLimitedView =
    (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") &&
    (resolvedSearchParams.view === "details" || !resolvedSearchParams.view);
  const roleKanbanOnly =
    (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") &&
    resolvedSearchParams.view === "kanban";
  const roleTeamOnly =
    session.user.role === "TEAMLEADER" && resolvedSearchParams.view === "team";
  const isAdmin = session.user.role === "ADMIN";
  const isBaViewer = session.user.role === "BA";

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <Badge className={statusColors[project.status]}>
                  {project.status.replace("_", " ")}
                </Badge>
                <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
              </div>
              <p className="text-muted-foreground">{project.code}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ProjectActions project={project} />
            <Button asChild>
              <Link href={`/projects/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">{project.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium text-slate-900">{project.type}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm text-muted-foreground">Manager</p>
                      <p className="font-medium text-slate-900">{project.manager?.name || "Not assigned"}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium text-slate-900">
                        {project.startDate
                          ? format(new Date(project.startDate), "MMM d, yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm text-muted-foreground">Hold Days</p>
                      <p className="font-medium text-slate-900">{project.totalHoldDays} days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Assigned employees</CardDescription>
                </CardHeader>
                <CardContent>
                  <AssignmentManager
                    projectId={project.id}
                    projectName={project.name}
                    projectStatus={project.status}
                    projectType={project.type}
                    assignments={project.assignments}
                    canAssign={canAssignMembers}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <AdminProjectTaskMonitor
              projectId={project.id}
              assignments={project.assignments.map((assignment) => ({
                id: assignment.user.id,
                name: assignment.user.name,
                email: assignment.user.email,
                role: assignment.user.role,
              }))}
            />
          </TabsContent>

          <TabsContent value="reports">
            <AdminProjectReports
              projectId={project.id}
              teamMembers={project.assignments.map((assignment) => ({
                id: assignment.user.id,
                name: assignment.user.name,
                role: assignment.user.role,
              }))}
              hoursByUser={stats.hoursByUser.map((entry) => ({
                userId: entry.userId,
                _sum: { hours: entry._sum.hours ?? 0 },
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (isBaViewer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge className={statusColors[project.status]}>
                {project.status.replace("_", " ")}
              </Badge>
              <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
            </div>
            <p className="text-muted-foreground">{project.code}</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="mt-1">{project.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{project.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Manager</p>
                      <p className="font-medium">{project.manager?.name || "Not assigned"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {project.startDate
                          ? format(new Date(project.startDate), "MMM d, yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deadline</p>
                      <p className="font-medium">
                        {project.deadline
                          ? format(new Date(project.deadline), "MMM d, yyyy")
                          : "No deadline set"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Assigned employees for this project</CardDescription>
                </CardHeader>
                <CardContent>
                  {project.assignments.length === 0 ? (
                    <p className="text-muted-foreground">No team members assigned</p>
                  ) : (
                    <div className="space-y-3">
                      {project.assignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-medium">
                              {assignment.user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{assignment.user.name}</p>
                              <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{assignment.user.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            {project.type === "TEAM" && hasTaskManagementPermission ? (
              <TlProjectKanban
                projectId={project.id}
                assignments={project.assignments}
                canCreate={canCreateByPermission}
                canUpdate={canUpdateByPermission}
                canDelete={canDeleteByPermission}
              />
            ) : (
              <BaProjectTasks
                projectId={project.id}
                projectName={project.name}
                assignments={project.assignments.map((assignment) => ({
                  id: assignment.user.id,
                  name: assignment.user.name,
                  email: assignment.user.email,
                  role: assignment.user.role,
                }))}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (roleLimitedView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge className={statusColors[project.status]}>
                {project.status.replace("_", " ")}
              </Badge>
              <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
            </div>
            <p className="text-muted-foreground">{project.code}</p>
          </div>
        </div>

        <div className="inline-flex rounded-md border bg-background p-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${project.id}?view=details`}>Overview</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}?view=kanban`}>Tasks</Link>
          </Button>
          {session.user.role === "TEAMLEADER" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${project.id}?view=team`}>Team</Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.progress}%</div>
              <Progress value={project.progress} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Size</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.assignments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deadline</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {project.deadline ? format(new Date(project.deadline), "MMM d") : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                {project.deadline ? format(new Date(project.deadline), "yyyy") : "No deadline set"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="mt-1">{project.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{project.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manager</p>
                  <p className="font-medium">{project.manager?.name || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hold Days</p>
                  <p className="font-medium">{project.totalHoldDays} days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Members</CardTitle>
              <CardDescription>Team members for this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {project.assignments.length === 0 ? (
                  <p className="text-muted-foreground">No team members assigned</p>
                ) : (
                  project.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-medium">
                          {assignment.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.user.name}</p>
                          <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.user.role}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (roleKanbanOnly) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">{project.code}</p>
          </div>
        </div>

        <div className="inline-flex rounded-md border bg-background p-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}?view=details`}>Overview</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${project.id}?view=kanban`}>Tasks</Link>
          </Button>
          {session.user.role === "TEAMLEADER" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${project.id}?view=team`}>Team</Link>
            </Button>
          )}
        </div>

        {project.type === "TEAM" ? (
          hasTaskManagementPermission ? (
            <TlProjectKanban
              projectId={project.id}
              assignments={project.assignments}
              canCreate={canCreateByPermission}
              canUpdate={canUpdateByPermission}
              canDelete={canDeleteByPermission}
            />
          ) : (
            <EmployeeTaskList
              projectId={project.id}
              currentUserId={session.user.id}
              assignees={project.assignments.map((assignment) => ({
                id: assignment.user.id,
                name: assignment.user.name,
                role: assignment.user.role,
              }))}
            />
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Task Process Kanban</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kanban process is available only for TEAM projects.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (roleTeamOnly) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">{project.code}</p>
          </div>
        </div>

        <div className="inline-flex rounded-md border bg-background p-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}?view=details`}>Overview</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}?view=kanban`}>Tasks</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${project.id}?view=team`}>Team</Link>
          </Button>
        </div>

        <TlTeamMembers
          projectId={project.id}
          employees={project.assignments
            .filter((assignment) => assignment.user.role === "EMPLOYEE")
            .map((assignment) => ({
              id: assignment.user.id,
              name: assignment.user.name,
              email: assignment.user.email,
            }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge className={statusColors[project.status]}>
                {project.status.replace("_", " ")}
              </Badge>
              <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
            </div>
            <p className="text-muted-foreground">{project.code}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <ProjectActions project={project} />
            <Button asChild>
              <Link href={`/projects/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Hold Warning */}
      {project.status === "ON_HOLD" && project.holdReason && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Project on Hold</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{project.holdReason}</p>
              {project.holdStartDate && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  On hold since {format(new Date(project.holdStartDate), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {project.estimatedHours ? `of ${project.estimatedHours}h estimated` : "hours logged"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.assignments.length}</div>
            <p className="text-xs text-muted-foreground">members assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deadline</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.deadline ? format(new Date(project.deadline), "MMM d") : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.deadline
                ? format(new Date(project.deadline), "yyyy")
                : "No deadline set"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1">{project.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{project.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manager</p>
                <p className="font-medium">{project.manager?.name || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {project.startDate
                    ? format(new Date(project.startDate), "MMM d, yyyy")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hold Days</p>
                <p className="font-medium">{project.totalHoldDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Assigned employees</CardDescription>
          </CardHeader>
          <CardContent>
            {canAssignMembers ? (
              <AssignmentManager
                projectId={project.id}
                projectName={project.name}
                projectStatus={project.status}
                projectType={project.type}
                assignments={project.assignments}
                canAssign={canAssignMembers}
              />
            ) : (
              <div className="space-y-3">
                {project.assignments.length === 0 ? (
                  <p className="text-muted-foreground">No team members assigned</p>
                ) : (
                  project.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-medium">
                          {assignment.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.user.name}</p>
                          <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.user.role}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {canCreateByPermission && project.type === "TEAM" && (
          <TlTaskSplitter projectId={project.id} assignments={project.assignments} />
        )}

        {(session.user.role === "ADMIN" || session.user.role === "BA") && (
          <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
            <summary className="cursor-pointer list-none px-4 py-3 font-medium">
              {project.type === "TEAM"
                ? "Task Progress Overview (Click to show data)"
                : "Individual Daily Work Updates (Click to show data)"}
            </summary>
            <div className="px-2 pb-2">
              {project.type === "TEAM" ? (
                <TaskProgressOverview
                  projectId={project.id}
                  assignees={project.assignments.map((assignment) => ({
                    id: assignment.user.id,
                    name: assignment.user.name,
                    email: assignment.user.email,
                    role: assignment.user.role,
                  }))}
                />
              ) : (
                <IndividualProjectUpdates
                  projectId={project.id}
                  canSubmit={false}
                  title="Employee Daily Work Updates"
                />
              )}
            </div>
          </details>
        )}

        {(session.user.role === "EMPLOYEE" || session.user.role === "TEAMLEADER") &&
          (project.type === "TEAM" ? (
            hasTaskManagementPermission ? (
              <TlProjectKanban
                projectId={project.id}
                assignments={project.assignments}
                canCreate={canCreateByPermission}
                canUpdate={canUpdateByPermission}
                canDelete={canDeleteByPermission}
              />
            ) : session.user.role === "EMPLOYEE" ? (
              <EmployeeTaskList
                projectId={project.id}
                currentUserId={session.user.id}
                assignees={project.assignments.map((assignment) => ({
                  id: assignment.user.id,
                  name: assignment.user.name,
                  role: assignment.user.role,
                }))}
              />
            ) : null
          ) : (
            <IndividualProjectUpdates
              projectId={project.id}
              canSubmit={true}
              title="My Daily Work Comments"
            />
          ))}

        <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Project Comments (Click to show data)
          </summary>
          <div className="px-2 pb-2">
            <ProjectComments projectId={project.id} />
          </div>
        </details>

        <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Project Activity History (Click to show data)
          </summary>
          <div className="px-2 pb-2">
            <ProjectActivityHistory logs={projectLogs} />
          </div>
        </details>

        {/* Recent Time Entries */}
        <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Recent Time Entries (Click to show data)
          </summary>
          <div className="p-4">
            {project.timeEntries.length === 0 ? (
              <p className="text-muted-foreground">No time entries yet</p>
            ) : (
              <div className="space-y-3">
                {project.timeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                        {entry.user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{entry.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.hours}h</p>
                      <p className="text-sm text-muted-foreground max-w-xs truncate">
                        {entry.description || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

