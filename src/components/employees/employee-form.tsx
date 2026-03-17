"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee } from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import {
  ACTION_PERMISSION_OPTIONS,
  FIELD_LEVEL_PERMISSION_OPTIONS,
  MODULE_ACCESS_OPTIONS,
  RECORD_RULE_OPTIONS,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";

const DEFAULT_DEPARTMENTS = [
  "Administration",
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "Human Resources",
  "Operations",
  "Support",
];
const DEFAULT_POSITIONS_BY_DEPARTMENT: Record<string, string[]> = {
  Administration: ["Office Administrator", "Executive Assistant", "Receptionist"],
  Engineering: ["Software Engineer", "Senior Software Engineer", "Tech Lead", "QA Engineer"],
  Design: ["UI Designer", "UX Designer", "Product Designer", "Graphic Designer"],
  Sales: ["Sales Executive", "Account Manager", "Sales Manager"],
  Marketing: ["Marketing Executive", "SEO Specialist", "Content Strategist"],
  Finance: ["Accountant", "Financial Analyst", "Finance Manager"],
  "Human Resources": ["HR Executive", "Talent Acquisition Specialist", "HR Manager"],
  Operations: ["Operations Executive", "Operations Manager", "Project Coordinator"],
  Support: ["Support Executive", "Customer Success Associate", "Support Lead"],
};
const NONE_OPTION = "__none__";
const ADD_DEPARTMENT_OPTION = "__add_department__";
const ADD_POSITION_OPTION = "__add_position__";

