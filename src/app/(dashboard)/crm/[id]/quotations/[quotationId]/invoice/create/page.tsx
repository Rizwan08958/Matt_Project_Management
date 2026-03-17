import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmQuotation, getQuotationPayments } from "@/actions/quotation.actions";
import { CrmInvoiceForm } from "@/components/crm/crm-invoice-form";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Button } from "@/components/ui/button";

interface CrmCreateInvoicePageProps {
  params: Promise<{ id: string; quotationId: string }>;
}

export default async function CrmCreateInvoicePage({ params }: CrmCreateInvoicePageProps) {
  const { id, quotationId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const lead = await getCrmLead(id);
  const quotation = await getCrmQuotation(quotationId);
  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const paymentRecords = await getQuotationPayments(quotationId);
  const paidAmount = paymentRecords.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const quotationTotal = Number(quotation.totalAmount || 0);
  const balanceAmount = Math.max(quotationTotal - paidAmount, 0);
  const dueDate = quotation.validUntil ? new Date(quotation.validUntil).toISOString().split("T")[0] : "";
  const invoiceDate = new Date().toISOString().split("T")[0];
  const subtotal = Number(quotation.subtotalAmount || 0);
  const tax = Number(quotation.gstAmount || 0);
  const discount = 0;
  const grandTotal = quotationTotal;
  const status = paidAmount >= grandTotal && grandTotal > 0
    ? "Paid"
    : paidAmount > 0
      ? "Partial"
      : dueDate && new Date(dueDate) < new Date(invoiceDate)
        ? "Overdue"
        : "Unpaid";

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="to-invoice" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Create Invoice</h1>
          <p className="text-sm text-slate-600">{quotation.quotationNo}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/crm/${id}/quotations/${quotationId}/invoice`}>Back to Invoice</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="mb-4 grid gap-4 rounded-md border p-3 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Invoice Number:</span> INV/{new Date().getFullYear()}/{quotation.quotationNo.replace("Q-", "")}</p>
            <p><span className="text-slate-500">Linked Sales / Quotation:</span> {quotation.quotationNo}</p>
            <p><span className="text-slate-500">Customer Details:</span> {quotation.clientName} ({quotation.clientEmail})</p>
            <p><span className="text-slate-500">Billing Address:</span> {lead.notes || "-"}</p>
            <p><span className="text-slate-500">Invoice Date:</span> {invoiceDate}</p>
            <p><span className="text-slate-500">Due Date:</span> {dueDate || "-"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Product:</span> {quotation.serviceName || quotation.projectTitle}</p>
            <p><span className="text-slate-500">Subtotal:</span> {subtotal.toFixed(2)}</p>
            <p><span className="text-slate-500">Discount:</span> {discount.toFixed(2)}</p>
            <p><span className="text-slate-500">Tax:</span> {tax.toFixed(2)}</p>
            <p><span className="text-slate-500">Grand Total:</span> {grandTotal.toFixed(2)}</p>
            <p><span className="text-slate-500">Status:</span> {status}</p>
          </div>
        </div>

        <CrmInvoiceForm
          quotationId={quotationId}
          quoteTotal={quotationTotal}
          currentPaid={paidAmount}
          currentBalance={balanceAmount}
          defaultDueDate={dueDate}
        />
      </div>
    </div>
  );
}
