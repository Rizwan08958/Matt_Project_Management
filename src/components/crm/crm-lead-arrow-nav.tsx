"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CrmLeadArrowNavProps {
  currentCount: number;
  totalCount: number;
  prevLeadId: string | null;
  nextLeadId: string | null;
  basePath?: string;
  queryString?: string;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function CrmLeadArrowNav({
  currentCount,
  totalCount,
  prevLeadId,
  nextLeadId,
  basePath = "/crm",
  queryString = "",
}: CrmLeadArrowNavProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "ArrowLeft" && prevLeadId) {
        event.preventDefault();
        router.push(`${basePath}/${prevLeadId}${queryString}`);
      }

      if (event.key === "ArrowRight" && nextLeadId) {
        event.preventDefault();
        router.push(`${basePath}/${nextLeadId}${queryString}`);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [basePath, nextLeadId, prevLeadId, queryString, router]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-700">{currentCount} / {totalCount}</span>
      <div className="flex overflow-hidden rounded-md border">
        {prevLeadId ? (
          <Link href={`${basePath}/${prevLeadId}${queryString}`} className="border-r bg-slate-50 p-2 text-slate-700 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" disabled className="border-r bg-slate-50 p-2 text-slate-300">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {nextLeadId ? (
          <Link href={`${basePath}/${nextLeadId}${queryString}`} className="bg-slate-50 p-2 text-slate-700 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" disabled className="bg-slate-50 p-2 text-slate-300">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
