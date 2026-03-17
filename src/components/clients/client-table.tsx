"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  List,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  TableProperties,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";
import { deleteClient, toggleClientStatus, type ClientListItem } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
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

interface ClientTableProps {
  clients: ClientListItem[];
  page: number;
  pages: number;
  query: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function ClientTable({
  clients,
  page,
  pages,
  query,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: ClientTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState(query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const displayedClients = useMemo(
    () => (activeOnly ? clients.filter((client) => client.isActive) : clients),
    [clients, activeOnly]
  );

  const allSelected = useMemo(
    () => displayedClients.length > 0 && selectedIds.length === displayedClients.length,
    [displayedClients.length, selectedIds.length]
  );

  const updateParams = (nextQuery: string, nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(url);
  };

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

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams(search.trim(), 1);
  };

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteClient(deleteId);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
      } else {
        toast.success("Client deleted successfully");
        router.refresh();
      }
      setDeleteId(null);
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const result = await toggleClientStatus(id);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
      } else {
        const isActive = "data" in result ? result.data?.isActive : undefined;
        toast.success(`Client ${isActive ? "activated" : "deactivated"} successfully`);
        router.refresh();
      }
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(displayedClients.map((item) => item.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleOpenMap = () => {
    const selected = displayedClients.find((item) => selectedIds.includes(item.id)) || displayedClients[0];
    if (!selected) {
      toast.error("No contact available to open map");
      return;
    }

    const place = encodeURIComponent(selected.country || selected.name);
    window.open(`https://www.google.com/maps/search/?api=1&query=${place}`, "_blank");
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {canCreate && (
                <Button asChild className="bg-[#7c4a69] hover:bg-[#6d425d]">
                  <Link href="/clients/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New
                  </Link>
                </Button>
              )}
              <div className="text-xl font-semibold text-slate-800">Contacts</div>
            </div>
            <form onSubmit={onSearchSubmit} className="flex w-full max-w-xl min-w-0">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="h-10 rounded-r-none border-slate-300 pl-9 focus-visible:ring-[#31a6c2]"
                />
              </div>
              <Button type="submit" variant="outline" className="h-10 rounded-l-none border-l-0">
                Search
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 text-sm text-slate-600">
                {pages === 0 ? "0-0 / 0" : `${page}-${pages} / ${pages}`}
              </div>
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1 || isPending}
                onClick={() => updateParams(query, page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= pages || isPending}
                onClick={() => updateParams(query, page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={viewMode === "list" ? "bg-sky-50" : ""}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={viewMode === "table" ? "bg-sky-50" : ""}
                onClick={() => setViewMode("table")}
              >
                <TableProperties className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleOpenMap}>
                <MapPin className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={activeOnly ? "bg-sky-50" : ""}
                onClick={() => setActiveOnly((value) => !value)}
                title="Toggle active contacts"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 2xl:grid-cols-3">
            {displayedClients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500 lg:col-span-2 2xl:col-span-3">
                No contacts found.
              </div>
            ) : (
              displayedClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="block truncate text-base font-semibold text-slate-900 hover:underline">
                        {client.name}
                      </Link>
                      <p className="truncate text-sm text-slate-500">{client.email || "No email"}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(client.id)}
                      onChange={() => toggleSelectOne(client.id)}
                      className="mt-1 shrink-0"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Phone</p>
                      <p className="mt-1 text-slate-700">{client.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Country</p>
                      <p className="mt-1 text-slate-700">{client.country || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Activities</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-slate-700">
                        <Clock3 className="h-4 w-4" />
                        {client.activityCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
                      <p className="mt-1 text-slate-700">{client.isActive ? "Active" : "Inactive"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => toggleSelectOne(client.id)}>
                      {selectedIds.includes(client.id) ? "Selected" : "Select"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}`}>View</Link>
                        </DropdownMenuItem>
                        {canUpdate && (
                          <DropdownMenuItem asChild>
                            <Link href={`/clients/${client.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => handleToggleStatus(client.id)}>
                            {client.isActive ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteId(client.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 font-semibold">Student Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Activities</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                displayedClients.map((client) => (
                  <tr
                    key={client.id}
                    className={`border-b hover:bg-slate-50/70 ${viewMode === "table" ? "h-16" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(client.id)}
                        onChange={() => toggleSelectOne(client.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{client.email}</td>
                    <td className="px-4 py-3">{client.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1 text-slate-600">
                        <Clock3 className="h-4 w-4" />
                        <span>{client.activityCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{client.country || "-"}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPending}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/clients/${client.id}`}>View</Link>
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => handleToggleStatus(client.id)}>
                              {client.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteId(client.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
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
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the selected contact details.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
