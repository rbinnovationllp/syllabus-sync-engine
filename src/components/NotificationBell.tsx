import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

const SEVERITY_COLOR: Record<string, string> = {
  info: "bg-sky-500",
  warn: "bg-amber-500",
  critical: "bg-rose-500",
};

export function NotificationBell() {
  const countFn = useServerFn(getUnreadNotificationCount);
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();

  const countQ = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => countFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["notif-recent"],
    queryFn: () => listFn({ data: { limit: 10 } }),
    staleTime: 30_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-recent"] });
    },
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-recent"] });
    },
  });

  const unread = countQ.data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                Mark all read
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/notifications">All</Link>
            </Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {listQ.isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">You're all caught up.</div>
          ) : (
            (listQ.data ?? []).map((n: any) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read_at) markOne.mutate(n.id);
                  if (n.link) window.location.href = n.link;
                }}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 ${n.read_at ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${SEVERITY_COLOR[n.severity] ?? "bg-muted"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
