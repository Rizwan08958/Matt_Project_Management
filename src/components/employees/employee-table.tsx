"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { deleteEmployee, toggleEmployeeStatus } from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BriefcaseBusiness, Mail, MoreHorizontal, Pencil, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  position: string | null;
  permissions?: unknown;
  isActive: boolean;
  createdAt: Date;
  _count: {
    assignments: number;
    timeEntries: number;
  };
}

interface EmployeeTableProps {
  employees: Employee[];
}

type RoleFilter = "ALL" | Role;

const roleColors: Record<Role, string> = {
  ADMIN: "bg-purple-500",
  BA: "bg-cyan-500",
  TEAMLEADER: "bg-blue-500",
  EMPLOYEE: "bg-gray-500",
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  BA: "BA",
  TEAMLEADER: "TL",
  EMPLOYEE: "Employee",
};

const moduleLabels: Record<string, string> = {
  PROJECT: "Projects",
  CRM: "CRM",
  SALES: "Sales",
};

function getModuleAccessBadges(value: unknown) {
  const permissions = normalizeEmployeePermissions(value);
  return permissions.moduleAccess.map((module) => moduleLabels[module] ?? module);
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      ALL: 0,
      ADMIN: 0,
      BA: 0,
      TEAMLEADER: 0,
      EMPLOYEE: 0,
    };

    for (const employee of employees) {
      counts.ALL += 1;
      counts[employee.role] += 1;
    }

    return counts;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const nameMatches = !query || employee.name.toLowerCase().includes(query);
      const roleMatches = roleFilter === "ALL" || employee.role === roleFilter;
      return nameMatches && roleMatches;
    });
  }, [employees, searchTerm, roleFilter]);

  const filteredEmployeesWithSummary = useMemo(
    () =>
      filteredEmployees.map((employee) => ({
        ...employee,
        moduleBadges: getModuleAccessBadges(employee.permissions),
      })),
    [filteredEmployees]
  );

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteEmployee(deleteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Employee deleted successfully");
      }
      setDeleteId(null);
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const result = await toggleEmployeeStatus(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Employee ${result.data?.isActive ? "activated" : "deactivated"} successfully`);
      }
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-2xl">
              <div className="flex w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-slate-400">
                <div className="relative flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search employee name"
                  className="h-11 rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                />
                </div>

                <div className="w-px bg-slate-200" />

                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                  <SelectTrigger className="h-11 w-[170px] rounded-none border-0 bg-slate-50 px-4 shadow-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="Filter role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All ({roleCounts.ALL})</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee ({roleCounts.EMPLOYEE})</SelectItem>
                    <SelectItem value="TEAMLEADER">TL ({roleCounts.TEAMLEADER})</SelectItem>
                    <SelectItem value="BA">BA ({roleCounts.BA})</SelectItem>
                    <SelectItem value="ADMIN">Admin ({roleCounts.ADMIN})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button asChild className="md:min-w-[150px]">
              <Link href="/employees/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {filteredEmployees.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No employees found</p>
        ) : (
          <div className="space-y-3">
            {filteredEmployeesWithSummary.map((employee) => (
              <div
                key={employee.id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-slate-300 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-700">
                      {employee.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="block truncate text-lg font-semibold tracking-tight text-slate-900 hover:text-slate-700"
                        >
                          {employee.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{employee.email}</span>
                          </span>
                          {employee.position ? (
                            <span className="inline-flex items-center gap-2">
                              <BriefcaseBusiness className="h-3.5 w-3.5 text-slate-400" />
                              {employee.position}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${roleColors[employee.role]} px-2.5 py-0.5 text-xs font-medium`}>
                          {roleLabels[employee.role]}
                        </Badge>
                        <Badge variant="outline" className="border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700">
                          {employee.department || "No department"}
                        </Badge>
                        <Badge
                          variant={employee.isActive ? "default" : "secondary"}
                          className="px-2.5 py-0.5 text-xs"
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] lg:items-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      Projects
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{employee._count.assignments}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      Time Entries
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{employee._count.timeEntries}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      Module Access
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {employee.moduleBadges.length === 0 ? (
                        <span className="text-sm text-slate-500">No modules assigned</span>
                      ) : (
                        employee.moduleBadges.map((module) => (
                          <Badge
                            key={`${employee.id}-${module}`}
                            variant="secondary"
                            className="bg-white px-2.5 py-0.5 text-xs text-slate-700"
                          >
                            {module}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        className="rounded-xl border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/employees/${employee.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(employee.id)}>
                        {employee.isActive ? (
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
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteId(employee.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the employee and all related data.</span>
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
    </div>
  );
}
