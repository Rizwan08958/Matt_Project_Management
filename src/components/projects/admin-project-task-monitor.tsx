"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  createProjectTaskStageByAdmin,
  deleteProjectTaskStageByAdmin,
  getProjectTasks,
} from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskStatus,
  normalizeTask,
} from "@/lib/project-task-utils";

interface TeamPerson {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminProjectTaskMonitorProps {
  projectId: string;
  assignments: TeamPerson[];
}

const STAGE_THEMES = [
  "border-cyan-200 bg-cyan-50/60",
  "border-blue-200 bg-blue-50/60",
  "border-amber-200 bg-amber-50/60",
  "border-emerald-200 bg-emerald-50/60",
  "border-rose-200 bg-rose-50/60",
] as const;

export function AdminProjectTaskMonitor({ projectId, assignments }: AdminProjectTaskMonitorProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; sortOrder: number }[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [deleteStageTarget, setDeleteStageTarget] = useState<{ id: string; name: string } | null>(null);

  const peopleMap = useMemo(
    () => new Map(assignments.map((person) => [person.id, person])),
    [assignments]
  );

  useEffect(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
    });
  }, [projectId]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of tasks) {
      const assignedStageId = task.stageId && initial[task.stageId] ? task.stageId : stages[0]?.id;
      if (!assignedStageId) continue;
      initial[assignedStageId].push(task);
    }

    return initial;
  }, [tasks, stages]);

  const totalTasks = tasks.length;
  const totalStages = stages.length;

  const getStageName = (task: ProjectTask) =>
    stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do";

  const getResponsibleName = (task: ProjectTask) => {
    if (task.employeeAssigneeId && peopleMap.has(task.employeeAssigneeId)) {
      return peopleMap.get(task.employeeAssigneeId)?.name ?? "Unknown";
    }
    return peopleMap.get(task.assigneeId)?.name ?? "Unknown";
  };

  const addStage = () => {
    const name = newStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("name", name);
    setIsSavingStage(true);
    createProjectTaskStageByAdmin(formData).then((result) => {
      setIsSavingStage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
      setNewStageName("");
      setIsAddStageOpen(false);
      toast.success("Stage added");
    });
  };

  const deleteStage = (stageId: string) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("stageId", stageId);

    setIsSavingStage(true);
    deleteProjectTaskStageByAdmin(formData).then((result) => {
      setIsSavingStage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
      toast.success("Stage deleted");
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Task Board</h3>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {totalTasks} tasks
                </Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  {totalStages} stages
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor progress across stages.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-300 hover:bg-slate-50"
                onClick={() => setIsAddStageOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Stage
              </Button>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  className="rounded-md"
                  onClick={() => setViewMode("kanban")}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Kanban
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  className="rounded-md"
                  onClick={() => setViewMode("list")}
                >
                  <List className="mr-2 h-4 w-4" />
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/50">
          <CardContent className="py-10">
            <div className="mx-auto max-w-lg text-center">
              <p className="text-base font-medium text-slate-800">No tasks yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Once BA or TL creates tasks, they will appear here stage-wise.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[960px] items-start gap-5 pb-2">
            {stages.map((stage, stageIndex) => (
              <div
                key={stage.id}
                className="w-full min-w-[320px]"
              >
                <div className={`border ${STAGE_THEMES[stageIndex % STAGE_THEMES.length]}`}>
                  <div className="flex items-center justify-between border-b border-slate-300/80 px-4 py-3">
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{stage.name}</h3>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="h-7 min-w-7 rounded-full bg-slate-200 px-2 text-sm font-semibold text-slate-700"
                      >
                        {groupedTasks[stage.id]?.length ?? 0}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-none text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={(groupedTasks[stage.id]?.length ?? 0) > 0 || stages.length <= 1 || isSavingStage}
                        title={
                          (groupedTasks[stage.id]?.length ?? 0) > 0
                            ? "Cannot delete stage with tasks"
                            : stages.length <= 1
                              ? "At least one stage must remain"
                              : "Delete stage"
                        }
                        onClick={() => setDeleteStageTarget({ id: stage.id, name: stage.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(groupedTasks[stage.id]?.length ?? 0) === 0 ? (
                    <div className="border-t border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-slate-600">
                      No tasks
                    </div>
                  ) : (
                    <div className="bg-white">
                      {groupedTasks[stage.id].map((task, taskIndex) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`block w-full bg-white px-4 py-3 text-left transition hover:bg-slate-50 ${
                            taskIndex < groupedTasks[stage.id].length - 1 ? "border-b border-slate-300/90" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                              <p className="text-sm text-slate-600">{task.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <span className="shrink-0 text-sm font-medium text-slate-700">
                              {getTaskCompletionPercent(task)}%
                            </span>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-700">
                            <p>
                              Responsible: <span className="font-medium">{getResponsibleName(task)}</span>
                            </p>
                            <p>
                              Due Date:{" "}
                              <span className="font-medium">
                                {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                              </span>
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-900">
                              {getTaskStatus(task)}
                            </Badge>
                            <Badge className="rounded-full bg-sky-500 text-white hover:bg-sky-500">
                              {getTaskCompletionPercent(task)}%
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-700">Task</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Stage</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Responsible Person</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-slate-900 hover:underline"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {task.title}
                        </button>
                      </td>
                      <td className="px-4 py-3">{getStageName(task)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{getTaskStatus(task)}</Badge>
                      </td>
                      <td className="px-4 py-3">{getResponsibleName(task)}</td>
                      <td className="px-4 py-3">
                        {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Task Name</p>
                  <p className="font-semibold">{selectedTask.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline">{getTaskStatus(selectedTask)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stage</p>
                  <p className="font-medium">{getStageName(selectedTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Responsible Person</p>
                  <p className="font-medium">{getResponsibleName(selectedTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <p className="font-medium">{getTaskCompletionPercent(selectedTask)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {selectedTask.dueDate
                      ? format(new Date(selectedTask.dueDate), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 text-sm">{selectedTask.description || "-"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Task Update History</p>
                {selectedTask.updates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No updates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.updates
                      .slice()
                      .reverse()
                      .map((update) => (
                        <div key={update.id} className="rounded border p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span>{format(new Date(update.createdAt), "MMM d, yyyy h:mm a")}</span>
                            <Badge variant="outline">Update</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{update.comment || "No comment"}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stage</DialogTitle>
          </DialogHeader>
          <Input
            value={newStageName}
            onChange={(event) => setNewStageName(event.target.value)}
            placeholder="Enter stage name"
            disabled={isSavingStage}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddStageOpen(false)} disabled={isSavingStage}>
              Cancel
            </Button>
            <Button type="button" onClick={addStage} disabled={isSavingStage}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteStageTarget} onOpenChange={() => setDeleteStageTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                This action will delete stage &quot;{deleteStageTarget?.name || ""}&quot; and move its tasks.
              </span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingStage}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteStageTarget) {
                  deleteStage(deleteStageTarget.id);
                }
                setDeleteStageTarget(null);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSavingStage}
            >
              {isSavingStage ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
