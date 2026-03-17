import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-transparent md:h-screen md:overflow-hidden">
      <Sidebar userRole={session.user.role} moduleAccess={session.user.moduleAccess} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5">
          <div className="dashboard-page-shell">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
