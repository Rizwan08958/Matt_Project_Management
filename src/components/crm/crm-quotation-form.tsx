"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCrmQuotation, generateQuotationNo } from "@/actions/quotation.actions";
import type { CrmLeadItem } from "@/actions/crm.actions";
import type { CrmProjectTypeItem } from "@/actions/crm-project-types.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CrmQuotationFormProps {
  lead: CrmLeadItem;
  salespersonName?: string | null;
  projectTypes: Array<Pick<CrmProjectTypeItem, "name" | "budget">>;
}

export function CrmQuotationForm({ lead, salespersonName, projectTypes }: CrmQuotationFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const opportunityTitle = lead.title || lead.serviceName || lead.clientName || "Opportunity";
  const title = `${opportunityTitle} - Quotation`;
  const [clientName, setClientName] = useState(lead.clientName || lead.title || "");
  const clientEmail = lead.email || "";
  const [quotationNo, setQuotationNo] = useState("");
  const validUntil =
    lead.expectedClosingDate ? new Date(lead.expectedClosingDate).toISOString().split("T")[0] : "";
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "APPROVED" | "REJECTED">("DRAFT");
  const [projectPickerLineId, setProjectPickerLineId] = useState<string | null>(null);
  const projectTitle = opportunityTitle;
  const [lineItems, setLineItems] = useState<
    Array<{
      id: string;
      name: string;
      unitCount: string;
      unitPrice: string;
      discount: string;
      amount: string;
      gst: string;
      tags: string;
    }>
  >([]);
  const serviceName = lead.serviceName || "";
  const unitName = lead.unitName || "";
  const unitCount = String(lead.unitCount ?? 1);
  const gstPercent = String(lead.gstPercent ?? 0);
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + amount;
    }, 0);
    const taxTotal = lineItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      const gst = Number(item.gst || 0);
      return sum + amount * (gst / 100);
    }, 0);
    return {
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
    };
  }, [lineItems]);
  const [terms, setTerms] = useState("50% advance before start. Balance due on delivery.");
  const [notes, setNotes] = useState(lead.notes || "");
  const formatBudget = (value: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

  useEffect(() => {
    let isMounted = true;
    generateQuotationNo()
      .then((value) => {
        if (isMounted) setQuotationNo(value);
      })
      .catch(() => {
        if (isMounted) setQuotationNo("");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLineChange = (id: string, field: keyof (typeof lineItems)[number], value: string) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        const qty = Number(next.unitCount || 0);
        const price = Number(next.unitPrice || 0);
        const discount = Number(next.discount || 0);
        const amount = Math.max(qty * price - discount, 0);
        return { ...next, amount: amount.toFixed(2) };
      }),
    );
  };

  const handleProjectNameChange = (id: string, value: string) => {
    if (value.trim().toLowerCase() === "see more") {
      setProjectPickerLineId(id);
      return;
    }
    const matched = projectTypes.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, name: value, unitPrice: matched ? String(matched.budget) : item.unitPrice };
        const qty = Number(next.unitCount || 0);
        const price = Number(next.unitPrice || 0);
        const discount = Number(next.discount || 0);
        const amount = Math.max(qty * price - discount, 0);
        return { ...next, amount: amount.toFixed(2) };
      }),
    );
  };

  const addLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: crypto.randomUUID(), name: "", unitCount: "1", unitPrice: "0", discount: "0", amount: "0", gst: "0", tags: "" },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSubmit = (sendNow: boolean) => {
    const formData = new FormData();
    const effectiveSendNow = sendNow || status === "SENT";
    formData.set("title", title);
    formData.set("clientName", clientName);
    formData.set("clientEmail", clientEmail);
    formData.set("projectTitle", projectTitle);
    formData.set("status", status);
    if (quotationNo) formData.set("quotationNo", quotationNo);
    formData.set(
      "items",
      JSON.stringify(
        lineItems.map((item) => ({
          id: item.id,
          name: item.name,
          unitCount: item.unitCount,
          amount: item.amount,
          gst: item.gst,
          tags: item.tags,
        })),
      ),
    );
    const primaryLine = lineItems.find((item) => item.name.trim());
    const derivedServiceName = primaryLine?.name || serviceName || projectTitle;
    formData.set("serviceName", derivedServiceName);
    formData.set("unitName", unitName || "Project");
    formData.set("unitCount", unitCount || "1");
    formData.set("unitPrice", totals.total.toFixed(2));
    formData.set("gstPercent", gstPercent || "0");
    if (validUntil) formData.set("validUntil", validUntil);
    if (terms) formData.set("terms", terms);
    if (notes) {
      const noteWithMeta = status === "APPROVED" || status === "REJECTED"
        ? `[Requested Status: ${status}] ${notes}`
        : notes;
      formData.set("notes", noteWithMeta);
    }
    formData.set("sendNow", String(effectiveSendNow));

    startTransition(async () => {
      const result = await createCrmQuotation(lead.id, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not create quotation");
        return;
      }
      if (!result.data?.id) {
        toast.error("Quotation created but response was incomplete");
        return;
      }
      if (effectiveSendNow) {
        if (result.mailSent) {
          toast.success("Quotation created and sent");
        } else {
          toast.warning(result.mailMessage || "Quotation created but email was not sent");
        }
      } else {
        toast.success("Quotation created");
      }
      router.push(`/crm/${lead.id}/quotations/${result.data.id}`);
    });
  };

  return (
    <div className="space-y-6 rounded-md border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quotation</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="min-w-[220px]">
          <Label>Quotation ID</Label>
          <Input value={quotationNo || "Generating..."} readOnly disabled />
        </div>
      </div>

      <div className="rounded-md border bg-slate-50/60 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Client Details</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Client Name</Label>
            <Input value={clientName} onChange={(event) => setClientName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as "DRAFT" | "SENT" | "APPROVED" | "REJECTED")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              <span>Salesperson:</span>
              <span className="text-slate-900">{salespersonName || "Unassigned"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Project Details</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            Add Project
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <datalist id="crm-project-type-options">
            {projectTypes.map((projectType) => (
              <option key={projectType.name} value={projectType.name} />
            ))}
            <option value="See more" />
          </datalist>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Tax %</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    No project rows yet. Click Add Project.
                  </td>
                </tr>
              ) : (
                lineItems.map((item) => {
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">
                        <div>
                          <Input
                            value={item.name}
                            onChange={(event) => handleProjectNameChange(item.id, event.target.value)}
                            placeholder="Project name"
                            list="crm-project-type-options"
                            autoComplete="off"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          value={item.unitCount}
                          onChange={(event) => handleLineChange(item.id, "unitCount", event.target.value)}
                          className="text-right"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => handleLineChange(item.id, "unitPrice", event.target.value)}
                          className="text-right"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discount}
                          onChange={(event) => handleLineChange(item.id, "discount", event.target.value)}
                          className="text-right"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          className="text-right"
                          autoComplete="off"
                          readOnly
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.gst}
                          onChange={(event) => handleLineChange(item.id, "gst", event.target.value)}
                          className="text-right"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={item.tags}
                          onChange={(event) => handleLineChange(item.id, "tags", event.target.value)}
                          placeholder="e.g. Priority, VIP"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(item.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 rounded-md border bg-slate-50/60 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST</span>
              <span className="font-semibold">{totals.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Terms (manual)</Label>
        <Textarea rows={4} value={terms} onChange={(event) => setTerms(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Notes (manual)</Label>
        <Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex gap-3">
        <Button type="button" onClick={() => handleSubmit(false)} disabled={isPending}>
          Create Quotation
        </Button>
        <Button type="button" variant="secondary" onClick={() => handleSubmit(true)} disabled={isPending}>
          Create & Send
        </Button>
      </div>

      <Dialog open={projectPickerLineId !== null} onOpenChange={(open) => !open && setProjectPickerLineId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border">
            {projectTypes.map((projectType) => (
              <button
                key={projectType.name}
                type="button"
                className="flex w-full items-center justify-between border-b bg-white px-3 py-2 text-left transition last:border-b-0 hover:bg-slate-50"
                onClick={() => {
                  if (projectPickerLineId) {
                    handleProjectNameChange(projectPickerLineId, projectType.name);
                  }
                  setProjectPickerLineId(null);
                }}
              >
                <p className="text-sm font-semibold text-slate-900">{projectType.name}</p>
                <p className="text-sm text-slate-700">{formatBudget(Number(projectType.budget || 0))}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
