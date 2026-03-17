"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  CalendarDays,
  BarChart3,
  Activity,
  ShieldCheck,
  Building2,
  Handshake,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  module?: "CRM" | "PROJECT" | "SALES";
  modulesAny?: Array<"CRM" | "PROJECT" | "SALES">;
  exactMatch?: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-6 w-6" />,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: <Users className="h-6 w-6" />,
    roles: ["ADMIN"],
  },
  {
    title: "Clients",
    href: "/clients",
    icon: <Building2 className="h-6 w-6" />,
    module: "CRM",
  },
  {
    title: "CRM",
    href: "/crm",
    icon: <Handshake className="h-6 w-6" />,
    module: "CRM",
    exactMatch: true,
  },
  {
    title: "Sales",
    href: "/crm/quotations",
    icon: <BadgeDollarSign className="h-6 w-6" />,
    module: "SALES",
  },
  {
    title: "Projects",
    href: "/projects",
    icon: <FolderKanban className="h-6 w-6" />,
    module: "PROJECT",
  },
  {
    title: "Work Tracking",
    href: "/work-tracking",
    icon: <Clock className="h-6 w-6" />,
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: <CalendarDays className="h-6 w-6" />,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: <BarChart3 className="h-6 w-6" />,
  },
  {
    title: "Activity Logs",
    href: "/activity-logs",
    icon: <Activity className="h-6 w-6" />,
    roles: ["ADMIN", "BA", "TEAMLEADER"],
  },
  {
    title: "Security",
    href: "/security",
    icon: <ShieldCheck className="h-6 w-6" />,
    roles: ["ADMIN"],
  },
];

interface SidebarProps {
  userRole: string;
  moduleAccess?: string[];
}

export function Sidebar({ userRole, moduleAccess = [] }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const filteredItems = navItems.filter(
    (item) =>
      (!item.roles || item.roles.includes(userRole)) &&
      (userRole === "ADMIN" ||
        ((!item.module || moduleAccess.includes(item.module)) &&
          (!item.modulesAny || item.modulesAny.some((module) => moduleAccess.includes(module)))))
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="fixed left-3 top-3 z-50 h-10 w-10 rounded-full border border-slate-800 bg-slate-950 text-slate-100 shadow-lg hover:bg-slate-900 md:hidden"
        onClick={() => setIsMobileOpen((open) => !open)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-y-hidden border-r border-slate-800 bg-slate-950 text-slate-50 transition-transform duration-300 md:relative md:top-auto md:z-auto md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-16" : "md:w-64",
          "w-[88vw] max-w-72 shrink-0 md:max-w-none"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-4 pt-16 md:pt-4">
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">WorkTracker</h1>
              <p className="text-xs text-slate-400 md:hidden">Navigation</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-100 hover:bg-slate-800 md:hidden"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-slate-100 hover:bg-slate-800 md:inline-flex"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {filteredItems.map((item) => {
            const isActive = item.exactMatch
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                  isCollapsed && "md:justify-center md:px-0",
                  isActive
                    ? "bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-950/20"
                    : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                )}
              >
                {item.icon}
                {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
