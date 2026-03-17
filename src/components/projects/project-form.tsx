"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Priority, ProjectType, ProjectStatus } from "@prisma/client";

interface ProjectFormProps {
  project?: {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    clientId?: string | null;
    serviceName?: string | null;
    unitName?: string | null;
    unitCount?: number | null;
    unitPrice?: number | null;
    costPerUnit?: number | null;
    subtotalAmount?: number | null;
    gstPercent?: number;
    gstAmount?: number | null;
    finalAmount?: number | null;
    profitAmount?: number | null;
    invoicingPolicy?: string | null;
    tags?: string | null;
    expectedClosingDate?: Date | null;
    type?: ProjectType;
    status?: ProjectStatus;
    priority?: Priority;
    estimatedHours?: number | null;
    startDate?: Date | null;
    deadline?: Date | null;
    managerId?: string | null;
  };
  managers: { id: string; name: string }[];
  clients: {
    id: string;
    name: string;
    email: string;
    serviceName: string | null;
    tags: string | null;
    phone: string | null;
    country: string | null;
  }[];
  compactCreate?: boolean;
}

const stageRows = [
  { stage: "PLANNING", description: "Requirements gathering and proposal finalization" },
  { stage: "IN_PROGRESS", description: "Execution of project tasks and milestones" },
  { stage: "ON_HOLD", description: "Temporarily paused due to dependency or decision" },
  { stage: "COMPLETED", description: "Project delivered and closed successfully" },
];

