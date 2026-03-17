"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { getMyNotifications, type AppNotification } from "@/actions/notification.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationBellProps {
  userKey: string;
}

export function NotificationBell({ userKey }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(`notification-last-seen:${userKey}`);
    } catch {
      return null;
    }
  });

  const storageKey = `notification-last-seen:${userKey}`;

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const data = await getMyNotifications(20).catch(() => [] as AppNotification[]);
      if (!mounted) return;
      setNotifications(data);
    };

    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return notifications.length;
    const seenTime = new Date(lastSeenAt).getTime();
    return notifications.filter(
      (item) => new Date(item.createdAt).getTime() > seenTime
    ).length;
  }, [notifications, lastSeenAt]);

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    const now = new Date().toISOString();
    setLastSeenAt(now);
    try {
      window.localStorage.setItem(storageKey, now);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground">No notifications.</div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto px-2 py-1">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
