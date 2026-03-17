"use client";

import { useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface TeamData {
  id: string;
  name: string;
  baId: string;
  leadId?: string;
  memberIds: string[];
  createdAt: string;
}

interface BaAssignedTeamsProps {
  baId: string;
  employees: EmployeeOption[];
}

const STORAGE_KEY = "team-management-data-v1";

export function BaAssignedTeams({ baId, employees }: BaAssignedTeamsProps) {
  const [teams, setTeams] = useState<TeamData[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as TeamData[];
      if (!Array.isArray(parsed)) return;
      setTeams(parsed);
    } catch {
      setTeams([]);
    }
  }, []);

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const assignedTeams = useMemo(
    () => teams.filter((team) => team.baId === baId),
    [baId, teams]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Assigned Teams</CardTitle>
      </CardHeader>
      <CardContent>
        {assignedTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin-assigned teams found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assignedTeams.map((team) => {
              const lead = team.leadId ? employeeMap.get(team.leadId) : null;
              const ba = employeeMap.get(team.baId);
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
                        <p className="truncate text-lg font-extrabold text-blue-700">{team.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          BA: {ba?.name ?? "Unknown"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                      {teamPeople.length} MEMBERS
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-3">
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
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                              {person.role}
                            </Badge>
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
  );
}
