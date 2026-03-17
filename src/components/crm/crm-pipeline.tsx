"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronsLeftRight,
  ChevronsRight,
  Clock3,
  Columns2,
  Funnel,
  IndianRupee,
  Layers3,
  List,
  MapPin,
  MoreHorizontal,
  Phone,
  Pencil,
  Plus,
  Search,
  Send,
  Star,
  Table,
  TimerReset,
  Trash2,
  User,
  Mail,
  Check,
  Settings,
  Settings2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  archiveCrmLead,
  createCrmStage,
  createCrmLead,
  deleteCrmStage,
  deleteCrmLead,
  moveCrmLeadStage,
  reorderCrmStages,
  updateCrmStage,
  updateCrmLead,
  type CrmLeadItem,
  type CrmStageItem,
  type LeadStage,
} from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CrmPipelineProps {
  leads: CrmLeadItem[];
  stages: CrmStageItem[];
  query: string;
  salesperson: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  clients: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }[];
}

const STAGE_THEMES: Array<{ column: string; header: string; badge: string }> = [
  {
    column: "border-cyan-200 bg-cyan-50/30",
    header: "bg-cyan-50",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    column: "border-blue-200 bg-blue-50/30",
    header: "bg-blue-50",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    column: "border-amber-200 bg-amber-50/30",
    header: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    column: "border-emerald-200 bg-emerald-50/30",
    header: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    column: "border-rose-200 bg-rose-50/30",
    header: "bg-rose-50",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    column: "border-violet-200 bg-violet-50/30",
    header: "bg-violet-50",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
  },
];

const GENERATE_LEAD_OPTIONS = [
  {
    title: "Lead Sourcing",
    description: "Search in our directory of companies",
    icon: User,
  },
  {
    title: "Mail Plugins",
    description: "Generate leads from incoming email",
    icon: Mail,
  },
  {
    title: "Create a Landing Page",
    description: "Turn visitors into qualified leads",
    icon: BriefcaseBusiness,
  },
  {
    title: "Email Marketing",
    description: "Send email and get leads from replies",
    icon: Send,
  },
  {
    title: "Appointments",
    description: "Capture leads from scheduled meetings",
    icon: CalendarDays,
  },
  {
    title: "Send a Survey",
    description: "Create leads from specific answers",
    icon: Table,
  },
] as const;

const LEAD_AVATAR_COLOR_CLASSES = [
  "bg-amber-700",
  "bg-blue-700",
  "bg-emerald-700",
  "bg-rose-700",
  "bg-violet-700",
  "bg-cyan-700",
  "bg-orange-700",
  "bg-slate-700",
] as const;

const getLeadAvatarColorClass = (value: string) => {
  const seed = value.trim();
  if (!seed) return LEAD_AVATAR_COLOR_CLASSES[0];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return LEAD_AVATAR_COLOR_CLASSES[hash % LEAD_AVATAR_COLOR_CLASSES.length];
};

const normalizeText = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const normalizePhone = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

type CustomFilterField =
  | "country"
  | "city"
  | "stage"
  | "salesperson"
  | "email"
  | "phone"
  | "client"
  | "value"
  | "probability";

type CustomFilterOperator = "equals" | "contains" | "is_set" | "is_not_set" | "gt" | "lt";

interface CustomFilterRule {
  id: string;
  field: CustomFilterField;
  operator: CustomFilterOperator;
  value: string;
}

const CUSTOM_FILTER_FIELDS: Array<{ value: CustomFilterField; label: string }> = [
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "stage", label: "Stage" },
  { value: "salesperson", label: "Salesperson" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "client", label: "Customer" },
  { value: "value", label: "Expected Revenue" },
  { value: "probability", label: "Probability" },
];

