import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmployeeForm } from "@/components/employees/employee-form";

export default async function NewEmployeePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50 to-slate-100/90 p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Employee</h1>
        <p className="mt-1 text-sm text-slate-600">Create a new employee account</p>
      </div>

      <EmployeeForm />
    </div>
  );
}

