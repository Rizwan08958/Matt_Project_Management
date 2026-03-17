"use client";

import { Check, ChevronDown, Filter, LayoutGrid, List, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SearchFilterOption {
  value: string;
  label: string;
}

interface SavedSearchItem {
  id: string;
  label: string;
}

interface ActiveChip {
  id: string;
  label: string;
  kind: "filter" | "group";
}

interface SearchFilterToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  selectedFilters: string[];
  filterOptions: SearchFilterOption[];
  onToggleFilter: (value: string) => void;
  activeChips: ActiveChip[];
  onRemoveChip: (id: string, kind: ActiveChip["kind"]) => void;
  groupByValue: string;
  groupByOptions: SearchFilterOption[];
  onGroupByChange: (value: string) => void;
  onClearAll: () => void;
  onSaveSearch: () => void;
  savedSearches: SavedSearchItem[];
  onApplySavedSearch: (id: string) => void;
  viewMode?: "list" | "kanban";
  onViewModeChange?: (value: "list" | "kanban") => void;
}

export function SearchFilterToolbar({
  query,
  onQueryChange,
  placeholder = "Search...",
  isMenuOpen,
  onMenuOpenChange,
  selectedFilters,
  filterOptions,
  onToggleFilter,
  activeChips,
  onRemoveChip,
  groupByValue,
  groupByOptions,
  onGroupByChange,
  onClearAll,
  onSaveSearch,
  savedSearches,
  onApplySavedSearch,
  viewMode,
  onViewModeChange,
}: SearchFilterToolbarProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex w-full min-w-0 flex-col gap-3 xl:max-w-4xl">
        <Popover open={isMenuOpen} onOpenChange={onMenuOpenChange}>
          <PopoverAnchor asChild>
            <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-2 px-3 sm:px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                {activeChips.length > 0 ? (
                  <div className="flex min-w-0 max-w-full shrink items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:max-w-[calc(100%-180px)] [&::-webkit-scrollbar]:hidden">
                    {activeChips.map((chip) => (
                      <span key={chip.id} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                        {chip.kind === "filter" ? (
                          <Filter className="h-3 w-3 text-rose-700" />
                        ) : (
                          <LayoutGrid className="h-3 w-3 text-teal-700" />
                        )}
                        {chip.label}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRemoveChip(chip.id, chip.kind);
                          }}
                          className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                          aria-label={`Clear ${chip.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <Input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onFocus={() => onMenuOpenChange?.(true)}
                  placeholder={placeholder}
                  className="h-11 min-w-[140px] flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 sm:min-w-[160px]"
                />
              </div>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-[54px] items-center justify-center border-l border-slate-300 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                  aria-label="Open search filters"
                >
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </PopoverTrigger>
            </div>
          </PopoverAnchor>
          <PopoverContent align="center" className="w-[min(560px,calc(100vw-1rem))] p-0">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="p-3 md:border-r md:border-slate-200">
                <div className="mb-3 flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-rose-700" />
                  <h3 className="text-xl font-semibold text-slate-900">Filters</h3>
                </div>
                <div className="space-y-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onToggleFilter(option.value)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                        selectedFilters.includes(option.value) ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {selectedFilters.includes(option.value) ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 p-3 md:border-r md:border-t-0 md:border-slate-200">
                <div className="mb-3 flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 text-teal-700" />
                  <h3 className="text-xl font-semibold text-slate-900">Group By</h3>
                </div>
                <div className="space-y-1">
                  {groupByOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onGroupByChange(option.value)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                        groupByValue === option.value ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {groupByValue === option.value ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 p-3 md:border-t-0">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <h3 className="text-xl font-semibold text-slate-900">Favorites</h3>
                </div>
                <div className="space-y-3">
                  <Button type="button" variant="outline" className="h-9 w-full justify-start text-sm" onClick={onSaveSearch}>
                    Save current search
                  </Button>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="block w-full border-t border-slate-200 pt-3 text-left text-sm text-slate-700 hover:text-slate-900"
                  >
                    Clear all search options
                  </button>
                  {savedSearches.length > 0 ? (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved Searches</p>
                      <div className="space-y-1">
                        {savedSearches.map((searchItem) => (
                          <button
                            key={searchItem.id}
                            type="button"
                            onClick={() => onApplySavedSearch(searchItem.id)}
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {searchItem.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {viewMode && onViewModeChange ? (
        <div className="inline-flex items-center self-start rounded-md border border-slate-300 bg-slate-50 p-1 xl:self-auto">
          <button
            type="button"
            onClick={() => onViewModeChange("kanban")}
            className={`inline-flex h-9 w-11 items-center justify-center rounded-md ${
              viewMode === "kanban" ? "bg-[#2b6cb0] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="Kanban view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`inline-flex h-9 w-11 items-center justify-center rounded-md ${
              viewMode === "list" ? "bg-[#2b6cb0] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
