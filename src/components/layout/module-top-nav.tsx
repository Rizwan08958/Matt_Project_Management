import Link from "next/link";
import { cn } from "@/lib/utils";

interface ModuleTopNavItem {
  label: string;
  active?: boolean;
  href?: string;
}

interface ModuleTopNavProps {
  title: string;
  titleHref?: string;
  items?: ModuleTopNavItem[];
  className?: string;
}

export function ModuleTopNav({ title, titleHref, items = [], className }: ModuleTopNavProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3", className)}>
      <div className="flex flex-wrap items-center gap-6 text-sm md:text-base">
        {titleHref ? (
          <Link href={titleHref} className="text-lg font-semibold tracking-tight text-foreground hover:text-foreground/80">
            {title}
          </Link>
        ) : (
          <span className="text-lg font-semibold tracking-tight text-foreground">{title}</span>
        )}
        {items.map((item) => (
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "font-medium text-muted-foreground transition-colors hover:text-foreground",
                item.active && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className={cn(
                "font-medium text-muted-foreground",
                item.active && "text-foreground"
              )}
            >
              {item.label}
            </span>
          )
        ))}
      </div>
    </div>
  );
}
