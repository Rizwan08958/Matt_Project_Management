import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTimeEntries } from "@/actions/time-entry.actions";
import { TimeEntryTable } from "@/components/work-tracking/time-entry-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function WorkTrackingPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    redirect("/dashboard");
  }

  const hasTeamScope =
    session.user.role === "ADMIN" ||
    session.user.permissions.recordRules.includes("RECORD_RULES") ||
    session.user.permissions.recordRules.includes("TEAM_RECORD") ||
    session.user.permissions.recordRules.includes("ASSIGN_PROJECT");
  const canManageOthers =
    session.user.role !== "EMPLOYEE" &&
    session.user.permissions.actionPermissions.includes("UPDATE");
  const entries = await getTimeEntries();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work Tracking</h1>
          <p className="text-muted-foreground">
            {hasTeamScope ? "View team/project time entries" : "Track your work hours"}
          </p>
        </div>
        <Button asChild>
          <Link href="/work-tracking/new">
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Link>
        </Button>
      </div>

      <TimeEntryTable
        entries={entries}
        currentUserId={session.user.id}
        showEmployeeColumn={hasTeamScope}
        canManageOthers={canManageOthers}
      />
    </div>
  );
}

