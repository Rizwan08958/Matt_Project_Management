"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTimeEntry, updateTimeEntry } from "@/actions/time-entry.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TimeEntryFormProps {
  entry?: {
    id: string;
    projectId: string;
    date: Date;
    hours: number;
    description: string | null;
    isBillable: boolean;
  };
  projects: { id: string; name: string; code: string }[];
}

export function TimeEntryForm({ entry, projects }: TimeEntryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isBillable, setIsBillable] = useState(entry?.isBillable ?? true);
  const router = useRouter();
  const isEditing = !!entry;

  async function handleSubmit(formData: FormData) {
    formData.append("isBillable", isBillable.toString());

    startTransition(async () => {
      const result = isEditing
        ? await updateTimeEntry(entry.id, formData)
        : await createTimeEntry(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success(isEditing ? "Time entry updated" : "Time entry logged");
        router.push("/work-tracking");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Time Entry" : "Log Time"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project *</Label>
              <Select name="projectId" defaultValue={entry?.projectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={entry?.date ? new Date(entry.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Hours *</Label>
              <Input
                id="hours"
                name="hours"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                defaultValue={entry?.hours || ""}
                placeholder="e.g., 2.5"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBillable"
                  checked={isBillable}
                  onCheckedChange={(checked) => setIsBillable(checked as boolean)}
                  disabled={isPending}
                />
                <Label htmlFor="isBillable" className="cursor-pointer">
                  Billable hours
                </Label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={entry?.description || ""}
                placeholder="What did you work on?"
                disabled={isPending}
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Entry" : "Log Time"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
