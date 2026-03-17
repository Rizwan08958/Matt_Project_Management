"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertQuotationInvoice } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CrmInvoiceFormProps {
  quotationId: string;
  quoteTotal: number;
  currentPaid: number;
  currentBalance: number;
  defaultDueDate?: string;
}

export function CrmInvoiceForm({
  quotationId,
  quoteTotal,
  currentPaid,
  currentBalance,
  defaultDueDate,
}: CrmInvoiceFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [paymentType, setPaymentType] = useState<"FIXED" | "PERCENTAGE" | "MONTHLY">("FIXED");
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [months, setMonths] = useState("1");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("BANK");
  const [transactionId, setTransactionId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due on receipt");
  const [bankDetails, setBankDetails] = useState("");
  const normalizedQuoteTotal = Number(quoteTotal || 0);
  const balanceBeforeSave = Number(currentBalance || 0);

  const calc = useMemo(() => {
    const fixedAmount = Number(amount || 0);
    const pct = Number(percentage || 0);
    const monthsCount = Number(months || 1);

    if (paymentType === "PERCENTAGE") {
      const calculatedAmount = (normalizedQuoteTotal * pct) / 100;
      return {
        payableAmount: calculatedAmount,
        balance: Math.max(balanceBeforeSave - calculatedAmount, 0),
      };
    }

    if (paymentType === "MONTHLY") {
      const scheduled = fixedAmount * monthsCount;
      return {
        payableAmount: scheduled,
        balance: Math.max(balanceBeforeSave - scheduled, 0),
      };
    }

    return {
      payableAmount: fixedAmount,
      balance: Math.max(balanceBeforeSave - fixedAmount, 0),
    };
  }, [amount, balanceBeforeSave, months, normalizedQuoteTotal, paymentType, percentage]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("paymentType", paymentType);
    if (amount) formData.set("amount", amount);
    if (percentage) formData.set("percentage", percentage);
    if (months) formData.set("months", months);
    const enrichedNotes = [
      notes.trim(),
      `Payment Date: ${paymentDate}`,
      `Payment Mode: ${paymentMode}`,
      transactionId ? `Transaction ID: ${transactionId}` : "",
      paymentTerms ? `Payment Terms: ${paymentTerms}` : "",
      bankDetails ? `Bank Details: ${bankDetails}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (enrichedNotes) formData.set("notes", enrichedNotes);

    startTransition(async () => {
      const result = await upsertQuotationInvoice(quotationId, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not save invoice");
        return;
      }

      toast.success("Invoice saved");
      setAmount("");
      setPercentage("");
      setMonths("1");
      setNotes("");
      setTransactionId("");
      router.refresh();
    });
  };

  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = defaultDueDate || "";

  return (
    <div className="space-y-4 rounded-md border bg-white p-4">
      <div className="rounded-md border p-3">
        <p className="mb-3 text-sm font-semibold text-slate-700">Create Invoice</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Invoice Date</Label>
            <Input value={invoiceDate} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input value={dueDate} readOnly placeholder="No due date" />
          </div>
          <div className="space-y-2">
            <Label>Payment Terms</Label>
            <Input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bank Details</Label>
            <Input
              placeholder="Bank / Account / IFSC"
              value={bankDetails}
              onChange={(event) => setBankDetails(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-3 text-sm font-semibold text-slate-700">Payment Entry</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Transaction ID</Label>
            <Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment Type</Label>
          <Select value={paymentType} onValueChange={(value) => setPaymentType(value as "FIXED" | "PERCENTAGE" | "MONTHLY")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED">Fixed Payment</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage Payment</SelectItem>
              <SelectItem value="MONTHLY">Monthly Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentType === "PERCENTAGE" ? (
          <div className="space-y-2">
            <Label>Percentage (%)</Label>
            <Input type="number" min="0" max="100" step="0.01" value={percentage} onChange={(event) => setPercentage(event.target.value)} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{paymentType === "MONTHLY" ? "Monthly Amount" : "Payment Received"}</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
        )}

        {paymentType === "MONTHLY" && (
          <div className="space-y-2">
            <Label>Months</Label>
            <Input type="number" min="1" max="120" value={months} onChange={(event) => setMonths(event.target.value)} />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Grand Total</p>
          <p className="text-lg font-semibold">{normalizedQuoteTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Already Paid</p>
          <p className="text-lg font-semibold">{currentPaid.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">{paymentType === "FIXED" ? "Payment to Add" : "Calculated Payment"}</p>
          <p className="text-lg font-semibold">{calc.payableAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Current Balance</p>
          <p className="text-lg font-semibold">{balanceBeforeSave.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Remaining Balance (Auto)</p>
          <p className="text-lg font-semibold">{calc.balance.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <Button type="button" onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Saving..." : "Add Payment"}
      </Button>
    </div>
  );
}
