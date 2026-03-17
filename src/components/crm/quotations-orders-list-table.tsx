"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteCrmQuotations } from "@/actions/quotation.actions";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";

interface QuotationsOrdersRow {
  id: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  clientName: string;
  salespersonName: string | null;
  status: string;
  totalLabel: string;
  createdLabel: string;
}

interface QuotationsOrdersListTableProps {
  rows: QuotationsOrdersRow[];
  emptyLabel: string;
}

export function QuotationsOrdersListTable({ rows, emptyLabel }: QuotationsOrdersListTableProps) {
  const router = useRouter();

  const runDelete = useCallback(async (selectedRows: QuotationsOrdersRow[]) => {
    const ids = selectedRows.map((row) => row.id);
    if (ids.length === 0) {
      toast.error("Select at least one quotation");
      return;
    }

    const result = await bulkDeleteCrmQuotations(ids);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if ((result.deletedCount || 0) > 0) {
      toast.success(`${result.deletedCount} quotation(s) deleted`);
    }
    if ((result.blockedCount || 0) > 0) {
      const firstReason = Array.isArray(result.errors) && result.errors[0] ? `: ${result.errors[0]}` : "";
      toast.error(`${result.blockedCount} quotation(s) could not be deleted${firstReason}`);
    }
    router.refresh();
  }, [router]);

  return (
    <CrmSelectableListTable
      rows={rows}
      columns={[
        {
          key: "quotationNo",
          label: "Quotation No",
          cellClassName: "font-medium text-slate-900",
          render: (row) => (
            <Link href={`/crm/${row.crmLeadId}/quotations/${row.id}`} className="hover:underline">
              {row.quotationNo}
            </Link>
          ),
        },
        { key: "title", label: "Title", render: (row) => row.title },
        { key: "client", label: "Client", render: (row) => row.clientName },
        { key: "salesperson", label: "Salesperson", render: (row) => row.salespersonName || "-" },
        { key: "status", label: "Status", render: (row) => row.status },
        { key: "total", label: "Total", render: (row) => row.totalLabel },
        { key: "created", label: "Created", render: (row) => row.createdLabel },
      ]}
      emptyText={`No records for ${emptyLabel}`}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.quotationNo}
      selectionAriaLabel="Select all quotations"
      getRowHref={(row) => `/crm/${row.crmLeadId}/quotations/${row.id}`}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.quotationNo}`}
            items={[
              { label: "Open", href: `/crm/${row.crmLeadId}/quotations/${row.id}` },
              { label: "Delete", destructive: true, onClick: () => void runDelete([row]) },
            ]}
          />
        </div>
      )}
      onDeleteSelected={runDelete}
      deleteDialogTitle={(count) => (count === 1 ? "Delete quotation?" : `Delete ${count} quotations?`)}
      deleteDialogDescription="This action will remove the selected quotation details. Please confirm to continue with deletion."
      headerDeleteEventName="crm:list-delete-selected"
    />
  );
}
