"use client";

import { useMemo, useState } from "react";
import { SearchFilterToolbar } from "@/components/shared/search-filter-toolbar";
import { ProjectFilterKey, ProjectGroupByKey } from "@/lib/project-board-filters";

interface ProjectSearchFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isSearchMenuOpen: boolean;
  onSearchMenuOpenChange: (open: boolean) => void;
  activeFilter: ProjectFilterKey;
  onActiveFilterChange: (value: ProjectFilterKey) => void;
  activeGroupBy: ProjectGroupByKey;
  onActiveGroupByChange: (value: ProjectGroupByKey) => void;
  onReset: () => void;
}

const FILTER_OPTIONS: Array<{ value: ProjectFilterKey; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "team", label: "Team Projects" },
  { value: "individual", label: "Individual Projects" },
  { value: "high_priority", label: "High Priority" },
];

const GROUP_BY_OPTIONS: Array<{ value: ProjectGroupByKey; label: string }> = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "manager", label: "Manager" },
  { value: "deadline", label: "Deadline" },
];

export function ProjectSearchFilterBar({
  searchQuery,
  onSearchQueryChange,
  isSearchMenuOpen,
  onSearchMenuOpenChange,
  activeFilter,
  onActiveFilterChange,
  activeGroupBy,
  onActiveGroupByChange,
  onReset,
}: ProjectSearchFilterBarProps) {
  const [savedSearches, setSavedSearches] = useState<
    Array<{
      id: string;
      label: string;
      query: string;
      filter: ProjectFilterKey;
      groupBy: ProjectGroupByKey;
    }>
  >([]);

  const activeChips = useMemo(
    () => [
      ...(activeFilter !== "all"
        ? [
            {
              id: activeFilter,
              label: FILTER_OPTIONS.find((item) => item.value === activeFilter)?.label || activeFilter,
              kind: "filter" as const,
            },
          ]
        : []),
      ...(activeGroupBy !== "none"
        ? [
            {
              id: activeGroupBy,
              label: GROUP_BY_OPTIONS.find((item) => item.value === activeGroupBy)?.label || activeGroupBy,
              kind: "group" as const,
            },
          ]
        : []),
    ],
    [activeFilter, activeGroupBy]
  );

  return (
    <SearchFilterToolbar
      query={searchQuery}
      onQueryChange={onSearchQueryChange}
      placeholder="Search..."
      isMenuOpen={isSearchMenuOpen}
      onMenuOpenChange={onSearchMenuOpenChange}
      selectedFilters={activeFilter === "all" ? [] : [activeFilter]}
      filterOptions={FILTER_OPTIONS}
      onToggleFilter={(value) =>
        onActiveFilterChange(value === activeFilter || value === "all" ? "all" : (value as ProjectFilterKey))
      }
      activeChips={activeChips}
      onRemoveChip={(_, kind) => {
        if (kind === "group") {
          onActiveGroupByChange("none");
          return;
        }
        onActiveFilterChange("all");
      }}
      groupByValue={activeGroupBy}
      groupByOptions={GROUP_BY_OPTIONS}
      onGroupByChange={(value) => onActiveGroupByChange(value as ProjectGroupByKey)}
      onClearAll={() => {
        onReset();
        onSearchMenuOpenChange(false);
      }}
      onSaveSearch={() => {
        const filterLabel = FILTER_OPTIONS.find((item) => item.value === activeFilter)?.label || "All";
        const groupLabel = GROUP_BY_OPTIONS.find((item) => item.value === activeGroupBy)?.label || "None";
        setSavedSearches((current) => [
          {
            id: crypto.randomUUID(),
            label: searchQuery.trim() || `${filterLabel}${activeGroupBy !== "none" ? ` / ${groupLabel}` : ""}`,
            query: searchQuery,
            filter: activeFilter,
            groupBy: activeGroupBy,
          },
          ...current,
        ]);
      }}
      savedSearches={savedSearches.map((item) => ({ id: item.id, label: item.label }))}
      onApplySavedSearch={(id) => {
        const selected = savedSearches.find((item) => item.id === id);
        if (!selected) return;
        onSearchQueryChange(selected.query);
        onActiveFilterChange(selected.filter);
        onActiveGroupByChange(selected.groupBy);
        onSearchMenuOpenChange(false);
      }}
    />
  );
}
