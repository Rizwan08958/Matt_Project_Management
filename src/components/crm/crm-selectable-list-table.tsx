"use client";

import { ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CrmSelectableListColumn<T> {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface CrmSelectableListTableProps<T> {
  rows: T[];
  columns: CrmSelectableListColumn<T>[];
  emptyText: string;
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  selectionAriaLabel: string;
  getRowHref?: (row: T) => string | null;
  renderActions?: (row: T) => ReactNode;
  onDeleteSelected?: (rows: T[]) => Promise<void>;
  deleteDialogTitle: (count: number) => string;
  deleteDialogDescription: string;
  headerDeleteEventName?: string;
  tableMinWidthClassName?: string;
}

export function CrmSelectableListTable<T>({
  rows,
  columns,
  emptyText,
  getRowId,
  getRowLabel,
  selectionAriaLabel,
  getRowHref,
  renderActions,
  onDeleteSelected,
  deleteDialogTitle,
  deleteDialogDescription,
  headerDeleteEventName,
  tableMinWidthClassName = "min-w-[720px]",
}: CrmSelectableListTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const rowIds = useMemo(() => rows.map((row) => getRowId(row)), [rows, getRowId]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
  const visibleSelectedIds = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => rowIdSet.has(id))),
    [selectedIds, rowIdSet],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => visibleSelectedIds.has(getRowId(row))),
    [rows, visibleSelectedIds, getRowId],
  );
  const selectedCount = selectedRows.length;
  const allSelected = rowIds.length > 0 && rowIds.every((id) => visibleSelectedIds.has(id));
  const someSelected = !allSelected && rowIds.some((id) => visibleSelectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    if (!headerDeleteEventName || !onDeleteSelected) return;

    const onHeaderDelete = () => {
      if (selectedRows.length === 0) return;
      setDeleteConfirmIds(selectedRows.map((row) => getRowId(row)));
    };

    window.addEventListener(headerDeleteEventName, onHeaderDelete);
    return () => window.removeEventListener(headerDeleteEventName, onHeaderDelete);
  }, [headerDeleteEventName, onDeleteSelected, selectedRows, getRowId]);

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(rowIds) : new Set());
  };

  const toggleRow = (rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const runDelete = async (ids: string[]) => {
    if (!onDeleteSelected) return;
    const rowsToDelete = rows.filter((row) => ids.includes(getRowId(row)));
    startTransition(async () => {
      await onDeleteSelected(rowsToDelete);
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="space-y-3 p-3">
      {selectedCount > 0 ? (
        <div className="flex h-auto w-full max-w-[420px] flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 sm:h-9 sm:flex-nowrap sm:py-0">
          <p className="text-sm font-medium text-red-700">{selectedCount} selected</p>
          <div className="flex items-center gap-1">
            {onDeleteSelected ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeleteConfirmIds(selectedRows.map((row) => getRowId(row)))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Delete selected rows"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isPending ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-700 hover:bg-red-100"
              aria-label="Clear selected rows"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${tableMinWidthClassName}`}>
          <thead>
            <tr className="border-b text-left">
              <th className="w-12 p-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  aria-label={selectionAriaLabel}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                />
              </th>
              {columns.map((column) => (
                <th key={column.key} className={`p-3 ${column.headerClassName || ""}`}>
                  {column.label}
                </th>
              ))}
              {renderActions ? <th className="w-14 p-3 text-right" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1 + (renderActions ? 1 : 0)} className="p-8 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row);
                const rowHref = getRowHref?.(row) || null;
                return (
                  <tr
                    key={rowId}
                    className={`border-b hover:bg-slate-50 ${rowHref ? "cursor-pointer" : ""}`}
                    onClick={rowHref ? () => router.push(rowHref) : undefined}
                  >
                    <td className="p-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={visibleSelectedIds.has(rowId)}
                        onChange={(event) => toggleRow(rowId, event.target.checked)}
                        aria-label={`Select ${getRowLabel(row)}`}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className={`p-3 ${column.cellClassName || ""}`}>
                        {column.render(row)}
                      </td>
                    ))}
                    {renderActions ? <td className="p-3 text-right" onClick={(event) => event.stopPropagation()}>{renderActions(row)}</td> : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onDeleteSelected ? (
        <AlertDialog open={!!deleteConfirmIds} onOpenChange={(open) => !open && setDeleteConfirmIds(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteDialogTitle(deleteConfirmIds?.length || 0)}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmIds) {
                    void runDelete(deleteConfirmIds);
                  }
                  setDeleteConfirmIds(null);
                }}
                className="bg-red-600 hover:bg-red-700"
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