export function ProjectForm({ project, managers, clients, compactCreate = false }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!project;
  const isCompactCreate = !isEditing && compactCreate;

  const [clientId, setClientId] = useState(project?.clientId || "none");
  const [projectType, setProjectType] = useState<ProjectType>(project?.type || "INDIVIDUAL");
  const [projectPriority, setProjectPriority] = useState<Priority>(project?.priority || "MEDIUM");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(project?.status || "PLANNING");
  const [managerId, setManagerId] = useState(project?.managerId || (isCompactCreate ? "" : "none"));
  const [projectTitle, setProjectTitle] = useState(project?.name || "");
  const [invoicingPolicy, setInvoicingPolicy] = useState(project?.invoicingPolicy || "fixed_price");
  const [serviceName, setServiceName] = useState(project?.serviceName || "");
  const [tags, setTags] = useState(project?.tags || "");
  const [unitName, setUnitName] = useState(project?.unitName || "");
  const [unitCount, setUnitCount] = useState(project?.unitCount?.toString() || "");
  const [unitPrice, setUnitPrice] = useState(project?.unitPrice?.toString() || "");
  const [costPerUnit, setCostPerUnit] = useState(project?.costPerUnit?.toString() || "");
  const [gstPercent, setGstPercent] = useState((project?.gstPercent ?? 18).toString());

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === clientId),
    [clients, clientId]
  );

  const unitCountNum = Number(unitCount || 0);
  const unitPriceNum = Number(unitPrice || 0);
  const costPerUnitNum = Number(costPerUnit || 0);
  const gstPercentNum = Number(gstPercent || 0);

  const subtotal = unitCountNum * unitPriceNum;
  const gstAmount = subtotal * (gstPercentNum / 100);
  const finalAmount = subtotal + gstAmount;
  const totalCost = unitCountNum * costPerUnitNum;
  const profit = subtotal - totalCost;

  const handleClientChange = (value: string) => {
    setClientId(value);
    const client = clients.find((item) => item.id === value);
    if (!client) return;

    if (!serviceName && client.serviceName) setServiceName(client.serviceName);
    if (!tags && client.tags) setTags(client.tags);
  };

  async function handleSubmit(formData: FormData) {
    if (!isEditing && !managerId) {
      toast.error("Please assign a BA before creating the project");
      return;
    }

    const resolvedProjectName = projectTitle.trim()
      || [selectedClient?.name, serviceName].filter(Boolean).join(" - ")
      || project?.name
      || "Project";

    formData.set("name", resolvedProjectName);
    formData.set("type", projectType);
    formData.set("priority", projectPriority);
    formData.set("managerId", managerId);

    if (!isCompactCreate) {
      formData.set("serviceName", serviceName);
      formData.set("unitName", unitName);
      formData.set("unitCount", unitCount);
      formData.set("unitPrice", unitPrice);
      formData.set("costPerUnit", costPerUnit);
      formData.set("gstPercent", gstPercent);
      formData.set("subtotalAmount", subtotal.toFixed(2));
      formData.set("gstAmount", gstAmount.toFixed(2));
      formData.set("finalAmount", finalAmount.toFixed(2));
      formData.set("profitAmount", profit.toFixed(2));
      formData.set("tags", tags);
      formData.set("clientId", clientId);
      formData.set("invoicingPolicy", invoicingPolicy);
    }

    if (isEditing) {
      formData.set("status", projectStatus);
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateProject(project.id, formData)
        : await createProject(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success(isEditing ? "Project updated successfully" : "Project created successfully");
        router.push("/projects");
      }
    });
  }

  return (
    <div className="space-y-6">
      {!isCompactCreate && (
        <Card>
          <CardHeader>
            <CardTitle>3. Project Management Module</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="mb-3 text-lg font-semibold">3.1 Project Stages</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map((row) => (
                    <tr key={row.stage} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{row.stage}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isCompactCreate ? "New Project" : "3.2 NEW Stage - Project Register Page"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Project Code</Label>
                <Input
                  id="code"
                  value={isEditing ? (project?.code ?? "") : "Auto-generated on create"}
                  readOnly
                  disabled
                />
              </div>

              {!isCompactCreate && (
                <div className="space-y-2">
                  <Label htmlFor="clientId">Linked Client</Label>
                  <Select name="clientId" value={clientId} onValueChange={handleClientChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClient && (
                    <p className="text-xs text-muted-foreground">
                      Auto-filled from client: {selectedClient.name}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="projectTitle">Project Title *</Label>
                <Input
                  id="projectTitle"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder="Project title"
                  required
                  disabled={isPending}
                />
              </div>

              {!isCompactCreate && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="serviceName">Service Name</Label>
                    <Input
                      id="serviceName"
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      placeholder="Service name"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitName">Unit</Label>
                    <Input
                      id="unitName"
                      value={unitName}
                      onChange={(event) => setUnitName(event.target.value)}
                      placeholder="e.g. Module, Seat"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitCount">Unit Count</Label>
                    <Input
                      id="unitCount"
                      type="number"
                      min="0"
                      value={unitCount}
                      onChange={(event) => setUnitCount(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Unit Price</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost Per Unit</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPerUnit}
                      onChange={(event) => setCostPerUnit(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstPercent">GST %</Label>
                    <Input
                      id="gstPercent"
                      type="number"
                      min="0"
                      step="0.01"
                      value={gstPercent}
                      onChange={(event) => setGstPercent(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subtotalAmount">Subtotal</Label>
                    <Input id="subtotalAmount" value={subtotal.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstAmount">GST Amount</Label>
                    <Input id="gstAmount" value={gstAmount.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalAmount">Final Amount</Label>
                    <Input id="finalAmount" value={finalAmount.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profitAmount">Profit</Label>
                    <Input id="profitAmount" value={profit.toFixed(2)} readOnly disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoicingPolicy">Invoicing Policy</Label>
                    <Select value={invoicingPolicy} onValueChange={setInvoicingPolicy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_price">Fixed Price</SelectItem>
                        <SelectItem value="milestone">Milestone</SelectItem>
                        <SelectItem value="time_material">Time & Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="e.g. Priority, B2B"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedClosingDate">Expected Closing Date</Label>
                    <Input
                      id="expectedClosingDate"
                      name="expectedClosingDate"
                      type="date"
                      defaultValue={project?.expectedClosingDate ? new Date(project.expectedClosingDate).toISOString().split("T")[0] : ""}
                      disabled={isPending}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="managerId">Project Manager (BA) *</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isCompactCreate ? "Select BA manager" : "Select manager"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!isCompactCreate && <SelectItem value="none">No manager</SelectItem>}
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Project Type *</Label>
                <Select value={projectType} onValueChange={(value) => setProjectType(value as ProjectType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={projectPriority} onValueChange={(value) => setProjectPriority(value as Priority)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={projectStatus} onValueChange={(value) => setProjectStatus(value as ProjectStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLANNING">Planning</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="ON_HOLD">On Hold</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  name="estimatedHours"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={project?.estimatedHours || ""}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={project?.startDate ? new Date(project.startDate).toISOString().split("T")[0] : ""}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="date"
                  defaultValue={project?.deadline ? new Date(project.deadline).toISOString().split("T")[0] : ""}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={project?.description || ""}
                  disabled={isPending}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Project" : "Create Project"}
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
    </div>
  );
}
