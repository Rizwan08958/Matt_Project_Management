import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmQuotation, getQuotationInvoice, getQuotationPayments } from "@/actions/quotation.actions";
import { getActivityLogs } from "@/actions/activity-log.actions";
import { CrmInvoiceDeleteButton } from "@/components/crm/crm-invoice-delete-button";
import { CrmInvoiceToolbar } from "@/components/crm/crm-invoice-toolbar";
import { CrmPaymentRecords } from "@/components/crm/crm-payment-records";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CrmQuotationInvoicePageProps {
  params: Promise<{ id: string; quotationId: string }>;
}

export default async function CrmQuotationInvoicePage({ params }: CrmQuotationInvoicePageProps) {
  const { id, quotationId } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const lead = await getCrmLead(id);
  const quotation = await getCrmQuotation(quotationId);
  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const invoice = await getQuotationInvoice(quotationId);
  const paymentRecords = await getQuotationPayments(quotationId);
  const invoiceLogs = invoice
    ? await getActivityLogs({ entityType: "crm_invoice", entityId: invoice.id, limit: 20 })
    : [];
  const quotationLogs = await getActivityLogs({ entityType: "crm_quotation", entityId: quotationId, limit: 20 });
  const logs = [...invoiceLogs, ...quotationLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  const invoiceNumber = `INV/${new Date(quotation.createdAt).getFullYear()}/${quotation.quotationNo.replace("QT-", "")}`;
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const formatCurrency = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : currency.format(value);
  const unitLabel = quotation.unitName || quotation.serviceName || "Service Item";
  const invoiceDate = new Date(invoice?.updatedAt || quotation.updatedAt);
  const dueDate = quotation.validUntil ? new Date(quotation.validUntil) : null;
  const totalAmount = Number(quotation.totalAmount || 0);
  const unitCount = Number(quotation.unitCount || 0);
  const unitPrice = Number(quotation.unitPrice || 0);
  const gstPercent = Number(quotation.gstPercent || 0);
  const subtotalAmount = Number(quotation.subtotalAmount || 0);
  const paidAmount = paymentRecords.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const lastPaymentType = paymentRecords[0]?.paymentType ?? invoice?.paymentType ?? "-";
  const now = new Date();
  const hasDueDatePassed = dueDate ? new Date(dueDate).getTime() < now.getTime() : false;
  const invoiceStatus =
    paidAmount >= totalAmount && totalAmount > 0
      ? "Paid"
      : paidAmount > 0
        ? "Partial"
        : hasDueDatePassed
          ? "Overdue"
          : "Unpaid";

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="orders" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Customer Invoice</h1>
          <p className="text-sm text-slate-600">{invoiceNumber}</p>
          <div className="mt-2">
            <CrmQuotationNav leadId={id} backHref="/crm/quotations" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CrmInvoiceDeleteButton quotationId={quotationId} />
          <div className="rounded-md border bg-slate-50 px-3 py-1 text-sm font-medium">{invoiceStatus}</div>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <CrmInvoiceToolbar
          leadId={id}
          quotationId={quotationId}
          invoiceNumber={invoiceNumber}
          quotationNo={quotation.quotationNo}
          invoiceDate={invoiceDate.toISOString()}
          dueDate={dueDate ? dueDate.toISOString() : null}
          paymentType={String(lastPaymentType)}
          clientName={quotation.clientName}
          clientEmail={quotation.clientEmail}
          clientPhone={lead.phone || null}
          projectTitle={quotation.projectTitle}
          productName={quotation.serviceName || "Service"}
          unitLabel={unitLabel}
          quantity={unitCount}
          unitPrice={unitPrice}
          gstPercent={gstPercent}
          subtotalAmount={subtotalAmount}
          totalAmount={totalAmount}
          paidAmount={paidAmount}
          balanceAmount={balanceAmount}
        />
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Customer</p>
            <p className="font-semibold text-slate-900">{quotation.clientName}</p>
            <p className="text-sm text-slate-600">{quotation.clientEmail}</p>
            <p className="text-sm text-slate-600">{lead.phone || "-"}</p>
            <p className="text-sm text-slate-600">{quotation.projectTitle}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Invoice Date</span>
              <span>{invoiceDate.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Payment Reference</span>
              <span>{invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Due Date</span>
              <span>{dueDate ? dueDate.toLocaleDateString() : "-"}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Payment Type</span>
              <span>{lastPaymentType}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Payment Terms</span>
              <span>{quotation.terms || "Due on receipt"}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-slate-500">Bank Details</span>
              <span>-</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="lines">
          <TabsList variant="line">
            <TabsTrigger value="lines">Invoice Lines</TabsTrigger>
            <TabsTrigger value="other">Other Info</TabsTrigger>
          </TabsList>
          <TabsContent value="lines" className="mt-3">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b text-left">
                    <th className="p-3">Product</th>
                    <th className="p-3">Label</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Unit Price</th>
                    <th className="p-3">GST</th>
                    <th className="p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3">{quotation.serviceName || "Service"}</td>
                    <td className="p-3">{unitLabel}</td>
                    <td className="p-3">{quotation.unitCount ?? "-"}</td>
                    <td className="p-3">{formatCurrency(quotation.unitPrice)}</td>
                    <td className="p-3">{quotation.gstPercent === null ? "-" : `${quotation.gstPercent}%`}</td>
                    <td className="p-3">{formatCurrency(quotation.subtotalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto grid w-full max-w-[360px] gap-2 text-sm">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(quotation.subtotalAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium">{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-slate-500">Tax</span>
                <span className="font-medium">{formatCurrency(quotation.gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-slate-500">Grand Total</span>
                <span className="font-medium">{formatCurrency(quotation.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-slate-500">Paid Amount</span>
                <span className="font-medium">{currency.format(paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Amount Due</span>
                <span className="text-lg font-semibold">
                  {currency.format(balanceAmount)}
                </span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="other" className="mt-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Terms and Conditions</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {quotation.terms || "No terms specified"}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-md border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Payment Records</h2>
        <CrmPaymentRecords records={paymentRecords} />
      </div>

      <div className="rounded-md border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Activities</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No activity found</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {log.createdBy?.name || "User"} - {log.action}
                </p>
                <p className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
