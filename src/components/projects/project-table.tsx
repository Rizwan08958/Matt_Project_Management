"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteProject, updateProjectStatus } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Play, Pause, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Priority, ProjectStatus, ProjectType } from "@prisma/client";
import { HoldDialog } from "./hold-dialog";

interface Project {
  id: string;
  name: string;
  code: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  deadline: Date | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string } }[];
  _count: { timeEntries: number };
}

interface ProjectTableProps {
  projects: Project[];
  canManage: boolean;
  canDelete?: boolean;
  showTlDetailsMenu?: boolean;
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

export function ProjectTable({
  projects,
  canManage,
  canDelete = false,
  showTlDetailsMenu = false,
}: ProjectTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [holdProjectId, setHoldProjectId] = useState<string | null>(null);

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteProject(deleteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project deleted successfully");
      }
      setDeleteId(null);
    });
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    startTransition(async () => {
      const result = await updateProjectStatus(id, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project status updated");
      }
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No projects found
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={
                        showTlDetailsMenu
                          ? `/projects/${project.id}?view=details`
                          : `/projects/${project.id}`
                      }
                      className="block truncate font-semibold hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{project.code}</p>
                  </div>
                  {(canManage || showTlDetailsMenu) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {showTlDetailsMenu && !canManage ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}?view=details`}>
                              Project Details
                            </Link>
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}?view=details`}>
                                Project Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {project.status !== "IN_PROGRESS" && project.status !== "COMPLETED" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "IN_PROGRESS")}>
                                <Play className="mr-2 h-4 w-4" />
                                Start Project
                              </DropdownMenuItem>
                            )}
                            {project.status === "IN_PROGRESS" && (
                              <DropdownMenuItem onClick={() => setHoldProjectId(project.id)}>
                                <Pause className="mr-2 h-4 w-4" />
                                Put on Hold
                              </DropdownMenuItem>
                            )}
                            {project.status !== "COMPLETED" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "COMPLETED")}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => setDeleteId(project.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{project.type}</Badge>
                  <Badge className={statusColors[project.status]}>{project.status.replace("_", " ")}</Badge>
                  <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progress</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={project.progress} className="h-2 flex-1" />
                      <span className="text-sm">{project.progress}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deadline</p>
                    <p className="mt-2 text-sm">
                      {project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</p>
                  <div className="mt-2 flex -space-x-2">
                    {project.assignments.slice(0, 3).map((a) => (
                      <div
                        key={a.user.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-medium"
                        title={a.user.name}
                      >
                        {a.user.name.charAt(0)}
                      </div>
                    ))}
                    {project.assignments.length > 3 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium">
                        +{project.assignments.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Team</TableHead>
                {(canManage || showTlDetailsMenu) && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage || showTlDetailsMenu ? 8 : 7} className="py-8 text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={
                            showTlDetailsMenu
                              ? `/projects/${project.id}?view=details`
                              : `/projects/${project.id}`
                          }
                          className="font-medium hover:underline"
                        >
                          {project.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{project.code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[project.status]}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-2 w-20" />
                        <span className="text-sm">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.deadline
                        ? format(new Date(project.deadline), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {project.assignments.slice(0, 3).map((a) => (
                          <div
                            key={a.user.id}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-medium"
                            title={a.user.name}
                          >
                            {a.user.name.charAt(0)}
                          </div>
                        ))}
                        {project.assignments.length > 3 && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium">
                            +{project.assignments.length - 3}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {(canManage || showTlDetailsMenu) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {showTlDetailsMenu && !canManage ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/projects/${project.id}?view=details`}>
                                  Project Details
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/projects/${project.id}?view=details`}>
                                    Project Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link href={`/projects/${project.id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {project.status !== "IN_PROGRESS" && project.status !== "COMPLETED" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(project.id, "IN_PROGRESS")}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Project
                                  </DropdownMenuItem>
                                )}
                                {project.status === "IN_PROGRESS" && (
                                  <DropdownMenuItem onClick={() => setHoldProjectId(project.id)}>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Put on Hold
                                  </DropdownMenuItem>
                                )}
                                {project.status !== "COMPLETED" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(project.id, "COMPLETED")}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => setDeleteId(project.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the project and its related data.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HoldDialog
        projectId={holdProjectId}
        open={!!holdProjectId}
        onOpenChange={() => setHoldProjectId(null)}
      />
    </>
  );
}
