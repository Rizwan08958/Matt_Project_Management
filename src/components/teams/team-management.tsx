"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { Search, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions?: unknown;
}

interface TeamData {
  id: string;
  name: string;
  baId: string;
  leadId?: string;
  memberIds: string[];
  createdAt: string;
}

interface TeamManagementProps {
  employees: EmployeeOption[];
}

const STORAGE_KEY = "team-management-data-v1";

export function TeamManagement({ employees }: TeamManagementProps) {
  const [teamName, setTeamName] = useState("");
  const [baId, setBaId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{
    teamId: string;
    memberId: string;
    memberName: string;
  } | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamsHydrated, setTeamsHydrated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setTeamsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as TeamData[];
      if (Array.isArray(parsed)) {
        setTeams(parsed);
      }
    } catch {
      setTeams([]);
    } finally {
      setTeamsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!teamsHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  }, [teams, teamsHydrated]);

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const eligibleBas = useMemo(
    () =>
      employees
        .filter((employee) => employee.role === "BA")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const selectedBaModuleAccess = useMemo(() => {
    if (!baId) return new Set<string>();
    const selectedBa = employees.find((employee) => employee.id === baId);
    if (!selectedBa) return new Set<string>();
    const permissions = normalizeEmployeePermissions(selectedBa.permissions);
    return new Set(permissions.moduleAccess);
  }, [baId, employees]);

  const isModuleAccessCompatible = useCallback(
    (employee: EmployeeOption) => {
      // BA must be selected first before showing/selecting TL/Employee options.
      if (!baId) return false;

      const employeePermissions = normalizeEmployeePermissions(employee.permissions);
      if (employeePermissions.moduleAccess.length === 0) return true;

      return employeePermissions.moduleAccess.every((module) =>
        selectedBaModuleAccess.has(module)
      );
    },
    [baId, selectedBaModuleAccess]
  );

  const selectableTeamPeople = useMemo(
    () =>
      employees
        .filter(
          (employee) =>
            employee.role === "TEAMLEADER" || employee.role === "EMPLOYEE"
        )
        .filter((employee) => {
          if (!isModuleAccessCompatible(employee)) return false;

          if (employee.role === "TEAMLEADER") {
            if (leadId === employee.id) return true;
            return !teams.some((team) => team.leadId === employee.id);
          }

          if (memberIds.includes(employee.id)) return true;
          return !teams.some((team) => team.memberIds.includes(employee.id));
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, isModuleAccessCompatible, leadId, memberIds, teams]
  );

  useEffect(() => {
    if (!baId) {
      if (leadId) setLeadId("");
      if (memberIds.length > 0) setMemberIds([]);
      return;
    }

    const nextLead =
      leadId ? employeeMap.get(leadId) : undefined;
    const nextLeadId =
      nextLead && isModuleAccessCompatible(nextLead)
        ? leadId
        : "";
    const nextMemberIds = memberIds.filter((id) => {
      const member = employeeMap.get(id);
      return member ? isModuleAccessCompatible(member) : false;
    });

    if (leadId !== nextLeadId) {
      setLeadId(nextLeadId);
    }
    if (
      nextMemberIds.length !== memberIds.length ||
      nextMemberIds.some((id, index) => id !== memberIds[index])
    ) {
      setMemberIds(nextMemberIds);
    }
  }, [baId, employeeMap, isModuleAccessCompatible, leadId, memberIds]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return selectableTeamPeople;
    return selectableTeamPeople.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query)
    );
  }, [memberSearch, selectableTeamPeople]);

  const selectedMembers = useMemo(
    () => memberIds.map((id) => employeeMap.get(id)).filter(Boolean),
    [employeeMap, memberIds]
  );
  const selectedLead = leadId ? employeeMap.get(leadId) : null;

  const toggleMember = (employeeId: string, checked: boolean) => {
    setMemberIds((current) =>
      checked ? [...current, employeeId] : current.filter((id) => id !== employeeId)
    );
  };

  const toggleTeamPerson = (employee: EmployeeOption, checked: boolean) => {
    if (employee.role === "TEAMLEADER") {
      if (checked && leadId && leadId !== employee.id) {
        toast.info("Only one team leader is allowed per team. Team leader updated.");
      }
      setLeadId(checked ? employee.id : "");
      return;
    }
    toggleMember(employee.id, checked);
  };

  const createTeam = () => {
    const trimmedName = teamName.trim();
    const selectedTlCount =
      (leadId ? 1 : 0) +
      memberIds.filter((id) => employeeMap.get(id)?.role === "TEAMLEADER").length;

    if (!trimmedName) {
      toast.error("Team name is required");
      return;
    }
    if (!baId) {
      toast.error("BA manager is required");
      return;
    }
    if (selectedTlCount !== 1) {
      toast.error("Select exactly 1 team leader");
      return;
    }
    if (memberIds.length < 1) {
      toast.error("Select at least 1 employee");
      return;
    }
    const exists = teams.some((team) => team.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      toast.error("Team name already exists");
      return;
    }

    const nextTeam: TeamData = {
      id: crypto.randomUUID(),
      name: trimmedName,
      baId,
      leadId,
      memberIds,
      createdAt: new Date().toISOString(),
    };

    setTeams((current) => [nextTeam, ...current]);
    setTeamName("");
    setBaId("");
    setLeadId("");
    setMemberIds([]);
    setMemberSearch("");
    toast.success("Team created");
  };

  const deleteTeam = (id: string) => {
    setTeams((current) => current.filter((team) => team.id !== id));
    toast.success("Team deleted");
  };

  const changeTeamBa = (teamId: string, nextBaId: string) => {
    setTeams((current) =>
      current.map((team) => (team.id === teamId ? { ...team, baId: nextBaId } : team))
    );
    toast.success("BA updated");
  };

  const removeEmployeeFromTeam = (teamId: string, memberId: string) => {
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId
          ? { ...team, memberIds: team.memberIds.filter((id) => id !== memberId) }
          : team
      )
    );
    toast.success("Employee removed from team");
  };

  const confirmRemoveEmployee = () => {
    if (!removeTarget) return;
    removeEmployeeFromTeam(removeTarget.teamId, removeTarget.memberId);
    setRemoveTarget(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="e.g. Product Engineering"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamBa">Select BA</Label>
              <Select value={baId} onValueChange={setBaId}>
                <SelectTrigger id="teamBa">
                  <SelectValue placeholder="Select BA manager" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleBas.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Team People (Team Leader + Employees)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by name or email"
                  className="pl-9 text-sm"
                  disabled={!baId}
                />
              </div>
              <div className="rounded-md border p-3">
                {!baId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a BA to view matching Team Leaders and Employees.
                  </p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No people match the search</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {filteredMembers.map((employee) => {
                      const isChecked =
                        employee.role === "TEAMLEADER"
                          ? leadId === employee.id
                          : memberIds.includes(employee.id);
                      return (
                        <Label
                          key={employee.id}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                toggleTeamPerson(employee, checked === true)
                              }
                            />
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-base font-semibold">
                              {employee.name.charAt(0).toLowerCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-tight">{employee.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          >
                            {employee.role}
                          </Badge>
                        </Label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Selected In Team</Label>
                <span className="text-xs text-muted-foreground">
                  TL: {selectedLead ? 1 : 0} | EMP: {selectedMembers.length}
                </span>
              </div>
              <div className="min-h-16 rounded-md border p-2">
                <div className="flex flex-wrap gap-2">
                  {selectedLead ? (
                    <Badge variant="default">{selectedLead.name} (TEAMLEADER)</Badge>
                  ) : (
                    <Badge variant="outline">No team leader selected</Badge>
                  )}
                  {selectedMembers.length === 0 ? (
                    <Badge variant="outline">No employees selected</Badge>
                  ) : (
                    selectedMembers.map((member) => (
                      <Badge key={member!.id} variant="secondary">
                        {member!.name} (EMPLOYEE)
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Flow: Select BA first, then choose one Team Leader and one or more Employees, then create team.
            </div>

            <Button type="button" onClick={createTeam}>
              <UsersRound className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams created yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => {
                const ba = employeeMap.get(team.baId);
                const lead = team.leadId ? employeeMap.get(team.leadId) : null;
                const members = team.memberIds
                  .map((id) => employeeMap.get(id))
                  .filter((person): person is EmployeeOption => Boolean(person));
                const teamPeople = [
                  ...(lead ? [lead] : []),
                  ...members,
                ];
                return (
                  <div key={team.id} className="rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl font-semibold">
                          {team.name.charAt(0).toLowerCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold">{team.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            BA: {ba?.name ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                          {teamPeople.length} MEMBERS
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteTeamTarget({ teamId: team.id, teamName: team.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Change BA</Label>
                        <Select value={team.baId} onValueChange={(value) => changeTeamBa(team.id, value)}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select BA manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleBas.map((baOption) => (
                              <SelectItem key={baOption.id} value={baOption.id}>
                                {baOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {teamPeople.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members</p>
                      ) : (
                        <div className="space-y-2">
                          {teamPeople.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between rounded-xl border bg-background px-4 py-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                                  {person.name.charAt(0).toLowerCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-base font-semibold leading-tight">{person.name}</p>
                                  <p className="truncate text-sm text-muted-foreground">{person.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                                  {person.role}
                                </Badge>
                                {person.role === "EMPLOYEE" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      setRemoveTarget({
                                        teamId: team.id,
                                        memberId: person.id,
                                        memberName: person.name,
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove employee from team?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                {removeTarget
                  ? `This action will remove ${removeTarget.memberName} from this team.`
                  : "This action will remove this employee from the team."}
              </span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveEmployee} className="bg-red-600 hover:bg-red-700">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTeamTarget} onOpenChange={() => setDeleteTeamTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                {deleteTeamTarget
                  ? `This action will remove the team details for ${deleteTeamTarget.teamName}.`
                  : "This action will remove the selected team details."}
              </span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTeamTarget) {
                  deleteTeam(deleteTeamTarget.teamId);
                }
                setDeleteTeamTarget(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
