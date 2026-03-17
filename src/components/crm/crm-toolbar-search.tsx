"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchChip {
  key: string;
  label: string;
  href: string;
  icon?: "group" | "filter";
}

interface SearchSuggestion {
  id: string;
  label: string;
  description?: string;
  href: string;
}

interface CrmToolbarSearchProps {
  query: string;
  placeholder?: string;
  hiddenFields: Record<string, string>;
  chips?: SearchChip[];
  suggestions?: SearchSuggestion[];
}

export function CrmToolbarSearch({
  query,
  placeholder = "Search...",
  hiddenFields,
  chips = [],
  suggestions = [],
}: CrmToolbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  const [isFocused, setIsFocused] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (value === query) return;
      const params = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([key, fieldValue]) => {
        if (fieldValue) params.set(key, fieldValue);
      });
      if (value.trim()) {
        params.set("q", value.trim());
      }
      const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(next, { scroll: false });
    }, 250);

    return () => clearTimeout(handle);
  }, [hiddenFields, pathname, query, router, value]);

  const filteredSuggestions = useMemo(() => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return suggestions.slice(0, 6);
    return suggestions
      .filter((item) => {
        const haystack = `${item.label} ${item.description || ""}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [suggestions, value]);

  return (
    <div className="relative flex h-full flex-1 items-center">
      <label className="flex h-full w-[min(100vw-12rem,420px)] min-w-0 items-center gap-2 px-3 sm:w-[420px]">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        {chips.length > 0 ? (
          <div className="flex min-w-0 max-w-[calc(100%-140px)] shrink items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => (
              <Link
                key={chip.key}
                href={chip.href}
                className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                title="Clear this filter"
              >
                {chip.label ? <span>{chip.label}</span> : null}
                <span aria-hidden>x</span>
              </Link>
            ))}
          </div>
        ) : null}
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
            setIsFocused(true);
          }}
          onBlur={() => {
            closeTimer.current = setTimeout(() => setIsFocused(false), 120);
          }}
          placeholder={placeholder}
          className="h-full min-w-[100px] flex-1 border-none text-sm outline-none sm:min-w-[120px] sm:flex-none sm:w-[120px] sm:shrink-0"
        />
      </label>

      {isFocused && filteredSuggestions.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Matching Results
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredSuggestions.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                {item.description ? (
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
