"use client";

import { logout } from "@/actions/auth.actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AdminMessageComposer } from "@/components/layout/admin-message-composer";
import { RoleHelpDialog } from "@/components/layout/role-help-dialog";
import { LogOut, Settings, User } from "lucide-react";
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";

interface HeaderProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
}

export function Header({ user }: HeaderProps) {
  const [isPending, startTransition] = useTransition();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pathname = usePathname();

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  const roleLabel =
    user.role === "TEAMLEADER"
      ? "TL"
      : user.role === "ADMIN"
        ? "ADMIN"
        : user.role === "BA"
          ? "BA"
          : "EMPLOYEE";

  if (pathname.startsWith("/crm")) {
    return null;
  }

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b bg-card pl-16 pr-3 sm:pr-4 md:px-6">
      <div className="min-w-0 flex-1 md:flex-none">
        <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base md:text-lg">
          Employee Work Tracking
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
        {user.role !== "EMPLOYEE" ? <AdminMessageComposer userRole={user.role} /> : null}
        <RoleHelpDialog role={user.role} />
        <NotificationBell userKey={user.id || user.email || user.name || "user"} />

        <div className="flex flex-col items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full sm:h-10 sm:w-10">
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                  <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">{roleLabel}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} disabled={isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isPending ? "Signing out..." : "Sign out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[10px] font-semibold leading-none text-muted-foreground">{roleLabel}</p>
        </div>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={isPending}>
              {isPending ? "Signing out..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
