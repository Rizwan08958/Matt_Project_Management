"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteCrmQuotations } from "@/actions/quotation.actions";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";

interface SalesSummaryRow {
  key: string;
  name: string;
  count: number;
  totalLabel: string;
  lastDateLabel: string;
  quotationIds: string[];
  quotationsHref: string;
}

interface SalesSummaryListTableProps {
  rows: SalesSummaryRow[];
  firstColumnLabel: string;
  emptyText: string;
}

export function SalesSummaryListTable({ rows, firstColumnLabel, emptyText }: SalesSummaryListTableProps) {
  const router = useRouter();

  const runDelete = useCallback(async (selectedRows: SalesSummaryRow[]) => {
    const quotationIds = Array.from(new Set(selectedRows.flatMap((row) => row.quotationIds)));
    if (quotationIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }

    const result = await bulkDeleteCrmQuotations(quotationIds);
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
        { key: "name", label: firstColumnLabel, cellClassName: "font-medium text-slate-900", render: (row) => row.name },
        { key: "count", label: "Quotations", render: (row) => row.count },
        { key: "total", label: "Total Value", render: (row) => row.totalLabel },
        { key: "lastDate", label: "Last Activity", render: (row) => row.lastDateLabel },
      ]}
      emptyText={emptyText}
      getRowId={(row) => row.key}
      getRowLabel={(row) => row.name}
      selectionAriaLabel={`Select all ${firstColumnLabel.toLowerCase()}`}
      getRowHref={(row) => row.quotationsHref}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.name}`}
            items={[
              {
                label: "View Quotations",
                href: row.quotationsHref,
              },
              {
                label: "Delete",
                destructive: true,
                disabled: row.quotationIds.length === 0,
                onClick: () => void runDelete([row]),
              },
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
