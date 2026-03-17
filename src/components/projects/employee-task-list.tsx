"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  addProjectTaskDailyUpdate,
  getProjectTasks,
  moveOwnProjectTaskStage,
} from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ProjectTask, getTaskCompletionPercent, getTaskStatus, normalizeTask } from "@/lib/project-task-utils";

const STAGE_THEMES = [
  "border-cyan-200 bg-cyan-50/60",
  "border-blue-200 bg-blue-50/60",
  "border-amber-200 bg-amber-50/60",
  "border-emerald-200 bg-emerald-50/60",
  "border-rose-200 bg-rose-50/60",
] as const;

interface EmployeeTaskListProps {
  projectId: string;
  currentUserId: string;
  assignees: { id: string; name: string; role: string }[];
}

export function EmployeeTaskList({ projectId, currentUserId, assignees }: EmployeeTaskListProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; sortOrder: number }[]>([]);
  const [dailyCommentByTask, setDailyCommentByTask] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const loadState = useCallback(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        result.data
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
    });
  }, [projectId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const myTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.employeeAssigneeId === currentUserId ||
          (!task.employeeAssigneeId && task.assigneeId === currentUserId)
      ),
    [tasks, currentUserId]
  );
  const selectedTask = useMemo(
    () => myTasks.find((task) => task.id === selectedTaskId) ?? null,
    [myTasks, selectedTaskId]
  );
  const assigneeMap = useMemo(
    () => new Map(assignees.map((person) => [person.id, person])),
    [assignees]
  );

  const getStageLabel = useCallback(
    (task: ProjectTask) => stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do",
    [stages]
  );

  const getAssignedTlName = useCallback(
    (task: ProjectTask) => {
      if (task.assignedTlId) {
        return assigneeMap.get(task.assignedTlId)?.name ?? "Not available";
      }

      const originalAssignee = assigneeMap.get(task.assigneeId);
      if (originalAssignee?.role === "TEAMLEADER") {
        return originalAssignee.name;
      }

      return "Not available";
    },
    [assigneeMap]
  );
  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of myTasks) {
      const fallbackStageId = stages[0]?.id;
      const stageId = task.stageId && initial[task.stageId] ? task.stageId : fallbackStageId;
      if (!stageId) continue;
      initial[stageId].push(task);
    }

    return initial;
  }, [myTasks, stages]);

  const submitDailyUpdate = (taskId: string) => {
    const comment = (dailyCommentByTask[taskId] || "").trim();

    if (!comment) {
      toast.error("Daily comment is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);
    formData.append("comment", comment);

    addProjectTaskDailyUpdate(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
      setDailyCommentByTask((current) => ({ ...current, [taskId]: "" }));
      toast.success("Daily task update saved");
    });
  };

  const moveTaskToStage = (taskId: string, targetStageId: string) => {
    if (!targetStageId) {
      toast.error("Select a stage");
      return;
    }

    const task = myTasks.find((item) => item.id === taskId);
    if (!task) {
      toast.error("Task not found");
      return;
    }
    if (task.stageId === targetStageId) {
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);
    formData.append("targetStageId", targetStageId);

    moveOwnProjectTaskStage(formData).then((result) => {
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
      toast.success("Task stage updated");
    });
  };

  const moveTaskStage = (taskId: string) => {
    moveTaskToStage(taskId, selectedStageId);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>My Tasks</CardTitle>
          <div className="inline-flex rounded-md border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {myTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned by team leader yet.</p>
        ) : viewMode === "kanban" ? (
          <div className="overflow-x-auto">
            <div className="flex min-w-[960px] gap-5">
              {stages.map((stage, stageIndex) => (
                <div
                  key={stage.id}
                  className={`w-full min-w-[320px] transition-colors ${
                    dragOverStageId === stage.id ? "opacity-90" : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverStageId(stage.id);
                  }}
                  onDragLeave={() => {
                    setDragOverStageId((current) => (current === stage.id ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const droppedTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
                    if (!droppedTaskId) return;
                    moveTaskToStage(droppedTaskId, stage.id);
                    setDraggingTaskId(null);
                    setDragOverStageId(null);
                  }}
                >
                  <div className={`border ${STAGE_THEMES[stageIndex % STAGE_THEMES.length]}`}>
                    <div className="flex items-center justify-between border-b border-slate-300/80 px-4 py-3">
                      <p className="text-2xl font-semibold tracking-tight text-slate-900">{stage.name}</p>
                      <Badge
                        variant="secondary"
                        className="h-7 min-w-7 rounded-full bg-slate-200 px-2 text-sm font-semibold text-slate-700"
                      >
                        {groupedTasks[stage.id]?.length ?? 0}
                      </Badge>
                    </div>

                    {(groupedTasks[stage.id]?.length ?? 0) === 0 ? (
                      <div className="border-t border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-slate-600">
                        No tasks
                      </div>
                    ) : (
                      <div className="bg-white">
                        {groupedTasks[stage.id].map((task, taskIndex) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", task.id);
                              event.dataTransfer.effectAllowed = "move";
                              setDraggingTaskId(task.id);
                            }}
                            onDragEnd={() => {
                              setDraggingTaskId(null);
                              setDragOverStageId(null);
                            }}
                            className={`cursor-grab bg-white px-4 py-3 transition hover:bg-slate-50 active:cursor-grabbing ${
                              taskIndex < groupedTasks[stage.id].length - 1 ? "border-b border-slate-300/90" : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="text-left text-sm font-semibold text-slate-900 hover:underline"
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setSelectedStageId(task.stageId ?? stages[0]?.id ?? "");
                              }}
                            >
                              {task.title}
                            </button>
                            <div className="mt-3 space-y-1 text-sm text-slate-700">
                              <p>
                                Assigned TL: <span className="font-medium">{getAssignedTlName(task)}</span>
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
                              <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                                {getTaskCompletionPercent(task)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium">Task Name</th>
                  <th className="px-4 py-3 font-medium">Assigned TL</th>
                  <th className="px-4 py-3 font-medium">Task Stage</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((task) => (
                  <tr key={task.id} className="border-t">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setSelectedStageId(task.stageId ?? stages[0]?.id ?? "");
                        }}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">{getAssignedTlName(task)}</td>
                    <td className="px-4 py-3">{getStageLabel(task)}</td>
                    <td className="px-4 py-3">
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
            setSelectedStageId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Task Details</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Task Name</p>
                      <p className="font-semibold">{selectedTask.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current Status</p>
                      <Badge variant="outline">{getTaskStatus(selectedTask)}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Task Stage</p>
                      <p className="font-medium">{getStageLabel(selectedTask)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned TL Name</p>
                      <p className="font-medium">{getAssignedTlName(selectedTask)}</p>
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
                    <p className="text-xs text-muted-foreground">Task Description</p>
                    <p className="mt-1 text-sm">{selectedTask.description || "-"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Work Update</p>
                    <div className="space-y-2">
                      <Label htmlFor={`comment-${selectedTask.id}`}>Comment</Label>
                      <Textarea
                        id={`comment-${selectedTask.id}`}
                        value={dailyCommentByTask[selectedTask.id] || ""}
                        onChange={(event) =>
                          setDailyCommentByTask((current) => ({
                            ...current,
                            [selectedTask.id]: event.target.value,
                          }))
                        }
                        placeholder="Write your daily update"
                        rows={3}
                      />
                    </div>
                    <Button type="button" onClick={() => submitDailyUpdate(selectedTask.id)}>
                      Save Update
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Progress Tracking</p>
                    <div className="flex items-center gap-2">
                      <Progress value={getTaskCompletionPercent(selectedTask)} className="h-2" />
                      <span className="text-sm font-medium">{getTaskCompletionPercent(selectedTask)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Progress is visible to you, assigned TL, project BA, and Admin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Change Task Stage</p>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={() => moveTaskStage(selectedTask.id)}>
                  Update Stage
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
