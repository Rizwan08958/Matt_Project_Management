"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CrmQuotationNavProps {
  leadId: string;
  backHref?: string;
}

export function CrmQuotationNav({ leadId, backHref }: CrmQuotationNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/crm/${leadId}/quotations`;
  const newHref = `${base}/new`;
  const resolvedBackHref = backHref || "/crm/quotations";

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" className="rounded-lg">
        <Link href={newHref} className={pathname === newHref ? "font-semibold" : undefined}>
          New Quotation
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
            return;
          }
          router.push(resolvedBackHref);
        }}
      >
        Back
      </Button>
    </div>
  );
}
