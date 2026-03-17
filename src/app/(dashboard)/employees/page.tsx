import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployees } from "@/actions/employee.actions";
import { EmployeeTable } from "@/components/employees/employee-table";

export default async function EmployeesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employees = await getEmployees();

  return <EmployeeTable employees={employees} />;
}