const CUSTOM_FILTER_OPERATORS: Array<{ value: CustomFilterOperator; label: string }> = [
  { value: "equals", label: "is equal to" },
  { value: "contains", label: "contains" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
  { value: "gt", label: "is greater than" },
  { value: "lt", label: "is less than" },
];

const GROUP_BY_LABELS: Record<
  "salesperson" | "sales_team" | "stage" | "city" | "country" | "lost_reason" | "campaign" | "medium" | "source",
  string
> = {
  salesperson: "Salesperson",
  sales_team: "Sales Team",
  stage: "Stage",
  city: "City",
  country: "Country",
  lost_reason: "Lost Reason",
  campaign: "Campaign",
  medium: "Medium",
  source: "Source",
};

const getDefaultCustomRule = (): CustomFilterRule => ({
  id: crypto.randomUUID(),
  field: "country",
  operator: "contains",
  value: "",
});

export function CrmPipeline({ leads, stages, query, salesperson, clients }: CrmPipelineProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showStats, setShowStats] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "value_desc" | "value_asc" | "name_asc">("recent");
  const [editingLead, setEditingLead] = useState<CrmLeadItem | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newValue, setNewValue] = useState("0");
  const [newProbabilityLevel, setNewProbabilityLevel] = useState<1 | 2 | 3>(1);
  const [newNotes, setNewNotes] = useState("");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const initialStageKeys = stages.map((stage) => stage.key);
  const initialStageLabels = stages.reduce<Record<string, string>>((acc, stage) => {
    acc[stage.key] = stage.label;
    return acc;
  }, {});
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [visibleStageKeys, setVisibleStageKeys] = useState<LeadStage[]>(initialStageKeys);
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(initialStageLabels);
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [newStageLabel, setNewStageLabel] = useState("");
  const [stageFilters, setStageFilters] = useState<LeadStage[]>([]);
  const [myPipelineOnly, setMyPipelineOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [openOpportunitiesOnly, setOpenOpportunitiesOnly] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [highProbabilityOnly, setHighProbabilityOnly] = useState(false);
  const [noValueOnly, setNoValueOnly] = useState(false);
  const [customFilterRules, setCustomFilterRules] = useState<CustomFilterRule[]>([]);
  const [customFilterMode, setCustomFilterMode] = useState<"any" | "all">("any");
  const [customIncludeArchived, setCustomIncludeArchived] = useState(false);
  const [showCustomFilterDialog, setShowCustomFilterDialog] = useState(false);
  const [draftCustomFilterRules, setDraftCustomFilterRules] = useState<CustomFilterRule[]>([getDefaultCustomRule()]);
  const [draftCustomFilterMode, setDraftCustomFilterMode] = useState<"any" | "all">("any");
  const [draftCustomIncludeArchived, setDraftCustomIncludeArchived] = useState(false);
  const [groupByField, setGroupByField] = useState<
    "salesperson" | "sales_team" | "stage" | "city" | "country" | "lost_reason" | "campaign" | "medium" | "source"
  >("stage");
  const [groupByDate, setGroupByDate] = useState<"creation" | "expected_closing" | "closed_date">("creation");
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const addStagePanelRef = useRef<HTMLDivElement>(null);
  const [editingStageKey, setEditingStageKey] = useState<LeadStage | null>(null);
  const [editingStageLabel, setEditingStageLabel] = useState("");
  const [foldedStages, setFoldedStages] = useState<Record<string, boolean>>({});
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    ids: string[];
    title: string;
    detail: string;
  } | null>(null);
  const [archiveConfirmState, setArchiveConfirmState] = useState<{
    ids: string[];
    title: string;
    detail: string;
  } | null>(null);
  const [stageDeleteConfirmKey, setStageDeleteConfirmKey] = useState<LeadStage | null>(null);
  const [activityOpenLeadId, setActivityOpenLeadId] = useState<string | null>(null);
  const [salespersonLead, setSalespersonLead] = useState<CrmLeadItem | null>(null);
  const [draggingStageKey, setDraggingStageKey] = useState<LeadStage | null>(null);
  const [draggingType, setDraggingType] = useState<"lead" | "stage" | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
      }),
    []
  );
  const shortCurrency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        notation: "compact",
        compactDisplay: "short",
      }),
    []
  );
  const openLeadDetails = (leadId: string) => {
    router.push(`/crm/${leadId}`);
  };

  const visibleStages = useMemo(
    () => visibleStageKeys
      .map((key) => ({ key, label: stageLabels[key] || key }))
      .filter((stage): stage is { key: LeadStage; label: string } => Boolean(stage)),
    [visibleStageKeys, stageLabels]
  );
  const readTagValue = (tags: string | null, key: string) => {
    if (!tags) return "";

    const marker = "__client_meta__:";
    const markerIndex = tags.indexOf(marker);
    const keyAliases: Record<string, string[]> = {
      city: ["city", "City", "CITY", "clientCity", "addressCity", "town", "locationCity"],
      country: ["country", "Country", "COUNTRY", "clientCountry", "addressCountry", "nation"],
    };
    const candidates = keyAliases[key] || [key];

    if (markerIndex >= 0) {
      let metaRaw = tags.slice(markerIndex + marker.length).trim();
      if (metaRaw.startsWith("\"") && metaRaw.endsWith("\"")) {
        metaRaw = metaRaw.slice(1, -1);
      }
      metaRaw = metaRaw.replace(/\\"/g, "\"");
      try {
        const parsed = JSON.parse(metaRaw) as Record<string, unknown>;
        for (const candidate of candidates) {
          const directValue = parsed[candidate];
          if (typeof directValue === "string" && directValue.trim()) return directValue.trim();
        }
        for (const [metaKey, metaValue] of Object.entries(parsed)) {
          if (
            candidates.some((candidate) => candidate.toLowerCase() === metaKey.toLowerCase()) &&
            typeof metaValue === "string" &&
            metaValue.trim()
          ) {
            return metaValue.trim();
          }
        }
      } catch {
        // keep fallback parsing below
      }
    }

    const parts = tags
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const found = parts.find((item) => {
      const lower = item.toLowerCase();
      return candidates.some((candidate) => lower.startsWith(`${candidate.toLowerCase()}:`));
    });
    return found ? found.split(":").slice(1).join(":").trim() : "";
  };

  const stagesForBoard = useMemo(
    () => (stageFilters.length > 0
      ? visibleStages.filter((stage) => stageFilters.includes(stage.key))
      : visibleStages),
    [visibleStages, stageFilters]
  );

  const clientsByEmail = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizeText(client.email);
      if (key) map.set(key, client);
    });
    return map;
  }, [clients]);

  const clientsByPhone = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizePhone(client.phone);
      if (key) map.set(key, client);
    });
    return map;
  }, [clients]);

  const clientsByName = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizeText(client.name);
      if (key && !map.has(key)) map.set(key, client);
    });
    return map;
  }, [clients]);

  const findMatchingClient = (lead: CrmLeadItem) => {
    const byEmail = clientsByEmail.get(normalizeText(lead.email));
    if (byEmail) return byEmail;
    const byPhone = clientsByPhone.get(normalizePhone(lead.phone));
    if (byPhone) return byPhone;
    return clientsByName.get(normalizeText(lead.clientName || lead.title));
  };

  const getLeadLocationValue = (lead: CrmLeadItem, field: "city" | "country") => {
    const fromTags = readTagValue(lead.tags, field).trim();
    if (fromTags) return fromTags;
    const matchedClient = findMatchingClient(lead);
    const fromClient = (matchedClient?.[field] || "").trim();
    return fromClient;
  };

  const getRuleFieldValue = (lead: CrmLeadItem, field: CustomFilterField) => {
    if (field === "country") return getLeadLocationValue(lead, "country");
    if (field === "city") return getLeadLocationValue(lead, "city");
    if (field === "stage") return stageLabels[lead.stage] || lead.stage || "";
    if (field === "salesperson") return lead.createdByName || lead.createdByEmail || "";
    if (field === "email") return lead.email || "";
    if (field === "phone") return lead.phone || "";
    if (field === "client") return lead.clientName || lead.title || "";
    if (field === "value") return lead.value ?? 0;
    return lead.probabilityLevel ?? 0;
  };

  const isRuleComplete = (rule: CustomFilterRule) =>
    rule.operator === "is_set" || rule.operator === "is_not_set" || rule.value.trim().length > 0;

  const doesRuleMatch = (lead: CrmLeadItem, rule: CustomFilterRule) => {
    const fieldValue = getRuleFieldValue(lead, rule.field);
    if (rule.operator === "is_set") return String(fieldValue).trim().length > 0;
    if (rule.operator === "is_not_set") return String(fieldValue).trim().length === 0;

    if (rule.field === "value" || rule.field === "probability") {
      const source = Number(fieldValue || 0);
      const target = Number(rule.value || 0);
      if (Number.isNaN(target)) return false;
      if (rule.operator === "equals") return source === target;
      if (rule.operator === "gt") return source > target;
      if (rule.operator === "lt") return source < target;
      return String(source).includes(rule.value.trim());
    }

    const source = String(fieldValue || "").toLowerCase();
    const target = rule.value.trim().toLowerCase();
    if (rule.operator === "equals") return source === target;
    if (rule.operator === "contains") return source.includes(target);
    if (rule.operator === "gt") return source > target;
    if (rule.operator === "lt") return source < target;
    return false;
  };

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const currentUserEmail = salesperson.email.trim().toLowerCase();
    const activeCustomRules = customFilterRules.filter(isRuleComplete);

    return leads.filter((lead) => {
      const stageName = (stageLabels[lead.stage] || lead.stage || "").toLowerCase();
      const isArchived = stageName.includes("archived") || stageName.includes("deleted");
      const isClosed = stageName.includes("won") || stageName.includes("lost");
      const sameCreatorId = Boolean(salesperson.id) && lead.createdById === salesperson.id;
      const creatorEmail = (lead.createdByEmail || "").trim().toLowerCase();
      const sameCreatorEmail =
        Boolean(currentUserEmail) &&
        creatorEmail.length > 0 &&
        creatorEmail === currentUserEmail;
      const isCurrentUserLead = sameCreatorId || sameCreatorEmail;

      if (!customIncludeArchived && isArchived) return false;
      if (myPipelineOnly && !isCurrentUserLead) return false;
      if (unassignedOnly && lead.createdById) return false;
      if (openOpportunitiesOnly && isClosed) return false;
      if (stageFilters.length > 0 && !stageFilters.includes(lead.stage)) return false;
      if (requireEmail && !lead.email) return false;
      if (requirePhone && !lead.phone) return false;
      if (highProbabilityOnly && (lead.probabilityLevel ?? 1) < 3) return false;
      if (noValueOnly && (lead.value ?? 0) > 0) return false;
      if (activeCustomRules.length > 0) {
        const matches = activeCustomRules.map((rule) => doesRuleMatch(lead, rule));
        const passesCustomFilter = customFilterMode === "all"
          ? matches.every(Boolean)
          : matches.some(Boolean);
        if (!passesCustomFilter) return false;
      }
      if (!term) return true;
      return [
        lead.title,
        lead.clientName,
        lead.email,
        lead.phone,
        stageLabels[lead.stage] || lead.stage,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [
    leads,
    stageFilters,
    myPipelineOnly,
    unassignedOnly,
    openOpportunitiesOnly,
    requireEmail,
    requirePhone,
    highProbabilityOnly,
    noValueOnly,
    search,
    stageLabels,
    salesperson.id,
    salesperson.email,
    customFilterRules,
    customFilterMode,
    customIncludeArchived,
    doesRuleMatch,
  ]);

  const activeSearchChips = useMemo(() => {
    const chips: Array<{ id: string; label: string }> = [];
    if (groupByField !== "stage") {
      chips.push({ id: "group_by", label: GROUP_BY_LABELS[groupByField] });
    }
    if (myPipelineOnly) chips.push({ id: "my_pipeline", label: "My Pipeline" });
    if (unassignedOnly) chips.push({ id: "unassigned", label: "Unassigned" });
    if (openOpportunitiesOnly) chips.push({ id: "open_opportunities", label: "Open Opportunities" });
    if (customIncludeArchived) chips.push({ id: "include_archived", label: "Include archived" });
    stageFilters.forEach((stageKey) => {
      chips.push({ id: `stage:${stageKey}`, label: stageLabels[stageKey] || stageKey });
    });
    customFilterRules.filter(isRuleComplete).forEach((rule) => {
      const fieldLabel = CUSTOM_FILTER_FIELDS.find((item) => item.value === rule.field)?.label || rule.field;
      const valueLabel = rule.value.trim();
      chips.push({ id: `custom:${rule.id}`, label: valueLabel ? `${fieldLabel}: ${valueLabel}` : fieldLabel });
    });
    if (requireEmail) chips.push({ id: "has_email", label: "Has email" });
    if (requirePhone) chips.push({ id: "has_phone", label: "Has phone" });
    if (highProbabilityOnly) chips.push({ id: "high_probability", label: "High probability" });
    if (noValueOnly) chips.push({ id: "no_value", label: "No expected value" });
    return chips;
  }, [
    groupByField,
    myPipelineOnly,
    unassignedOnly,
    openOpportunitiesOnly,
    customIncludeArchived,
    customFilterRules,
    stageFilters,
    stageLabels,
    requireEmail,
    requirePhone,
    highProbabilityOnly,
    noValueOnly,
  ]);

  const getGroupValue = (lead: CrmLeadItem) => {
    if (groupByField === "salesperson") {
      return (lead.createdByName || lead.createdByEmail || "Unassigned").trim();
    }
    if (groupByField === "sales_team") {
      return (lead.createdByRole || "Unassigned").trim();
    }
    if (groupByField === "stage") return stageLabels[lead.stage] || lead.stage || "";
    if (groupByField === "city") return getLeadLocationValue(lead, "city");
    if (groupByField === "country") return getLeadLocationValue(lead, "country");
    if (groupByField === "lost_reason") return readTagValue(lead.tags, "lost");
    if (groupByField === "campaign") return readTagValue(lead.tags, "campaign");
    if (groupByField === "medium") return readTagValue(lead.tags, "medium");
    return readTagValue(lead.tags, "source");
  };

  const orderedLeads = useMemo(() => {
    const dateValue = (lead: CrmLeadItem) => {
      if (groupByDate === "expected_closing") return new Date(lead.expectedClosingDate || lead.createdAt).getTime();
      if (groupByDate === "closed_date") return new Date(lead.updatedAt).getTime();
      return new Date(lead.createdAt).getTime();
    };

    return [...filteredLeads].sort((a, b) => {
      const groupCompare = getGroupValue(a).localeCompare(getGroupValue(b));
      if (groupCompare !== 0) return groupCompare;

      if (sortMode === "recent") return dateValue(b) - dateValue(a);
      if (sortMode === "oldest") return dateValue(a) - dateValue(b);
      if (sortMode === "value_desc") return (b.value ?? 0) - (a.value ?? 0);
      if (sortMode === "value_asc") return (a.value ?? 0) - (b.value ?? 0);
      return (a.clientName || a.title || "").localeCompare(b.clientName || b.title || "");
    });
  }, [filteredLeads, sortMode, groupByField, groupByDate, stageLabels, getGroupValue]);

  const grouped = useMemo(() => {
    return stagesForBoard.map((stage) => {
      const items = orderedLeads.filter((lead) => lead.stage === stage.key);
      return {
        ...stage,
        items,
        expectedRevenueTotal: items.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
      };
    });
  }, [orderedLeads, stagesForBoard]);

  const groupedBySelectedField = useMemo(() => {
    if (groupByField === "stage") {
      return grouped.map((stage) => ({
        key: stage.key,
        label: stage.label,
        items: stage.items,
        expectedRevenueTotal: stage.expectedRevenueTotal,
      }));
    }

    const groups = new Map<string, CrmLeadItem[]>();
    orderedLeads.forEach((lead) => {
      const rawLabel = getGroupValue(lead).trim();
      const label = rawLabel.length > 0 ? rawLabel : "Undefined";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)?.push(lead);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({
        key: `${groupByField}:${label.toLowerCase()}`,
        label: label === "Undefined"
          ? groupByField === "city"
            ? "No City"
            : groupByField === "country"
              ? "No Country"
              : label
          : label,
        items,
        expectedRevenueTotal: items.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
      }));
  }, [groupByField, grouped, orderedLeads, getGroupValue]);

  const isStageGrouping = groupByField === "stage";

  const stageThemeByKey = useMemo(() => {
    return visibleStageKeys.reduce<Record<string, { column: string; header: string; badge: string }>>((acc, key, index) => {
      acc[key] = STAGE_THEMES[index % STAGE_THEMES.length];
      return acc;
    }, {});
  }, [visibleStageKeys]);

  const toErrorMessage = (error: unknown) => {
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      return Object.values(error as Record<string, string[] | undefined>)
        .flat()
        .filter(Boolean)
        .join(", ");
    }
    return "Something went wrong";
  };

  const updateQuery = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(search.trim());
  };

  const openCustomFilterDialog = () => {
    setDraftCustomFilterMode(customFilterMode);
    setDraftCustomIncludeArchived(customIncludeArchived);
    setDraftCustomFilterRules(customFilterRules.length > 0 ? customFilterRules : [getDefaultCustomRule()]);
    setShowCustomFilterDialog(true);
  };

  const handleDiscardCustomFilter = () => {
    setDraftCustomFilterMode(customFilterMode);
    setDraftCustomIncludeArchived(customIncludeArchived);
    setDraftCustomFilterRules(customFilterRules.length > 0 ? customFilterRules : [getDefaultCustomRule()]);
    setShowCustomFilterDialog(false);
  };

  const handleApplyCustomFilter = () => {
    setCustomFilterMode(draftCustomFilterMode);
    setCustomIncludeArchived(draftCustomIncludeArchived);
    setCustomFilterRules(draftCustomFilterRules.filter(isRuleComplete));
    setShowCustomFilterDialog(false);
  };

  const updateDraftCustomRule = (id: string, patch: Partial<CustomFilterRule>) => {
    setDraftCustomFilterRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const removeDraftCustomRule = (id: string) => {
    setDraftCustomFilterRules((current) => {
      const next = current.filter((rule) => rule.id !== id);
      return next.length > 0 ? next : [getDefaultCustomRule()];
    });
  };

  const handleCreate = (formData: FormData) => {
    const clientName = newClientName.trim();
    const resolvedTitle = clientName
      ? /\bopportunity\b/i.test(clientName)
        ? clientName
        : `${clientName}'s opportunity`
      : newEmail.trim() || "New opportunity";
    formData.set("clientName", newClientName);
    formData.set("title", resolvedTitle);
    formData.set("email", newEmail);
    formData.set("phone", newPhone);
    formData.set("value", newValue);
    formData.set("probabilityLevel", String(newProbabilityLevel));
    formData.set("notes", newNotes);

    startTransition(async () => {
      const result = await createCrmLead(formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      toast.success("Lead created");
      setShowCreate(false);
      setNewClientName("");
      setNewEmail("");
      setNewPhone("");
      setNewValue("0");
      setNewProbabilityLevel(1);
      setNewNotes("");
      router.refresh();
    });
  };

  const onClientNameChange = (value: string) => {
    setNewClientName(value);
    const matched = clients.find((client) => client.name.toLowerCase() === value.trim().toLowerCase());
    if (!matched) return;

    setNewEmail(matched.email || "");
    setNewPhone(matched.phone || "");
  };

  const handleRequestDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    const matchingLeads = leads.filter((lead) => ids.includes(lead.id));
    const primaryLead = matchingLeads[0];
    setDeleteConfirmState({
      ids,
      title:
        ids.length === 1
          ? `Delete "${primaryLead?.title || primaryLead?.clientName || "this lead"}"?`
          : `Delete ${ids.length} selected leads?`,
      detail:
        ids.length === 1
          ? "This action permanently removes the lead details and cannot be undone."
          : "This action permanently removes all selected lead details and cannot be undone.",
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmState || deleteConfirmState.ids.length === 0) return;
    startTransition(async () => {
      let deletedCount = 0;
      for (const id of deleteConfirmState.ids) {
        const result = await deleteCrmLead(id);
        if (result.error) {
          toast.error(toErrorMessage(result.error));
          continue;
        }
        deletedCount += 1;
      }
      setDeleteConfirmState(null);
      setSelectedLeadIds((current) => current.filter((id) => !deleteConfirmState.ids.includes(id)));
      toast.success(
        deletedCount === 1 ? "Lead moved to deleted page" : `${deletedCount} leads moved to deleted page`
      );
      router.refresh();
    });
  };

  const handleRequestArchive = (ids: string[]) => {
    if (ids.length === 0) return;
    const matchingLeads = leads.filter((lead) => ids.includes(lead.id));
    const primaryLead = matchingLeads[0];
    setArchiveConfirmState({
      ids,
      title:
        ids.length === 1
          ? `Archive "${primaryLead?.title || primaryLead?.clientName || "this lead"}"?`
          : `Archive ${ids.length} selected leads?`,
      detail:
        ids.length === 1
          ? "This action will move the selected lead details to the archive page."
          : "This action will move all selected lead details to the archive page.",
    });
  };

  const handleConfirmArchive = () => {
    if (!archiveConfirmState || archiveConfirmState.ids.length === 0) return;
    startTransition(async () => {
      let archivedCount = 0;
      for (const id of archiveConfirmState.ids) {
        const result = await archiveCrmLead(id);
        if (result.error) {
          toast.error(toErrorMessage(result.error));
          continue;
        }
        archivedCount += 1;
      }
      setArchiveConfirmState(null);
      setSelectedLeadIds((current) => current.filter((id) => !archiveConfirmState.ids.includes(id)));
      toast.success(
        archivedCount === 1 ? "Lead moved to archive page" : `${archivedCount} leads moved to archive page`
      );
      router.refresh();
    });
  };

  const visibleSelectedLeadIds = useMemo(() => {
    const visible = new Set(filteredLeads.map((lead) => lead.id));
    return selectedLeadIds.filter((id) => visible.has(id));
  }, [selectedLeadIds, filteredLeads]);

  const handleBulkDelete = () => {
    if (visibleSelectedLeadIds.length === 0) return;
    handleRequestDelete(visibleSelectedLeadIds);
  };

  const handleBulkArchive = () => {
    if (visibleSelectedLeadIds.length === 0) return;
    handleRequestArchive(visibleSelectedLeadIds);
  };

  const handleDropToStage = (targetStage: LeadStage) => {
    if (!draggingLeadId) return;
    const lead = leads.find((item) => item.id === draggingLeadId);
    if (!lead || lead.stage === targetStage) {
      setDraggingLeadId(null);
      setDragOverStage(null);
      return;
    }

    startTransition(async () => {
      const result = await moveCrmLeadStage(lead.id, targetStage);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
      } else {
        toast.success(`Moved to ${targetStage}`);
        router.refresh();
      }
      setDraggingLeadId(null);
      setDragOverStage(null);
      setDraggingType(null);
    });
  };

  const handleUpdate = (lead: CrmLeadItem, formData: FormData) => {
    startTransition(async () => {
      const result = await updateCrmLead(lead.id, formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      toast.success("Lead updated");
      setEditingLead(null);
      router.refresh();
    });
  };

  const exportCsv = () => {
    const header = ["Title", "Handled Person", "Email", "Phone", "Value", "Stage", "Updated At"];
    const rows = leads.map((lead) => [
      lead.title,
      lead.clientName || "",
      lead.email || "",
      lead.phone || "",
      lead.value ?? "",
      lead.stage,
      new Date(lead.updatedAt).toISOString(),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "crm-leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openMap = () => {
    const lead = leads[0];
    if (!lead || !lead.clientName) {
      toast.error("No handled person name available for map");
      return;
    }
    const queryValue = encodeURIComponent(lead.clientName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${queryValue}`, "_blank");
  };

  const handleViewModeChange = (nextView: "kanban" | "list") => {
    setViewMode(nextView);
    setSelectedLeadIds([]);
  };

  const handleConfirmAddStage = () => {
    const nextLabel = newStageLabel.trim();
    if (!nextLabel) {
      toast.error("Stage name is required");
      return;
    }
    startTransition(async () => {
      const result = await createCrmStage(nextLabel);
      if (result.error || !result.data) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      setVisibleStageKeys((current) => [...current, result.data.key]);
      setStageLabels((current) => ({ ...current, [result.data.key]: result.data.label }));
      setNewStageLabel("");
      setShowAddStageInput(false);
      toast.success(`${result.data.label} stage added`);
      router.refresh();
    });
  };

  const handleCancelAddStage = () => {
    setNewStageLabel("");
    setShowAddStageInput(false);
  };

  useEffect(() => {
    if (!showAddStageInput) return;
    const scroller = kanbanScrollRef.current;
    if (!scroller) return;

    // Move board to the far right so the new-stage panel area is visible.
    requestAnimationFrame(() => {
      scroller.scrollTo({
        left: scroller.scrollWidth,
        behavior: "smooth",
      });
    });
  }, [showAddStageInput]);

  const handleStartEditStage = (stageKey: LeadStage) => {
    setEditingStageKey(stageKey);
    setEditingStageLabel(stageLabels[stageKey]);
  };

  const handleSaveStageLabel = () => {
    if (!editingStageKey) return;
    const next = editingStageLabel.trim();
    if (!next) {
      toast.error("Stage name is required");
      return;
    }
    startTransition(async () => {
      const result = await updateCrmStage(editingStageKey, next);
      if (result.error || !result.data) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      setStageLabels((current) => ({ ...current, [editingStageKey]: result.data.label }));
      setEditingStageKey(null);
      setEditingStageLabel("");
      toast.success("Stage updated");
      router.refresh();
    });
  };

  const handleCancelEditStage = () => {
    setEditingStageKey(null);
    setEditingStageLabel("");
  };

  const handleToggleFoldStage = (stageKey: LeadStage) => {
    setFoldedStages((current) => ({ ...current, [stageKey]: !current[stageKey] }));
  };

  const renderStageSettingsMenu = (stageKey: LeadStage) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleToggleFoldStage(stageKey)}>
          {foldedStages[stageKey] ? "Unfold stage" : "Fold stage"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStartEditStage(stageKey)}>
          Edit stage
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => setStageDeleteConfirmKey(stageKey)}
        >
          Delete stage
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const handleDeleteStage = (stageKey: LeadStage) => {
    if (visibleStageKeys.length <= 1) {
      toast.error("At least one stage must remain");
      return;
    }
    startTransition(async () => {
      const result = await deleteCrmStage(stageKey);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      setVisibleStageKeys((current) => current.filter((key) => key !== stageKey));
      if (editingStageKey === stageKey) {
        setEditingStageKey(null);
        setEditingStageLabel("");
      }
      toast.success(`${stageLabels[stageKey] || stageKey} stage removed`);
      router.refresh();
    });
  };

  const handleConfirmDeleteStage = () => {
    if (!stageDeleteConfirmKey) return;
    handleDeleteStage(stageDeleteConfirmKey);
    setStageDeleteConfirmKey(null);
  };

  const handleStageDropReorder = (targetStageKey: LeadStage) => {
    if (!draggingStageKey || draggingStageKey === targetStageKey) return;
    const nextOrder = (() => {
      const current = [...visibleStageKeys];
      const fromIndex = current.indexOf(draggingStageKey);
      const toIndex = current.indexOf(targetStageKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, draggingStageKey);
      return current;
    })();

    setVisibleStageKeys(nextOrder);
    setDraggingStageKey(null);
    setDragOverStage(null);
    setDraggingType(null);

    startTransition(async () => {
      const result = await reorderCrmStages(nextOrder);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }
      router.refresh();
    });
  };

  const toggleActivityCard = (leadId: string) => {
    setActivityOpenLeadId((current) => (current === leadId ? null : leadId));
  };

  const handleClockButtonClick = (event: React.MouseEvent<HTMLButtonElement>, leadId: string) => {
    // Prevent draggable parent card from swallowing click interaction.
    event.preventDefault();
    event.stopPropagation();
    toggleActivityCard(leadId);
  };

  const handleScheduleActivityClick = (event: React.MouseEvent<HTMLButtonElement>, leadTitle: string) => {
    event.preventDefault();
    event.stopPropagation();
    toast.info(`Schedule activity for ${leadTitle}`);
  };

  const allLeadsSelected = filteredLeads.length > 0 && visibleSelectedLeadIds.length === filteredLeads.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="sticky top-0 z-20 grid shrink-0 gap-3 rounded-xl border bg-card p-3 lg:grid-cols-[auto_minmax(340px,1fr)_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Lead</DialogTitle>
                <DialogDescription>Add a new opportunity to your pipeline.</DialogDescription>
              </DialogHeader>
              <form action={handleCreate} className="space-y-4 rounded-lg border bg-white p-4">
                <div className="rounded-md border p-1.5">
                  <div className="relative rounded-sm border bg-white">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <Input
                      name="clientName"
                      placeholder="Client Handled Person"
                      disabled={isPending}
                      list="crm-client-names"
                      value={newClientName}
                      onChange={(event) => onClientNameChange(event.target.value)}
                      className="h-11 border-0 rounded-none pl-10 pr-10 shadow-none focus-visible:ring-0"
                    />
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    <datalist id="crm-client-names">
                      {clients.map((client) => (
                        <option key={client.id} value={client.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="relative border-b">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <Input
                    name="email"
                    type="email"
                    placeholder="Contact Email"
                    disabled={isPending}
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className="h-11 border-0 rounded-none pl-10 shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="relative border-b">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <Input
                    name="phone"
                    placeholder="Contact Phone"
                    disabled={isPending}
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                    className="h-11 border-0 rounded-none pl-10 shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b pb-3">
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <Input
                      name="value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newValue}
                      onChange={(event) => setNewValue(event.target.value)}
                      disabled={isPending}
                      className="h-10 rounded-md pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setNewProbabilityLevel(level as 1 | 2 | 3)}
                        className="rounded p-1"
                        title={level === 1 ? "Low probability" : level === 2 ? "Medium probability" : "High probability"}
                        aria-label={level === 1 ? "Low probability" : level === 2 ? "Medium probability" : "High probability"}
                      >
                        <Star
                          className={`h-6 w-6 ${
                            level <= newProbabilityLevel
                              ? "fill-amber-400 text-amber-500"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  Probability: {newProbabilityLevel === 1 ? "Low" : newProbabilityLevel === 2 ? "Medium" : "High"}
                </p>

                <Textarea
                  name="notes"
                  placeholder="Notes"
                  rows={3}
                  disabled={isPending}
                  value={newNotes}
                  onChange={(event) => setNewNotes(event.target.value)}
                  className="rounded-lg"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={isPending}>
                      Add
                    </Button>
                    <Button type="reset" variant="secondary" disabled={isPending}>
                      Edit
                    </Button>
                  </div>
                  <Button type="reset" variant="outline" size="icon" className="h-10 w-10" disabled={isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Generate Leads
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[860px] max-w-[95vw] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {GENERATE_LEAD_OPTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => toast.info(`${item.title} will be available soon`)}
                      className="flex items-start gap-3 rounded-md border bg-background p-3 text-left transition hover:bg-muted/70"
                    >
                      <div className="rounded-md border bg-card p-2">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="text-base font-semibold leading-tight text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Pipeline</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={() => router.push("/crm/archive")}>
                  Archive Page
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/crm/deleted")}>
                  Deleted Page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex justify-center lg:justify-self-center lg:w-full">
          {visibleSelectedLeadIds.length > 0 && viewMode === "list" ? (
            <div className="flex w-full max-w-[620px] items-center justify-between rounded-md border bg-background px-3 py-1.5">
              <span className="text-sm font-semibold text-foreground">{visibleSelectedLeadIds.length} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleBulkArchive}
                >
                  Archive
                </Button>
                <Button type="button" size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={handleBulkDelete} disabled={isPending}>
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-[620px]">
              <div className="flex h-9 w-full items-center gap-2 rounded-l-md border border-r-0 bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                {activeSearchChips.map((chip) => (
                  <span key={chip.id} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {chip.label}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (chip.id.startsWith("stage:")) {
                          const stageKey = chip.id.replace("stage:", "") as LeadStage;
                          setStageFilters((current) => current.filter((key) => key !== stageKey));
                        } else if (chip.id === "has_email") {
                          setRequireEmail(false);
                        } else if (chip.id === "has_phone") {
                          setRequirePhone(false);
                        } else if (chip.id === "high_probability") {
                          setHighProbabilityOnly(false);
                        } else if (chip.id === "no_value") {
                          setNoValueOnly(false);
                        } else if (chip.id === "group_by") {
                          setGroupByField("stage");
                        } else if (chip.id === "my_pipeline") {
                          setMyPipelineOnly(false);
                        } else if (chip.id === "unassigned") {
                          setUnassignedOnly(false);
                        } else if (chip.id === "open_opportunities") {
                          setOpenOpportunitiesOnly(false);
                        } else if (chip.id === "include_archived") {
                          setCustomIncludeArchived(false);
                        } else if (chip.id.startsWith("custom:")) {
                          const ruleId = chip.id.replace("custom:", "");
                          setCustomFilterRules((current) => current.filter((rule) => rule.id !== ruleId));
                        }
                      }}
                      aria-label={`Remove ${chip.label}`}
                    >
                      x
                    </button>
                  </span>
                ))}
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="h-full min-w-20 flex-1 border-0 bg-transparent text-sm outline-none"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 rounded-l-none border-l-0 bg-white px-3">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[75vh] w-[780px] max-w-[95vw] overflow-y-auto p-0">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="space-y-3 p-4 md:border-r">
                    <div className="flex items-center gap-2">
                      <Funnel className="h-4 w-4 text-[#7c4a69]" />
                      <p className="text-2xl font-semibold">Filters</p>
                    </div>
                    <button
                      type="button"
                      className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${myPipelineOnly ? "bg-slate-100 font-semibold" : ""}`}
                      onClick={() => {
                        setMyPipelineOnly((current) => {
                          const next = !current;
                          if (next) setUnassignedOnly(false);
                          return next;
                        });
                      }}
                    >
                      My Pipeline
                    </button>
                    <button
                      type="button"
                      className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${unassignedOnly ? "bg-slate-100 font-semibold" : ""}`}
                      onClick={() => {
                        setUnassignedOnly((current) => {
                          const next = !current;
                          if (next) setMyPipelineOnly(false);
                          return next;
                        });
                      }}
                    >
                      Unassigned
                    </button>
                    <button
                      type="button"
                      className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${openOpportunitiesOnly ? "bg-slate-100 font-semibold" : ""}`}
                      onClick={() => setOpenOpportunitiesOnly((current) => !current)}
                    >
                      Open Opportunities
                    </button>
                    <div className="border-t pt-2">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${
                          sortMode === "oldest" ? "bg-slate-100" : ""
                        }`}
                        onClick={() => setSortMode("oldest")}
                      >
                        <span>Creation Date</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${
                          sortMode === "recent" ? "bg-slate-100" : ""
                        }`}
                        onClick={() => setSortMode("recent")}
                      >
                        <span>Closed Date</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="border-t pt-2">
                      {visibleStages.map((stage) => (
                        <DropdownMenuCheckboxItem
                          key={stage.key}
                          checked={stageFilters.includes(stage.key)}
                          onSelect={(event) => event.preventDefault()}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setStageFilters((current) => (current.includes(stage.key) ? current : [...current, stage.key]));
                            } else {
                              setStageFilters((current) => current.filter((key) => key !== stage.key));
                            }
                          }}
                        >
                          {stage.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                    <div className="border-t pt-2">
                      <DropdownMenuItem onClick={openCustomFilterDialog}>Custom Filter...</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStageFilters([])}>Clear stage filters</DropdownMenuItem>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 md:border-r">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-teal-700" />
                      <p className="text-2xl font-semibold">Group By</p>
                    </div>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "salesperson" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("salesperson")}>Salesperson</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "sales_team" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("sales_team")}>Sales Team</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "stage" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("stage")}>Stage</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "city" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("city")}>City</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "country" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("country")}>Country</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "lost_reason" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("lost_reason")}>Lost Reason</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "campaign" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("campaign")}>Campaign</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "medium" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("medium")}>Medium</button>
                    <button type="button" className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "source" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setGroupByField("source")}>Source</button>
                    <div className="border-t pt-2">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${
                          groupByDate === "creation" ? "bg-slate-100 font-semibold" : ""
                        }`}
                        onClick={() => setGroupByDate("creation")}
                      >
                        <span>Creation Date</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${
                          groupByDate === "expected_closing" ? "bg-slate-100 font-semibold" : ""
                        }`}
                        onClick={() => setGroupByDate("expected_closing")}
                      >
                        <span>Expected Closing</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${
                          groupByDate === "closed_date" ? "bg-slate-100 font-semibold" : ""
                        }`}
                        onClick={() => setGroupByDate("closed_date")}
                      >
                        <span>Closed Date</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="border-t pt-2">
                      <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100" onClick={() => toast.info("Properties will be available soon")}>
                        <span>Properties</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="border-t pt-2">
                      <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100" onClick={() => toast.info("Custom group will be available soon")}>
                        <span>Custom Group</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                      <p className="text-2xl font-semibold">Favorites</p>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded border bg-slate-100 px-3 py-2 text-left hover:bg-slate-200"
                      onClick={() => toast.success("Current search saved as favorite")}
                    >
                      Save current search
                    </button>
                    <div className="border-t pt-2">
                      <DropdownMenuItem
                        onClick={() => {
                          setStageFilters([]);
                          setRequireEmail(false);
                          setRequirePhone(false);
                          setHighProbabilityOnly(false);
                          setNoValueOnly(false);
                          setMyPipelineOnly(false);
                          setUnassignedOnly(false);
                          setOpenOpportunitiesOnly(false);
                          setSortMode("recent");
                          setSearch("");
                          setCustomFilterRules([]);
                          setCustomFilterMode("any");
                          setCustomIncludeArchived(false);
                          setDraftCustomFilterRules([getDefaultCustomRule()]);
                          setDraftCustomFilterMode("any");
                          setDraftCustomIncludeArchived(false);
                        }}
                      >
                        Clear all search options
                      </DropdownMenuItem>
                    </div>
                  </div>
                </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </form>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
          <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-200">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none border-r border-slate-300"
              onClick={() => handleViewModeChange("kanban")}
              title="Kanban view"
              aria-label="Kanban view"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => handleViewModeChange("list")}
              title="List view"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-r border-slate-300"
              onClick={() => setSortMode((value) => (value === "recent" ? "oldest" : "recent"))}
              title="Toggle date order"
              aria-label="Toggle date order"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-r border-slate-300"
              onClick={exportCsv}
              title="Export leads"
              aria-label="Export leads"
            >
              <Table className="h-4 w-4" />
            </Button>
            <Button
              variant={showStats ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none border-r border-slate-300"
              onClick={() => setShowStats((value) => !value)}
              title="Toggle analytics"
              aria-label="Toggle analytics"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-r border-slate-300"
              onClick={openMap}
              title="Open map"
              aria-label="Open map"
            >
              <MapPin className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => router.refresh()}
              title="Refresh page"
              aria-label="Refresh page"
            >
              <TimerReset className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {showStats && (
        <div className="grid shrink-0 gap-3 md:grid-cols-4">
          {groupedBySelectedField.map((stage) => (
            <div key={stage.key} className="rounded border bg-white p-3">
              <p className="text-sm text-muted-foreground">{stage.label}</p>
              <p className="text-2xl font-semibold">{stage.items.length}</p>
            </div>
          ))}
        </div>
      )}

      {viewMode === "kanban" ? (
        <div ref={kanbanScrollRef} className="relative flex flex-1 items-stretch gap-4 overflow-auto pb-2">
          {groupedBySelectedField.map((stage) => (
            <div
              key={stage.key}
              className={`${isStageGrouping && foldedStages[stage.key] ? "w-[44px] min-w-[44px]" : "w-[250px] min-w-[250px]"} flex h-full shrink-0 self-start flex-col transition-all ${
                dragOverStage === stage.key
                  ? "bg-transparent"
                  : "bg-transparent"
              }`}
              onDragOver={(event) => {
                if (!isStageGrouping) return;
                event.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => {
                if (!isStageGrouping) return;
                setDragOverStage((current) => (current === stage.key ? null : current));
              }}
              onDrop={(event) => {
                if (!isStageGrouping) return;
                event.preventDefault();
                if (draggingType === "lead") {
                  handleDropToStage(stage.key);
                } else {
                  handleStageDropReorder(stage.key);
                }
              }}
            >
              <div
                className={`group sticky top-0 z-30 relative flex border-b border-slate-400 ${(stageThemeByKey[stage.key] ?? STAGE_THEMES[0]).header} ${
                  isStageGrouping ? "cursor-grab active:cursor-grabbing" : ""
                } ${
                  isStageGrouping && foldedStages[stage.key] ? "min-h-[220px] items-start justify-center p-1" : "items-start justify-between p-1.5"
                }`}
                draggable={isStageGrouping}
                onDragStart={(event) => {
                  if (!isStageGrouping) return;
                  event.dataTransfer.setData("text/plain", stage.key);
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingStageKey(stage.key);
                  setDraggingType("stage");
                }}
                onDragEnd={() => {
                  if (!isStageGrouping) return;
                  setDraggingStageKey(null);
                  setDragOverStage(null);
                  setDraggingType(null);
                }}
              >
                <div className={`${isStageGrouping ? "cursor-grab active:cursor-grabbing" : ""} ${isStageGrouping && foldedStages[stage.key] ? "text-center" : ""}`}>
                  {isStageGrouping && editingStageKey === stage.key ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingStageLabel}
                        onChange={(event) => setEditingStageLabel(event.target.value)}
                        className="h-8 w-36 bg-white"
                      />
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveStageLabel}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEditStage}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <h2 className={`${isStageGrouping && foldedStages[stage.key] ? "hidden" : "text-xl leading-tight"} font-semibold tracking-tight`}>
                      {stage.label}
                    </h2>
                  )}
                  <div className={`mt-1 ${isStageGrouping && foldedStages[stage.key] ? "hidden" : ""}`}>
                    <p className="text-sm text-muted-foreground">{stage.items.length}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${isStageGrouping && foldedStages[stage.key] ? "hidden" : ""}`}>
                  <p className="mr-2 text-base font-semibold text-slate-900">{shortCurrency.format(stage.expectedRevenueTotal)}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  {isStageGrouping ? renderStageSettingsMenu(stage.key) : null}
                </div>
                {isStageGrouping && foldedStages[stage.key] ? (
                  <div className="absolute left-1 top-1 flex flex-col items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-700 hover:bg-slate-200"
                      onClick={() => handleToggleFoldStage(stage.key)}
                    >
                      <ChevronsLeftRight className="h-4 w-4" />
                    </Button>
                    <span className="[writing-mode:vertical-rl] rotate-180 text-3xl font-medium leading-none text-slate-700">
                      {stage.label}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className={`flex-1 p-0 ${isStageGrouping && foldedStages[stage.key] ? "hidden" : ""}`}>
                {stage.items.length === 0 ? (
                  <div className="rounded border border-dashed p-3 text-center text-sm text-muted-foreground">
                    No opportunities
                  </div>
                ) : (
                  <div className="border border-slate-400 bg-white">
                    {stage.items.map((lead, index) => (
                    <div
                      key={lead.id}
                      data-lead-card="true"
                      className={`cursor-pointer bg-white p-1.5 transition hover:bg-slate-50 ${draggingLeadId === lead.id ? "opacity-60" : ""} ${
                        index < stage.items.length - 1 ? "border-b border-slate-300/90" : ""
                      }`}
                      onClick={() => openLeadDetails(lead.id)}
                      draggable={isStageGrouping}
                      onDragStart={(event) => {
                        if (!isStageGrouping) return;
                        event.dataTransfer.setData("text/plain", lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingLeadId(lead.id);
                        setDraggingType("lead");
                      }}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDragOverStage(null);
                        setDraggingType(null);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-base font-semibold leading-tight text-slate-900">
                            {lead.title || lead.clientName || "Opportunity"}
                          </p>
                        </div>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-slate-700"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleRequestDelete([lead.id])}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className="mt-0.5 text-sm font-semibold text-slate-800">
                        {lead.value != null ? currency.format(lead.value) : "-"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{lead.email || "-"}</p>
                      <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1">
                        <div className="relative flex items-center gap-1">
                          {[1, 2, 3].map((level) => (
                            <Star
                              key={level}
                              className={`h-3.5 w-3.5 ${
                                level <= (lead.probabilityLevel ?? 1) ? "fill-amber-400 text-amber-400" : "text-slate-300"
                              }`}
                            />
                          ))}
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => handleClockButtonClick(event, lead.id)}
                            className="ml-1 rounded p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            title="Schedule activity"
                            aria-label="Schedule activity"
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                          </button>
                          {activityOpenLeadId === lead.id && (
                            <div className="absolute left-6 top-full z-20 mt-2 w-[250px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                              <div className="bg-white px-3 py-4 text-center italic text-sm text-slate-500">
                                Schedule activities to help you get things done.
                              </div>
                              <button
                                type="button"
                                draggable={false}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => handleScheduleActivityClick(event, lead.title || "Opportunity")}
                                className="flex w-full items-center justify-center gap-2 border-t border-slate-300 bg-slate-100 px-3 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-200"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Schedule an activity</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => setSalespersonLead(lead)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md ${getLeadAvatarColorClass(
                            lead.createdByName || lead.createdByEmail || ""
                          )} text-[10px] font-semibold uppercase text-white transition hover:brightness-95`}
                          title={lead.createdByName || lead.createdByEmail || "Unknown"}
                        >
                          {(lead.createdByName || lead.createdByEmail || "U").trim().charAt(0)}
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isStageGrouping ? (
          <div className="sticky top-0 right-0 z-20 flex w-10 shrink-0 self-start items-start justify-center bg-white/95">
            {showAddStageInput ? (
              <div
                ref={addStagePanelRef}
                className="absolute left-full top-0 w-[250px] border border-slate-400 bg-slate-100 shadow-sm"
              >
                <div className="border-b border-slate-400 bg-slate-100 p-2.5">
                  <p className="text-lg font-semibold tracking-tight text-slate-900">New Stage</p>
                  <p className="mt-1 text-xs text-slate-500">Create a new pipeline stage</p>
                </div>
                <div className="space-y-2 p-2">
                  <Input
                    value={newStageLabel}
                    onChange={(event) => setNewStageLabel(event.target.value)}
                    placeholder="Stage name..."
                    className="h-9 bg-white"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={handleConfirmAddStage} className="h-8 px-3">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={handleCancelAddStage} className="h-8 px-3">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddStageInput(true)}
                className="group flex h-full min-h-[200px] w-10 flex-col items-center justify-start gap-2 rounded-none px-0 pt-1 text-slate-800 hover:bg-slate-100"
              >
                <ChevronsRight className="h-4 w-4" />
                <span className="[writing-mode:vertical-rl] rotate-180 text-base leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                  Add Stage
                </span>
              </Button>
            )}
          </div>
          ) : null}
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-100 text-left">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allLeadsSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedLeadIds(filteredLeads.map((lead) => lead.id));
                      } else {
                        setSelectedLeadIds([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Client Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Activities</th>
                <th className="px-4 py-3 font-semibold">Handled Person</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No leads found
                  </td>
                </tr>
              ) : (
                orderedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b hover:bg-slate-50"
                    onClick={() => openLeadDetails(lead.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={visibleSelectedLeadIds.includes(lead.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedLeadIds((current) => [...current, lead.id]);
                          } else {
                            setSelectedLeadIds((current) => current.filter((id) => id !== lead.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{lead.clientName || lead.title || "-"}</td>
                    <td className="px-4 py-3">{lead.email || "-"}</td>
                    <td className="px-4 py-3">{lead.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock3 className="h-4 w-4" />
                        <span>0</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {lead.createdByName || lead.createdByEmail || "-"}
                    </td>
                    <td className="px-4 py-3">{stageLabels[lead.stage] || lead.stage}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleRequestDelete([lead.id])}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCustomFilterDialog} onOpenChange={(open) => !open && handleDiscardCustomFilter()}>
        <DialogContent className="max-w-6xl p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Custom Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>Match</span>
                <select
                  value={draftCustomFilterMode}
                  onChange={(event) => setDraftCustomFilterMode(event.target.value as "any" | "all")}
                  className="h-8 rounded border border-slate-300 bg-white px-2"
                >
                  <option value="any">any</option>
                  <option value="all">all</option>
                </select>
                <span>of the following rules:</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draftCustomIncludeArchived}
                  onChange={(event) => setDraftCustomIncludeArchived(event.target.checked)}
                />
                Include archived
              </label>
            </div>

            <div className="space-y-2">
              {draftCustomFilterRules.map((rule) => {
                const isNumericField = rule.field === "value" || rule.field === "probability";
                return (
                  <div key={rule.id} className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_3fr_auto]">
                    <select
                      value={rule.field}
                      onChange={(event) =>
                        updateDraftCustomRule(rule.id, {
                          field: event.target.value as CustomFilterField,
                          value: "",
                          operator: "contains",
                        })
                      }
                      className="h-10 rounded border border-slate-300 bg-white px-2"
                    >
                      {CUSTOM_FILTER_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>
                    <Input
                      value={rule.value}
                      onChange={(event) => updateDraftCustomRule(rule.id, { value: event.target.value })}
                      type={isNumericField ? "number" : "text"}
                      placeholder="Type to filter..."
                    />
                    <Button type="button" variant="ghost" className="h-10 px-2" onClick={() => removeDraftCustomRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="text-sm font-medium text-teal-700 hover:underline"
              onClick={() => setDraftCustomFilterRules((current) => [...current, getDefaultCustomRule()])}
            >
              New Rule
            </button>
          </div>
          <div className="flex items-center gap-2 border-t px-6 py-4">
            <Button type="button" className="bg-[#7c4a69] hover:bg-[#6d425d]" onClick={handleApplyCustomFilter}>
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={handleDiscardCustomFilter}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <form action={(formData) => handleUpdate(editingLead, formData)} className="space-y-3">
              <Input name="title" defaultValue={editingLead.title} required />
              <Input name="clientName" defaultValue={editingLead.clientName || ""} />
              <Input name="email" type="email" defaultValue={editingLead.email || ""} />
              <Input name="phone" defaultValue={editingLead.phone || ""} />
              <Input name="value" type="number" min="0" step="0.01" defaultValue={editingLead.value || ""} />
              <select
                name="probabilityLevel"
                defaultValue={String(editingLead.probabilityLevel ?? 1)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="1">Low (1 star)</option>
                <option value="2">Medium (2 stars)</option>
                <option value="3">High (3 stars)</option>
              </select>
              <select
                name="stage"
                defaultValue={editingLead.stage}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {visibleStages.map((stage) => (
                  <option key={stage.key} value={stage.key}>{stageLabels[stage.key] || stage.key}</option>
                ))}
              </select>
              <Textarea name="notes" rows={3} defaultValue={editingLead.notes || ""} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingLead(null)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!salespersonLead} onOpenChange={(open) => !open && setSalespersonLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salesperson Details</DialogTitle>
            <DialogDescription>Assigned salesperson information for this opportunity.</DialogDescription>
          </DialogHeader>
          {salespersonLead && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Opportunity</p>
                <p className="font-medium text-slate-900">{salespersonLead.title || "Opportunity"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Salesperson</p>
                  <p className="font-medium text-slate-900">
                    {salespersonLead.createdByName || salespersonLead.createdByEmail || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="font-medium text-slate-900">{salespersonLead.createdByRole || "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{salespersonLead.createdByEmail || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmState} onOpenChange={(open) => !open && setDeleteConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirmState?.title || "Delete lead?"}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{deleteConfirmState?.detail || "This action cannot be undone."}</span>
              <span className="mt-1 block">Please confirm to delete the selected lead details.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archiveConfirmState} onOpenChange={(open) => !open && setArchiveConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveConfirmState?.title || "Archive lead?"}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{archiveConfirmState?.detail || "This action will move the selected lead details to the archive page."}</span>
              <span className="mt-1 block">Please confirm to continue with archive.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmArchive();
              }}
              disabled={isPending}
            >
              {isPending ? "Archiving..." : "Confirm Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!stageDeleteConfirmKey} onOpenChange={(open) => !open && setStageDeleteConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                This action will delete stage &quot;{stageDeleteConfirmKey ? stageLabels[stageDeleteConfirmKey] || stageDeleteConfirmKey : ""}&quot; and move its leads.
              </span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDeleteStage();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
