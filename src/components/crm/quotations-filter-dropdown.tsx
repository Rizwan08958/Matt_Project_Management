"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Layers3, Star } from "lucide-react";

interface QuotationsFilterDropdownProps {
  filterPreset: string;
  documentType: string;
  dateField: string;
  groupBy: string;
  activeTab: string;
  activeView: string;
  deletedView: boolean;
  query: string;
  customFilter: string;
  projectPreset: string;
  projectCategory: string;
  projectBudgetRanges: string;
  budgetMin: string;
  budgetMax: string;
  projectCategories: string[];
  saveSearchHref: string;
  clearAllHref: string;
  groupByLinks: Array<{ key: string; label: string; href: string }>;
}

export function QuotationsFilterDropdown({
  filterPreset,
  documentType,
  dateField,
  groupBy,
  activeTab,
  activeView,
  deletedView,
  query,
  customFilter,
  projectPreset,
  projectCategory,
  projectBudgetRanges,
  budgetMin,
  budgetMax,
  projectCategories,
  saveSearchHref,
  clearAllHref,
  groupByLinks,
}: QuotationsFilterDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stagedFilterPreset, setStagedFilterPreset] = useState(filterPreset);
  const [stagedDocumentType, setStagedDocumentType] = useState(documentType);
  const [stagedDateField, setStagedDateField] = useState(dateField);
  const [stagedGroupBy, setStagedGroupBy] = useState(groupBy);
  const [stagedCustomFilter, setStagedCustomFilter] = useState(customFilter);
  const [stagedProjectPreset, setStagedProjectPreset] = useState(projectPreset);
  const [stagedProjectCategories, setStagedProjectCategories] = useState<string[]>(
    projectCategory
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const [stagedProjectBudgetRanges, setStagedProjectBudgetRanges] = useState<string[]>(
    projectBudgetRanges
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const [stagedBudgetMin, setStagedBudgetMin] = useState(budgetMin);
  const [stagedBudgetMax, setStagedBudgetMax] = useState(budgetMax);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const applyQuotationFilterSelection = (overrides?: {
    tab?: string;
    filterPreset?: string;
    documentType?: string;
    dateField?: string;
    groupBy?: string;
    customFilter?: string;
  }) => {
    const nextTab = overrides?.tab ?? activeTab;
    const nextFilterPreset = overrides?.filterPreset ?? stagedFilterPreset;
    const nextDocumentType = overrides?.documentType ?? stagedDocumentType;
    const nextDateField = overrides?.dateField ?? stagedDateField;
    const nextGroupBy = overrides?.groupBy ?? stagedGroupBy;
    const nextCustomFilter = (overrides?.customFilter ?? stagedCustomFilter).trim();

    const next = new URLSearchParams();
    if (nextTab && nextTab !== "orders") next.set("tab", nextTab);
    if (activeView && activeView !== "list") next.set("view", activeView);
    if (query.trim()) next.set("q", query.trim());
    if (nextFilterPreset && nextFilterPreset !== "my_quotations") next.set("filterPreset", nextFilterPreset);
    if (nextDocumentType && nextDocumentType !== "quotations") next.set("documentType", nextDocumentType);
    if (nextDateField && nextDateField !== "create_date") next.set("dateField", nextDateField);
    if (nextGroupBy) next.set("groupBy", nextGroupBy);
    if (nextCustomFilter) next.set("customFilter", nextCustomFilter);
    if (deletedView) next.set("deleted", "1");

    const queryString = next.toString();
    router.push(queryString ? `/crm/quotations?${queryString}` : "/crm/quotations");
    setOpen(false);
  };

  const applyProjectFilterSelection = (overrides?: {
    projectPreset?: string;
    projectCategories?: string[];
    projectBudgetRanges?: string[];
    budgetMin?: string;
    budgetMax?: string;
    groupBy?: string;
    customFilter?: string;
    query?: string;
    closePanel?: boolean;
  }) => {
    const nextPreset = overrides?.projectPreset ?? stagedProjectPreset;
    const nextCategories = overrides?.projectCategories ?? stagedProjectCategories;
    const nextBudgetRanges = overrides?.projectBudgetRanges ?? stagedProjectBudgetRanges;
    const nextBudgetMin = (overrides?.budgetMin ?? stagedBudgetMin).trim();
    const nextBudgetMax = (overrides?.budgetMax ?? stagedBudgetMax).trim();
    const nextGroupBy = overrides?.groupBy ?? stagedGroupBy;
    const nextCustomFilter = (overrides?.customFilter ?? stagedCustomFilter).trim();
    const nextQuery = (overrides?.query ?? query).trim();
    const shouldClosePanel = overrides?.closePanel ?? true;

    const next = new URLSearchParams();
    next.set("tab", "projects");
    if (activeView && activeView !== "list") next.set("view", activeView);
    if (nextPreset) next.set("projectPreset", nextPreset);
    if (nextCategories.length > 0) next.set("projectCategory", nextCategories.join(","));
    if (nextBudgetRanges.length > 0) next.set("projectBudgetRanges", nextBudgetRanges.join(","));
    if (nextBudgetMin) next.set("budgetMin", nextBudgetMin);
    if (nextBudgetMax) next.set("budgetMax", nextBudgetMax);
    if (nextGroupBy) next.set("groupBy", nextGroupBy);
    if (nextCustomFilter) next.set("customFilter", nextCustomFilter);
    if (nextQuery) next.set("q", nextQuery);

    const queryString = next.toString();
    router.push(queryString ? `/crm/quotations?${queryString}` : "/crm/quotations?tab=projects");
    if (shouldClosePanel) setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative h-full border-l border-slate-300">
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center text-slate-700 hover:bg-slate-50"
        aria-label="Open filters"
        onClick={() => {
          if (!open) {
            setStagedFilterPreset(filterPreset);
            setStagedDocumentType(documentType);
            setStagedDateField(dateField);
            setStagedGroupBy(groupBy);
            setStagedCustomFilter(customFilter);
            setStagedProjectPreset(projectPreset);
            setStagedProjectCategories(
              projectCategory
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            );
            setStagedProjectBudgetRanges(
              projectBudgetRanges
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            );
            setStagedBudgetMin(budgetMin);
            setStagedBudgetMax(budgetMax);
          }
          setOpen((current) => !current);
        }}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed inset-x-2 top-24 z-40 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-lg md:left-1/2 md:right-auto md:top-36 md:w-[860px] md:max-w-[96vw] md:-translate-x-1/2">
          {activeTab === "projects" ? (
            <form
              method="get"
              action="/crm/quotations"
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                applyProjectFilterSelection();
              }}
            >
              <input type="hidden" name="tab" value="projects" />
              <input type="hidden" name="view" value={activeView} />
              <input type="hidden" name="groupBy" value={stagedGroupBy} />
              <input type="hidden" name="q" value="" />

              <div className="space-y-2 md:border-r md:border-slate-300 md:pr-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#7c5a77]" />
                  <p className="text-base font-semibold">Filters</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextCategories: string[] = [];
                    const nextBudgetRanges: string[] = [];
                    setStagedProjectPreset("all_projects");
                    setStagedProjectCategories(nextCategories);
                    setStagedProjectBudgetRanges(nextBudgetRanges);
                    setStagedBudgetMin("");
                    setStagedBudgetMax("");
                    applyProjectFilterSelection({
                      projectPreset: "all_projects",
                      projectCategories: nextCategories,
                      projectBudgetRanges: nextBudgetRanges,
                      budgetMin: "",
                      budgetMax: "",
                      closePanel: false,
                    });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedProjectPreset === "all_projects"
                      ? "bg-slate-200 font-semibold"
                      : ""
                  }`}
                >
                  All Projects
                </button>

                {projectCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      const nextCategories = stagedProjectCategories.includes(category)
                        ? stagedProjectCategories.filter((value) => value !== category)
                        : [...stagedProjectCategories, category];
                      setStagedProjectPreset("");
                      setStagedProjectCategories(nextCategories);
                      applyProjectFilterSelection({
                        projectPreset: "",
                        projectCategories: nextCategories,
                        closePanel: false,
                      });
                    }}
                    className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedProjectCategories.includes(category) ? "bg-slate-200 font-semibold" : ""
                    }`}
                  >
                    {category}
                  </button>
                ))}

                <div className="border-t border-slate-300 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextRanges = stagedProjectBudgetRanges.includes("lte_5000")
                        ? stagedProjectBudgetRanges.filter((value) => value !== "lte_5000")
                        : [...stagedProjectBudgetRanges, "lte_5000"];
                      setStagedProjectPreset("");
                      setStagedProjectBudgetRanges(nextRanges);
                      applyProjectFilterSelection({
                        projectPreset: "",
                        projectBudgetRanges: nextRanges,
                        closePanel: false,
                      });
                    }}
                    className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedProjectBudgetRanges.includes("lte_5000") ? "bg-slate-200 font-semibold" : ""
                    }`}
                  >
                    {"Budget <= 5,000"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextRanges = stagedProjectBudgetRanges.includes("range_5001_20000")
                        ? stagedProjectBudgetRanges.filter((value) => value !== "range_5001_20000")
                        : [...stagedProjectBudgetRanges, "range_5001_20000"];
                      setStagedProjectPreset("");
                      setStagedProjectBudgetRanges(nextRanges);
                      applyProjectFilterSelection({
                        projectPreset: "",
                        projectBudgetRanges: nextRanges,
                        closePanel: false,
                      });
                    }}
                    className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedProjectBudgetRanges.includes("range_5001_20000") ? "bg-slate-200 font-semibold" : ""
                    }`}
                  >
                    Budget 5,001 - 20,000
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextRanges = stagedProjectBudgetRanges.includes("gte_20001")
                        ? stagedProjectBudgetRanges.filter((value) => value !== "gte_20001")
                        : [...stagedProjectBudgetRanges, "gte_20001"];
                      setStagedProjectPreset("");
                      setStagedProjectBudgetRanges(nextRanges);
                      applyProjectFilterSelection({
                        projectPreset: "",
                        projectBudgetRanges: nextRanges,
                        closePanel: false,
                      });
                    }}
                    className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedProjectBudgetRanges.includes("gte_20001") ? "bg-slate-200 font-semibold" : ""
                    }`}
                  >
                    {"Budget >= 20,001"}
                  </button>
                </div>

                <div className="space-y-2 border-t border-slate-300 pt-2">
                  <input
                    type="text"
                    name="customFilter"
                    value={stagedCustomFilter}
                    onChange={(event) => {
                      setStagedProjectPreset("");
                      setStagedCustomFilter(event.target.value);
                    }}
                    placeholder="Custom Filter..."
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base outline-none focus:border-slate-500"
                  />
                  <button
                    type="submit"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-300 pt-3 md:border-r md:border-t-0 md:border-slate-300 md:px-3 md:pt-0">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-teal-700" />
                  <p className="text-base font-semibold">Group By</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStagedGroupBy("project_name");
                    setStagedProjectPreset("");
                    applyProjectFilterSelection({ groupBy: "project_name", projectPreset: "" });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedGroupBy === "project_name" ? "bg-slate-200 font-semibold" : ""
                  }`}
                >
                  Project Name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStagedGroupBy("category");
                    setStagedProjectPreset("");
                    applyProjectFilterSelection({ groupBy: "category", projectPreset: "" });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedGroupBy === "category" ? "bg-slate-200 font-semibold" : ""
                  }`}
                >
                  Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStagedGroupBy("budget");
                    setStagedProjectPreset("");
                    applyProjectFilterSelection({ groupBy: "budget", projectPreset: "" });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedGroupBy === "budget" ? "bg-slate-200 font-semibold" : ""
                  }`}
                >
                  Budget
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStagedGroupBy("create_date");
                    setStagedProjectPreset("");
                    applyProjectFilterSelection({ groupBy: "create_date", projectPreset: "" });
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedGroupBy === "create_date" ? "bg-slate-200 font-semibold" : ""
                  }`}
                >
                  <span>Create Date</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <div className="border-t border-slate-300 pt-2">
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200">
                    <span>Custom Group</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-300 pt-3 md:border-t-0 md:pl-3 md:pt-0">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <p className="text-base font-semibold">Favorites</p>
                </div>
                <button
                  type="button"
                  onClick={() => applyProjectFilterSelection()}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                >
                  <span>Save current search</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <div className="border-t border-slate-300 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    applyProjectFilterSelection({
                      projectPreset: "",
                      projectCategories: [],
                      projectBudgetRanges: [],
                      budgetMin: "",
                      budgetMax: "",
                      groupBy: "",
                        customFilter: "",
                        query: "",
                      })
                    }
                    className="block rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                  >
                    Clear all search options
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form
              method="get"
              action="/crm/quotations"
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                applyQuotationFilterSelection();
              }}
            >
              <input type="hidden" name="tab" value={activeTab} />
              <input type="hidden" name="view" value={activeView} />
              <input type="hidden" name="q" value={query} />
              <input type="hidden" name="filterPreset" value={stagedFilterPreset} />
              <input type="hidden" name="documentType" value={stagedDocumentType} />
              <input type="hidden" name="dateField" value={stagedDateField} />
              <input type="hidden" name="groupBy" value={stagedGroupBy} />
              <input type="hidden" name="deleted" value={deletedView ? "1" : ""} />

              <div className="space-y-2 md:border-r md:border-slate-300 md:pr-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#7c5a77]" />
                  <p className="text-base font-semibold">Filters</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStagedFilterPreset("my_quotations");
                    applyQuotationFilterSelection({
                      tab: "quotations",
                      filterPreset: "my_quotations",
                      documentType: "quotations",
                    });
                  }}
                  className={`block w-full rounded bg-slate-200 px-2 py-1 text-left text-base hover:bg-slate-300 ${
                    stagedFilterPreset === "my_quotations" ? "font-semibold" : ""
                  }`}
                >
                  My Quotations
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStagedFilterPreset("all_quotations");
                    setStagedDocumentType("quotations");
                    applyQuotationFilterSelection({
                      tab: "quotations",
                      filterPreset: "all_quotations",
                      documentType: "quotations",
                    });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedDocumentType === "quotations" ? "font-semibold" : ""
                  }`}
                >
                  Quotations
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStagedFilterPreset("all_quotations");
                    setStagedDocumentType("sales_orders");
                    applyQuotationFilterSelection({
                      tab: "orders",
                      filterPreset: "all_quotations",
                      documentType: "sales_orders",
                    });
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                    stagedDocumentType === "sales_orders" ? "font-semibold" : ""
                  }`}
                >
                  Sales Orders
                </button>

                <div className="border-t border-slate-300 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStagedDateField("create_date");
                      applyQuotationFilterSelection({ dateField: "create_date" });
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedDateField === "create_date" ? "font-semibold" : ""
                    }`}
                  >
                    <span>Create Date</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 border-t border-slate-300 pt-2">
                  <input
                    type="text"
                    name="customFilter"
                    value={stagedCustomFilter}
                    onChange={(event) => setStagedCustomFilter(event.target.value)}
                    placeholder="Custom Filter..."
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-300 pt-3 md:border-r md:border-t-0 md:border-slate-300 md:px-3 md:pt-0">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-teal-700" />
                  <p className="text-base font-semibold">Group By</p>
                </div>
                {groupByLinks.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setStagedGroupBy(item.key);
                      applyQuotationFilterSelection({ groupBy: item.key });
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${
                      stagedGroupBy === item.key ? "bg-slate-200 font-semibold" : ""
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.key === "order_date" ? <ChevronDown className="h-4 w-4" /> : null}
                  </button>
                ))}
                <div className="border-t border-slate-300 pt-2">
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200">
                    <span>Custom Group</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-300 pt-3 md:border-t-0 md:pl-3 md:pt-0">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <p className="text-base font-semibold">Favorites</p>
                </div>
                <Link
                  href={saveSearchHref}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                >
                  <span>Save current search</span>
                  <ChevronDown className="h-4 w-4" />
                </Link>
                <div className="border-t border-slate-300 pt-2">
                  <Link
                    href={clearAllHref}
                    onClick={() => setOpen(false)}
                    className="block rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                  >
                    Clear all search options
                  </Link>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

