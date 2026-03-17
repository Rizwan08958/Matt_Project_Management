"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface OrdersToInvoiceSettingsProps {
  isToInvoiceTab: boolean;
  isDeletedView: boolean;
  activeHref: string;
  deletedHref: string;
}

export function OrdersToInvoiceSettings({
  isToInvoiceTab,
  isDeletedView,
  activeHref,
  deletedHref,
}: OrdersToInvoiceSettingsProps) {
  if (!isToInvoiceTab) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded p-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
            aria-label="List settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-700"
            onClick={() => window.dispatchEvent(new Event("crm:list-delete-selected"))}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded p-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
          aria-label="Invoice settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem asChild className={!isDeletedView ? "font-semibold" : ""}>
          <Link href={activeHref}>Active Invoices</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={isDeletedView ? "font-semibold" : ""}>
          <Link href={deletedHref}>Deleted Invoices</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
