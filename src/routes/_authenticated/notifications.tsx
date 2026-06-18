import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CurriculumOS" }] }),
  component: NotificationsPage,
});

const SEVERITY: Record<string, { dot: string; label: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { dot: "bg-sky-500", label: "secondary" },
  warn: { dot: "bg-amber-500", label: "secondary" },
  critical: { dot: "bg-rose-500", label: "destructive" },
};

function NotificationsPage() {
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const delFn = useServerFn(deleteNotification);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notif-all"],
    queryFn: () => listFn({ data: { limit: 100 } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notif-all"] });
    qc.invalidateQueries({ queryKey: ["notif-count"] });
    qc.invalidateQueries({ queryKey: ["notif-recent"] });
  };

  const markOne = useMutation({ mutationFn: (id: string) => markFn({ data: { id } }), onSuccess: refresh });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => { toast.success("All marked as read"); refresh(); },
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const unread = rows.filter((n: any) => !n.read_at).length;

  return (
    <AppShell title="Notifications">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "All caught up"} · curriculum risk, schedule changes, training reminders.
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Mark all as read
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No notifications yet. We'll alert you here when syllabus risk, training, or schedule changes appear.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n: any) => {
            const sev = SEVERITY[n.severity] ?? SEVERITY.info;
            return (
              <Card key={n.id} className={n.read_at ? "opacity-70" : ""}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant={sev.label} className="text-[10px]">{n.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                      {!n.read_at && <Badge className="text-[10px]">new</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {n.link && (
                      <Button asChild size="sm" variant="ghost" onClick={() => !n.read_at && markOne.mutate(n.id)}>
                        <Link to={n.link as any}>
                          Open <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                    {!n.read_at && (
                      <Button size="sm" variant="ghost" onClick={() => markOne.mutate(n.id)}>
                        Mark read
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(n.id)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
