import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MoreHorizontal, Settings } from "lucide-react";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import {
  getCrmQuotation,
  getAllCrmQuotations,
  getQuotationInvoice,
  getQuotationItems,
  getQuotationPayments,
} from "@/actions/quotation.actions";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { CrmQuotationConfirmButton } from "@/components/crm/crm-quotation-confirm-button";
import { CrmQuotationDeleteButton } from "@/components/crm/crm-quotation-delete-button";
import { CrmQuotationExportButton } from "@/components/crm/crm-quotation-export-button";
import { CrmQuotationSendButton } from "@/components/crm/crm-quotation-send-button";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { QuotationRecordNavigator } from "@/components/crm/quotation-record-navigator";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CrmQuotationDetailPageProps {
  params: Promise<{ id: string; quotationId: string }>;
}

const formatAmount = (value: number | null) => (value === null ? "-" : value.toFixed(2));
function isDatabaseConnectionError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P2024")
  ) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Error) {
    return /can't reach database server/i.test(error.message);
  }
  return false;
}

export default async function CrmQuotationDetailPage({ params }: CrmQuotationDetailPageProps) {
  const { id, quotationId } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  let lead: Awaited<ReturnType<typeof getCrmLead>> | null = null;
  let quotation: Awaited<ReturnType<typeof getCrmQuotation>> | null = null;
  let items: Awaited<ReturnType<typeof getQuotationItems>> = [];
  let invoice: Awaited<ReturnType<typeof getQuotationInvoice>> | null = null;
  let payments: Awaited<ReturnType<typeof getQuotationPayments>> = [];
  let allQuotations: Awaited<ReturnType<typeof getAllCrmQuotations>> = [];

  try {
    const [leadResult, quotationResult] = await Promise.all([
      getCrmLead(id),
      getCrmQuotation(quotationId),
    ]);
    if (!leadResult || !quotationResult || quotationResult.crmLeadId !== id) {
      notFound();
    }
    lead = leadResult;
    quotation = quotationResult;
    [items, invoice, payments, allQuotations] = await Promise.all([
      getQuotationItems(quotationId),
      getQuotationInvoice(quotationId),
      getQuotationPayments(quotationId),
      getAllCrmQuotations(),
    ]);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <h1 className="text-base font-semibold">Database connection issue</h1>
          <p className="mt-1 text-sm">
            Could not connect to the database right now. Please check your `DATABASE_URL` and try again in a moment.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline">
              <Link href="/crm">Back to CRM</Link>
            </Button>
          </div>
        </div>
      );
    }
    throw error;
  }
  if (!lead || !quotation) {
    notFound();
  }

  const unitCount = Number(quotation.unitCount || 0);
  const unitPrice = Number(quotation.unitPrice || 0);
  const gstPercent = Number(quotation.gstPercent || 0);
  const subtotalAmount = Number(quotation.subtotalAmount || 0);
  const gstAmount = Number(quotation.gstAmount || 0);
  const totalAmount = Number(quotation.totalAmount || 0);
  const paidAmount = payments.reduce((sum, payment) => sum + (payment.paidAmount ?? 0), 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const currentQuotationIndex = Math.max(0, allQuotations.findIndex((item) => item.id === quotation.id));
  const previousQuotation = currentQuotationIndex > 0 ? allQuotations[currentQuotationIndex - 1] : null;
  const nextQuotation =
    currentQuotationIndex >= 0 && currentQuotationIndex < allQuotations.length - 1
      ? allQuotations[currentQuotationIndex + 1]
      : null;
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const formatAmount = (value: number | null | undefined) => currency.format(Number(value ?? 0));

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="orders" />
      <div className="rounded-md border bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <Link href={`/crm/${id}/quotations/new`}>New</Link>
            </Button>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-cyan-700">Quotations</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-900">{quotation.quotationNo}</p>
                <Settings className="h-4 w-4 text-slate-600" />
              </div>
            </div>
          </div>
          <QuotationRecordNavigator
            currentIndex={currentQuotationIndex}
            total={allQuotations.length}
            previousHref={previousQuotation ? `/crm/${previousQuotation.crmLeadId}/quotations/${previousQuotation.id}` : null}
            nextHref={nextQuotation ? `/crm/${nextQuotation.crmLeadId}/quotations/${nextQuotation.id}` : null}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Quotation {quotation.quotationNo}</h1>
          <p className="text-sm text-slate-600">{quotation.projectTitle}</p>
          <div className="mt-2">
            <CrmQuotationNav leadId={id} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quotation.status === "DRAFT" ? (
            <CrmQuotationConfirmButton quotationId={quotation.id} crmLeadId={id} />
          ) : (
            <Button asChild>
              <Link href={`/crm/${id}/quotations/${quotation.id}/invoice`}>{invoice ? "View Invoice" : "Create Invoice"}</Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open quotation actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-1 [&_button]:h-auto [&_button]:w-full [&_button]:justify-start [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1.5 [&_button]:font-normal [&_button]:text-foreground [&_button]:shadow-none [&_button:hover]:bg-transparent [&_button:hover]:text-foreground [&_button:active]:bg-transparent [&_button:focus-visible]:ring-0">
                <CrmQuotationExportButton
                  quotationNo={quotation.quotationNo}
                  title={quotation.title}
                  status={quotation.status}
                  sentAt={quotation.sentAt ? new Date(quotation.sentAt).toISOString() : null}
                  createdAt={new Date(quotation.createdAt).toISOString()}
                  validUntil={quotation.validUntil ? new Date(quotation.validUntil).toISOString() : null}
                  clientName={quotation.clientName}
                  clientEmail={quotation.clientEmail}
                  clientPhone={lead.phone}
                  projectTitle={quotation.projectTitle}
                  serviceName={quotation.serviceName}
                  unitName={quotation.unitName}
                  unitCount={unitCount}
                  unitPrice={unitPrice}
                  gstPercent={gstPercent}
                  subtotalAmount={subtotalAmount}
                  gstAmount={gstAmount}
                  totalAmount={totalAmount}
                  terms={quotation.terms}
                  notes={quotation.notes}
                  items={items.map((item) => ({
                    name: item.name,
                    unitCount: item.unitCount,
                    amount: item.amount,
                    gstPercent: item.gstPercent,
                    tags: item.tags,
                  }))}
                />
                <CrmQuotationSendButton quotationId={quotation.id} isResend={quotation.status === "SENT"} />
                <CrmQuotationDeleteButton quotationId={quotation.id} crmLeadId={id} />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Client</p>
            <p className="font-medium">{quotation.clientName}</p>
            <p className="text-sm text-slate-600">{quotation.clientEmail}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="font-medium">{quotation.status}</p>
            <p className="text-sm text-slate-600">
              {quotation.sentAt ? `Sent on ${new Date(quotation.sentAt).toLocaleString()}` : "Not sent yet"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Service</p>
            <p className="font-medium">{quotation.serviceName || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Validity</p>
            <p className="font-medium">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "-"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Subtotal</p>
            <p className="text-lg font-semibold">{formatAmount(quotation.subtotalAmount)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">GST</p>
            <p className="text-lg font-semibold">{formatAmount(quotation.gstAmount)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-semibold">{formatAmount(quotation.totalAmount)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Terms</p>
            <p className="whitespace-pre-wrap text-sm">{quotation.terms || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Notes</p>
            <p className="whitespace-pre-wrap text-sm">{quotation.notes || "-"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Down Payment</h2>
          <Button asChild variant={invoice ? "outline" : "default"} size="sm">
            <Link href={`/crm/${id}/quotations/${quotation.id}/invoice`}>{invoice ? "Open Invoice" : "Create Invoice"}</Link>
          </Button>
        </div>
        {invoice ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Invoice Status</p>
              <p className="font-semibold text-slate-900">Created</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Payment Type</p>
              <p className="font-semibold text-slate-900">{invoice.paymentType}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Paid Amount</p>
              <p className="font-semibold text-slate-900">{currency.format(paidAmount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Balance</p>
              <p className="font-semibold text-slate-900">{currency.format(balanceAmount)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-slate-600">
            No invoice created for this quotation yet.
          </div>
        )}
      </div>
    </div>
  );
}
