"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCrmProject, generateCrmProjectCode } from "@/actions/crm-projects.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CrmNewProjectFormProps {
  nextHref?: string;
}

export function CrmNewProjectForm({ nextHref = "/crm/quotations?tab=projects" }: CrmNewProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Software");
  const [projectCode, setProjectCode] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [status, setStatus] = useState("Active");
  const [createdDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const budgetValue = Number(budgetAmount || 0);
  const gstValue = Number(gstPercent || 0);
  const gstAmount = useMemo(() => {
    if (!Number.isFinite(budgetValue) || !Number.isFinite(gstValue)) return 0;
    return budgetValue * (gstValue / 100);
  }, [budgetValue, gstValue]);
  const totalAmount = useMemo(() => {
    if (!Number.isFinite(budgetValue)) return 0;
    return budgetValue + gstAmount;
  }, [budgetValue, gstAmount]);
  const currency = useMemo(
    () => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }),
    [],
  );

  useEffect(() => {
    let mounted = true;
    generateCrmProjectCode()
      .then((code) => {
        if (mounted) setProjectCode(code);
      })
      .catch(() => {
        if (mounted) setProjectCode("");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = () => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("category", category);
    formData.set("projectCode", projectCode);
    formData.set("durationDays", "30");
    formData.set("price", budgetAmount);
    formData.set("budgetAmount", budgetAmount);
    formData.set("gstPercent", gstPercent);
    formData.set("status", status);
    formData.set("createdDate", createdDate);
    formData.set("description", description);

    startTransition(async () => {
      const result = await createCrmProject(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project created");
      router.push(nextHref);
    });
  };

  return (
    <div className="space-y-4 rounded-md border bg-white p-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Project</h1>
        <p className="text-sm text-slate-600">Enter project details to use in quotations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Project Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" disabled={isPending} />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            disabled={isPending}
          >
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Internship">Internship</option>
            <option value="Support">Support</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Budget Amount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={budgetAmount}
            onChange={(event) => setBudgetAmount(event.target.value)}
            placeholder="Example: 15000"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Created Date</Label>
          <Input type="date" value={createdDate} readOnly disabled />
        </div>

        <div className="space-y-2">
          <Label>GST (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={gstPercent}
            onChange={(event) => setGstPercent(event.target.value)}
            placeholder="Example: 18"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            disabled={isPending}
          >
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Project ID</Label>
          <Input
            value={projectCode}
            readOnly
            placeholder="Generating..."
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label>GST Amount</Label>
          <Input value={currency.format(gstAmount)} readOnly disabled />
        </div>

        <div className="space-y-2">
          <Label>Total Project Amount</Label>
          <Input value={currency.format(totalAmount)} readOnly disabled />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Project Description (Optional)</Label>
        <Textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short details"
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={isPending}>
          Save Project
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(nextHref)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
