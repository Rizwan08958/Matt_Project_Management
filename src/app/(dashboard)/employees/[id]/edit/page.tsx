import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployee } from "@/actions/employee.actions";
import { EmployeeForm } from "@/components/employees/employee-form";

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employee = await getEmployee(id);

  if (!employee) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Employee</h1>
        <p className="text-muted-foreground">Update employee information</p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  );
}