interface EmployeeFormProps {
  employee?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    department: string | null;
    position: string | null;
    phone: string | null;
    hireDate: Date | null;
    isActive: boolean;
    permissions?: unknown;
  };
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!employee;
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(() => {
    const current = employee?.department?.trim();
    if (!current) return DEFAULT_DEPARTMENTS;
    const exists = DEFAULT_DEPARTMENTS.some(
      (department) => department.toLowerCase() === current.toLowerCase()
    );
    return exists ? DEFAULT_DEPARTMENTS : [current, ...DEFAULT_DEPARTMENTS];
  });
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");
  const [positionOptionsByDepartment, setPositionOptionsByDepartment] = useState<
    Record<string, string[]>
  >(() => {
    if (!employee?.department || !employee?.position) return DEFAULT_POSITIONS_BY_DEPARTMENT;
    const currentPositions = DEFAULT_POSITIONS_BY_DEPARTMENT[employee.department] ?? [];
    const exists = currentPositions.some(
      (position) => position.toLowerCase() === employee.position!.toLowerCase()
    );
    if (exists) return DEFAULT_POSITIONS_BY_DEPARTMENT;

    return {
      ...DEFAULT_POSITIONS_BY_DEPARTMENT,
      [employee.department]: [...currentPositions, employee.position],
    };
  });
  const [position, setPosition] = useState(employee?.position ?? "");
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPosition, setNewPosition] = useState("");
  const [permissions, setPermissions] = useState(() =>
    normalizeEmployeePermissions(employee?.permissions)
  );

  const positionOptions = department ? positionOptionsByDepartment[department] ?? [] : [];

  async function handleSubmit(formData: FormData) {
    if (!isEditing) {
      const selectedDepartment = String(formData.get("department") ?? "").trim();
      const selectedPosition = String(formData.get("position") ?? "").trim();

      if (!selectedDepartment) {
        toast.error("Department is required");
        return;
      }

      if (!selectedPosition) {
        toast.error("Position is required");
        return;
      }
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateEmployee(employee.id, formData)
        : await createEmployee(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success(isEditing ? "Employee updated successfully" : "Employee created successfully");
        router.push("/employees");
      }
    });
  }

  function togglePermission(
    key: "moduleAccess" | "recordRules" | "actionPermissions" | "fieldLevelPermissions",
    value: string,
    checked: boolean
  ) {
    setPermissions((current) => {
      const selected = new Set(current[key]);
      if (checked) {
        selected.add(value as never);
      } else {
        selected.delete(value as never);
      }
      return {
        ...current,
        [key]: Array.from(selected),
      };
    });
  }

  const permissionLabels: Record<string, string> = {
    CRM: "CRM",
    PROJECT: "Project",
    SALES: "Sales",
    OWN_RECORD: "Own Record",
    TEAM_RECORD: "Team Record",
    ASSIGN_PROJECT: "Assign Project",
    RECORD_RULES: "All Records",
    CREATE: "Create",
    EDIT: "Edit",
    DELETE: "Delete",
    UPDATE: "Update",
    BUDGET: "Budget",
    PROFIT: "Profit",
    DISCOUNT: "Discount",
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
        <CardTitle className="text-xl">{isEditing ? "Edit Employee" : "Create Employee"}</CardTitle>
        <CardDescription>
          Fill in account details and set role-based access permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form action={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={employee?.name}
                required
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={employee?.email}
                required
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="password">
                {isEditing ? "Password (leave blank to keep current)" : "Password *"}
              </Label>
              <PasswordInput
                id="password"
                name="password"
                required={!isEditing}
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="role">Role *</Label>
              <Select name="role" defaultValue={employee?.role || "EMPLOYEE"}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {isEditing && employee?.role === "ADMIN" && (
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  )}
                  <SelectItem value="BA">BA</SelectItem>
                  <SelectItem value="TEAMLEADER">Team Leader</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="department">Department {!isEditing ? "*" : ""}</Label>
              <input type="hidden" name="department" value={department} />
              <Select
                value={department || NONE_OPTION}
                onValueChange={(value) => {
                  if (value === ADD_DEPARTMENT_OPTION) {
                    setShowAddDepartment(true);
                    return;
                  }
                  const nextDepartment = value === NONE_OPTION ? "" : value;
                  setDepartment(nextDepartment);
                  setShowAddDepartment(false);
                  setShowAddPosition(false);
                  setNewPosition("");
                  if (!nextDepartment) {
                    setPosition("");
                    return;
                  }
                  const nextOptions = positionOptionsByDepartment[nextDepartment] ?? [];
                  if (!nextOptions.some((option) => option.toLowerCase() === position.toLowerCase())) {
                    setPosition("");
                  }
                }}
              >
                <SelectTrigger id="department" disabled={isPending} className="bg-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>None</SelectItem>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_DEPARTMENT_OPTION}>+ Add department</SelectItem>
                </SelectContent>
              </Select>
              {showAddDepartment && (
                <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <Input
                    value={newDepartment}
                    onChange={(event) => setNewDepartment(event.target.value)}
                    placeholder="Type new department"
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      const trimmed = newDepartment.trim();
                      if (!trimmed) {
                        toast.error("Department name is required");
                        return;
                      }

                      const existing = departmentOptions.find(
                        (option) => option.toLowerCase() === trimmed.toLowerCase()
                      );
                      if (existing) {
                        setDepartment(existing);
                        setShowAddDepartment(false);
                        setNewDepartment("");
                        return;
                      }

                      setDepartmentOptions((current) => [...current, trimmed]);
                      setPositionOptionsByDepartment((current) => ({
                        ...current,
                        [trimmed]: current[trimmed] ?? [],
                      }));
                      setDepartment(trimmed);
                      setPosition("");
                      setShowAddDepartment(false);
                      setNewDepartment("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="position">Position {!isEditing ? "*" : ""}</Label>
              <input type="hidden" name="position" value={position} />
              <Select
                value={position || NONE_OPTION}
                onValueChange={(value) => {
                  if (value === ADD_POSITION_OPTION) {
                    if (!department) {
                      toast.error("Select a department first");
                      return;
                    }
                    setShowAddPosition(true);
                    return;
                  }
                  setPosition(value === NONE_OPTION ? "" : value);
                  setShowAddPosition(false);
                }}
              >
                <SelectTrigger id="position" disabled={isPending} className="bg-white">
                  <SelectValue
                    placeholder={
                      department ? "Select position" : "Select department first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>None</SelectItem>
                  {positionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_POSITION_OPTION}>+ Add position</SelectItem>
                </SelectContent>
              </Select>
              {showAddPosition && (
                <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <Input
                    value={newPosition}
                    onChange={(event) => setNewPosition(event.target.value)}
                    placeholder="Type new position"
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      if (!department) {
                        toast.error("Select a department first");
                        return;
                      }

                      const trimmed = newPosition.trim();
                      if (!trimmed) {
                        toast.error("Position name is required");
                        return;
                      }

                      const existing = (positionOptionsByDepartment[department] ?? []).find(
                        (option) => option.toLowerCase() === trimmed.toLowerCase()
                      );

                      if (existing) {
                        setPosition(existing);
                        setShowAddPosition(false);
                        setNewPosition("");
                        return;
                      }

                      setPositionOptionsByDepartment((current) => ({
                        ...current,
                        [department]: [...(current[department] ?? []), trimmed],
                      }));
                      setPosition(trimmed);
                      setShowAddPosition(false);
                      setNewPosition("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={employee?.phone || ""}
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={employee?.hireDate ? new Date(employee.hireDate).toISOString().split("T")[0] : ""}
                disabled={isPending}
                className="bg-white"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Permission to Access</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Module Access</p>
                {MODULE_ACCESS_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="moduleAccess"
                      value={option}
                      checked={permissions.moduleAccess.includes(option)}
                      onChange={(event) =>
                        togglePermission("moduleAccess", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Record Rules</p>
                {RECORD_RULE_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="recordRules"
                      value={option}
                      checked={permissions.recordRules.includes(option)}
                      onChange={(event) =>
                        togglePermission("recordRules", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Action Permissions</p>
                {ACTION_PERMISSION_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="actionPermissions"
                      value={option}
                      checked={permissions.actionPermissions.includes(option)}
                      onChange={(event) =>
                        togglePermission("actionPermissions", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Field Level Permission</p>
                {FIELD_LEVEL_PERMISSION_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="fieldLevelPermissions"
                      value={option}
                      checked={permissions.fieldLevelPermissions.includes(option)}
                      onChange={(event) =>
                        togglePermission("fieldLevelPermissions", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <input type="hidden" name="isActive" value={employee.isActive.toString()} />
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
              className="min-w-28"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-36">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Employee" : "Create Employee"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
