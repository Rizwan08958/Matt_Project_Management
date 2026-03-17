"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CrmRowActionMenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface CrmRowActionMenuProps {
  label: string;
  items: CrmRowActionMenuItem[];
}

export function CrmRowActionMenu({ label, items }: CrmRowActionMenuProps) {
  const visibleItems = items.filter((item) => item.label.trim().length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {visibleItems.map((item) => (
          <DropdownMenuItem
            key={`${item.label}-${item.href || "action"}`}
            asChild={!!item.href}
            onClick={item.href ? undefined : item.onClick}
            disabled={item.disabled}
            className={item.destructive ? "text-red-600 focus:text-red-700" : undefined}
          >
            {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
