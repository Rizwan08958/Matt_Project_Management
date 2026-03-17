import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllActiveProjects } from "@/actions/time-entry.actions";
import { TimeEntryForm } from "@/components/work-tracking/time-entry-form";

interface EditTimeEntryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTimeEntryPage({ params }: EditTimeEntryPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    notFound();
  }

  const entry = await db.timeEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    notFound();
  }

  // Check if user can edit
  if (entry.userId !== session.user.id && session.user.role === "EMPLOYEE") {
    notFound();
  }

  const projects = await getAllActiveProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Time Entry</h1>
        <p className="text-muted-foreground">Update your time entry</p>
      </div>

      <TimeEntryForm entry={entry} projects={projects} />
    </div>
  );
}

