import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployees } from "@/actions/employee.actions";
import { TeamManagement } from "@/components/teams/team-management";

export default async function TeamManagementPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employees = await getEmployees();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">Create and manage teams</p>
      </div>

      <TeamManagement
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          permissions: employee.permissions,
        }))}
      />
    </div>
  );
}

