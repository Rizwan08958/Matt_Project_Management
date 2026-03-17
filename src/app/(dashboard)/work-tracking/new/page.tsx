import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAssignedProjects, getAllActiveProjects } from "@/actions/time-entry.actions";
import { TimeEntryForm } from "@/components/work-tracking/time-entry-form";

export default async function NewTimeEntryPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    redirect("/dashboard");
  }

  const isManager =
    session.user.role === "ADMIN" ||
    session.user.role === "BA" ||
    session.user.role === "TEAMLEADER";
  const projects = isManager
    ? await getAllActiveProjects()
    : await getAssignedProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Time</h1>
        <p className="text-muted-foreground">Record your work hours</p>
      </div>

      <TimeEntryForm projects={projects} />
    </div>
  );
}

