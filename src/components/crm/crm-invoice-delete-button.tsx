"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteQuotationInvoice } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";

interface CrmInvoiceDeleteButtonProps {
  quotationId: string;
}

export function CrmInvoiceDeleteButton({ quotationId }: CrmInvoiceDeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteQuotationInvoice(quotationId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Invoice removed");
          router.refresh();
        })
      }
    >
      {isPending ? "Removing..." : "Remove Invoice"}
    </Button>
  );
}
