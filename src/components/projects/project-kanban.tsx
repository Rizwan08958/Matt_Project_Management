"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, useEffect, useMemo, useState, useTransition } from "react";
import { Priority, ProjectType, Role } from "@prisma/client";
import { format } from "date-fns";
import { Check, ChevronRight, GripVertical, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectStage,
  deleteProject,
  deleteProjectStage,
  renameProjectStage,
  updateProjectStage,
} from "@/actions/project.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Stage {
  id: string;
  name: string;
  sortOrder: number;
}

interface Project {
  id: string;
  name: string;
  code: string;
  type: ProjectType;
  priority: Priority;
  progress: number;
  deadline: Date | null;
  stageId: string | null;
  stage: { id: string; name: string; sortOrder: number } | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string; role: Role } }[];
  _count: { timeEntries: number };
}

interface ProjectKanbanProps {
  projects: Project[];
  stages: Stage[];
  canEdit: boolean;
  canCreateStages?: boolean;
  canUpdateStages?: boolean;
  canDeleteStages?: boolean;
  canUpdateProjects?: boolean;
  canDeleteProjects?: boolean;
  showTlDetailsMenu?: boolean;
}

const priorityColors: Record<Priority, string> = {
  LOW: "bg-gray-400",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

const STAGE_THEMES = [
  "bg-cyan-50 border-cyan-200",
  "bg-blue-50 border-blue-200",
  "bg-amber-50 border-amber-200",
  "bg-emerald-50 border-emerald-200",
  "bg-rose-50 border-rose-200",
  "bg-violet-50 border-violet-200",
] as const;

export function ProjectKanban({
  projects,
  stages,
  canEdit,
  canCreateStages = false,
  canUpdateStages = false,
  canDeleteStages = false,
  canUpdateProjects = false,
  canDeleteProjects = false,
  showTlDetailsMenu = false,
}: ProjectKanbanProps) {
  const MIN_STAGE_WIDTH = 260;
  const MAX_STAGE_WIDTH = 700;
  const DEFAULT_STAGE_WIDTH = 320;
  const [isPending, startTransition] = useTransition();
  const [localProjects, setLocalProjects] = useState(projects);
  const [stageWidths, setStageWidths] = useState<Record<string, number>>({});
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [deleteStageTarget, setDeleteStageTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const router = useRouter();

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [stages]
  );

  const resolveStageId = (project: Project) => {
    if (project.stageId) return project.stageId;
    return orderedStages[0]?.id ?? null;
  };

  const moveProjectLocal = (projectId: string, nextStageId: string) => {
    setLocalProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, stageId: nextStageId } : project
      )
    );
  };

  const handleStageMove = (project: Project, nextStageId: string) => {
    const previousStageId = resolveStageId(project);
    if (!previousStageId || previousStageId === nextStageId) return;

    moveProjectLocal(project.id, nextStageId);

    startTransition(async () => {
      const result = await updateProjectStage(project.id, nextStageId);
      if (result.error) {
        moveProjectLocal(project.id, previousStageId);
        toast.error(result.error);
      } else {
        toast.success("Project moved");
      }
    });
  };

  const handleDeleteStage = (stageId: string, stageName: string) => {
    setDeleteStageTarget({ id: stageId, name: stageName });
  };

  const handleConfirmDeleteStage = () => {
    if (!deleteStageTarget) return;
    const { id } = deleteStageTarget;

    startTransition(async () => {
      const result = await deleteProjectStage(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stage deleted");
      }
      setDeleteStageTarget(null);
    });
  };

  const startEditStage = (stage: Stage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const cancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveEditStage = () => {
    if (!editingStageId) return;
    const name = editingStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    startTransition(async () => {
      const result = await renameProjectStage(editingStageId, name);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stage updated");
        cancelEditStage();
      }
    });
  };

  const handleConfirmAddStage = () => {
    const name = newStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);

    startTransition(async () => {
      const result = await createProjectStage(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stage added");
      setNewStageName("");
      setShowAddStageInput(false);
    });
  };

  const handleCancelAddStage = () => {
    setNewStageName("");
    setShowAddStageInput(false);
  };

  const handleDragStart = (projectId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggedProjectId(projectId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
  };

  const handleDragOver = (stageId: string, event: DragEvent<HTMLDivElement>) => {
    if (!canEdit || isPending) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  };

  const handleDrop = (nextStageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverStageId(null);

    if (!canEdit || isPending) return;

    const droppedProjectId = event.dataTransfer.getData("text/plain") || draggedProjectId;
    if (!droppedProjectId) return;

    const project = localProjects.find((item) => item.id === droppedProjectId);
    if (!project) return;

    handleStageMove(project, nextStageId);
  };

  const handleDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverStageId(null);
  };

  const startResizeStage = (targetStageId: string, startX: number) => {
    const initialWidth = stageWidths[targetStageId] ?? DEFAULT_STAGE_WIDTH;

    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.max(
        MIN_STAGE_WIDTH,
        Math.min(MAX_STAGE_WIDTH, initialWidth + (event.clientX - startX))
      );
      setStageWidths((prev) => ({ ...prev, [targetStageId]: nextWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleDeleteProject = () => {
    if (!deleteProjectId) return;

    startTransition(async () => {
      const result = await deleteProject(deleteProjectId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLocalProjects((current) =>
          current.filter((project) => project.id !== deleteProjectId)
        );
        toast.success("Project deleted successfully");
      }
      setDeleteProjectId(null);
    });
  };

  const handleConfirmEditProject = () => {
    if (!editProjectId) return;
    router.push(`/projects/${editProjectId}/edit`);
    setEditProjectId(null);
  };

  if (orderedStages.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No stages configured
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-auto pb-2">
          {orderedStages.map((stage, stageIndex) => {
              const stageProjects = localProjects.filter(
                (project) => resolveStageId(project) === stage.id
              );
              const themeClass = STAGE_THEMES[stageIndex % STAGE_THEMES.length];
              const isDropTarget = dragOverStageId === stage.id;

              return (
                <div
                  key={stage.id}
                  style={{ width: stageWidths[stage.id] ?? DEFAULT_STAGE_WIDTH }}
                  className="flex min-h-full min-w-[260px] shrink-0 self-stretch flex-col"
                >
                  <div className={`sticky top-0 z-20 flex items-center justify-between gap-2 rounded-none border px-3 py-2 ${themeClass}`} draggable={false}>
                    <div className="min-w-0 flex flex-1 items-center gap-2">
                      {editingStageId === stage.id ? (
                        <Input
                          value={editingStageName}
                          onChange={(event) => setEditingStageName(event.target.value)}
                          className="h-8 min-w-0 w-full max-w-[10rem]"
                          autoFocus
                          disabled={isPending}
                        />
                      ) : (
                        <h3 className="truncate text-2xl font-semibold tracking-tight">{stage.name}</h3>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{stageProjects.length}</Badge>
                      {canUpdateStages && editingStageId === stage.id && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={saveEditStage}
                            disabled={isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEditStage}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canUpdateStages && editingStageId !== stage.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditStage(stage)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteStages && orderedStages.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteStage(stage.id, stage.name)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-col-resize"
                        aria-label={`Resize ${stage.name} stage`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          startResizeStage(stage.id, event.clientX);
                        }}
                      >
                        <GripVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`flex min-h-0 flex-1 flex-col transition-colors ${isDropTarget ? "bg-muted/35" : ""}`}
                    onDragOver={(event) => handleDragOver(stage.id, event)}
                    onDrop={(event) => handleDrop(stage.id, event)}
                  >
                    {stageProjects.map((project) => (
                      <Card
                        key={project.id}
                        className={`gap-0 rounded-none border-x border-b border-t-0 border-slate-400 py-0 shadow-none first:rounded-t-none first:border-t ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                        draggable={canEdit && !isPending}
                        onDragStart={(event) => handleDragStart(project.id, event)}
                        onDragEnd={handleDragEnd}
                      >
                        <CardHeader className="px-2.5 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-sm leading-tight">
                                <Link
                                  href={
                                    showTlDetailsMenu
                                      ? `/projects/${project.id}?view=details`
                                      : `/projects/${project.id}`
                                  }
                                  className="hover:underline"
                                >
                                  {project.name}
                                </Link>
                              </CardTitle>
                              <p className="text-[11px] text-muted-foreground">{project.code}</p>
                            </div>
                            {(canUpdateProjects || canDeleteProjects) && (
                              <div className="flex items-center gap-1">
                                {canUpdateProjects && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setEditProjectId(project.id)}
                                    disabled={isPending}
                                    aria-label="Edit project"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDeleteProjects && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700"
                                    onClick={() => setDeleteProjectId(project.id)}
                                    disabled={isPending}
                                    aria-label="Delete project"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                            {!canUpdateProjects && !canDeleteProjects && showTlDetailsMenu && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label="Project options"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/projects/${project.id}?view=details`}>
                                      Project Details
                                    </Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-2 px-2.5 pb-2">
                          {(() => {
                            const tlNames = project.assignments
                              .filter((assignment) => assignment.user.role === "TEAMLEADER")
                              .map((assignment) => assignment.user.name);
                            return (
                              <div className="space-y-0.5 text-xs text-muted-foreground">
                                <p>BA: {project.manager?.name || "Not assigned"}</p>
                                <p>
                                  Team Leader:{" "}
                                  {tlNames.length > 0 ? tlNames.join(", ") : "Not assigned"}
                                </p>
                              </div>
                            );
                          })()}

                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{project.type}</Badge>
                            <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span>{project.progress}%</span>
                            </div>
                            <Progress value={project.progress} className="h-2" />
                          </div>

                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <p>
                              Deadline:{" "}
                              {project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "-"}
                            </p>
                            <p>Entries: {project._count.timeEntries}</p>
                          </div>

                          <Button asChild variant="outline" size="sm" className="h-8 w-full">
                            <Link
                              href={
                                showTlDetailsMenu
                                  ? `/projects/${project.id}?view=details`
                                  : `/projects/${project.id}`
                              }
                            >
                              Open Project
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

                    {stageProjects.length === 0 && (
                      <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No projects in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
          })}
          {canCreateStages ? (
            <div className="sticky right-0 top-0 z-20 flex w-10 shrink-0 self-start items-start justify-center bg-white/95">
              {showAddStageInput ? (
                <div className="absolute left-full top-0 w-[250px] border border-slate-300 bg-slate-100 shadow-sm">
                  <div className="border-b border-slate-300 bg-slate-100 p-2.5">
                    <p className="text-lg font-semibold tracking-tight text-slate-900">New Stage</p>
                    <p className="mt-1 text-xs text-slate-500">Create a new project stage</p>
                  </div>
                  <div className="space-y-2 p-2">
                    <Input
                      value={newStageName}
                      onChange={(event) => setNewStageName(event.target.value)}
                      placeholder="Stage name..."
                      className="h-9 bg-white"
                      autoFocus
                      disabled={isPending}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleConfirmAddStage}
                        className="h-8 px-3"
                        disabled={isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCancelAddStage}
                        className="h-8 px-3"
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddStageInput(true)}
                  className="group flex h-full min-h-[200px] w-10 flex-col items-center justify-start gap-2 rounded-none px-0 pt-1 text-slate-800 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="[writing-mode:vertical-rl] rotate-180 text-base leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                    Add Stage
                  </span>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
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
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!editProjectId}
        onOpenChange={(open) => {
          if (!open) setEditProjectId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit project?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to continue editing this project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEditProject}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteStageTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteStageTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will delete stage &quot;{deleteStageTarget?.name}&quot; and move its projects.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteStage}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
