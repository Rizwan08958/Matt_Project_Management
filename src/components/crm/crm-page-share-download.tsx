"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CrmPageShareDownloadProps {
  path: string;
  shareTitle: string;
  showDownload?: boolean;
}

function toAbsoluteUrl(path: string) {
  if (!path.startsWith("/")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function CrmPageShareDownload({ path, shareTitle, showDownload = true }: CrmPageShareDownloadProps) {
  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareUrl = toAbsoluteUrl(path);

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not share link");
    }
  };

  return (
    <>
      {showDownload ? (
        <Button onClick={handleDownload} variant="outline">
          Download PDF
        </Button>
      ) : null}
      <Button onClick={handleShare} variant="outline">
        Share Link
      </Button>
    </>
  );
}
