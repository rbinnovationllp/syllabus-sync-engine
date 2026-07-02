import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPlatformAuditLogs } from "@/lib/governance.functions";

export const Route = createFileRoute("/_authenticated/audit-trail")({
  component: AuditTrailPage,
});

function AuditTrailPage() {
  const listFn = useServerFn(listPlatformAuditLogs);
  const logs = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: () => listFn({ data: { limit: 200 } }),
  });

  return (
    <AppShell title="Audit Trail">
      <section className="space-y-6">
        <div>
          <Badge variant="outline">Governance</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Platform Audit Trail</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Security, content, download, subscription, and administrative actions are retained for accountability, quality assurance, dispute resolution, and compliance review.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Visible to authorized school administrators and company administrators.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading audit logs...</p>
            ) : logs.error ? (
              <p className="text-sm text-destructive">{(logs.error as Error).message}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs.data?.rows ?? []).map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                        <TableCell>{row.user_name || row.user_id || "System"}</TableCell>
                        <TableCell>{row.user_role || "-"}</TableCell>
                        <TableCell>{row.school_name || "-"}</TableCell>
                        <TableCell><Badge variant="secondary">{row.action}</Badge></TableCell>
                        <TableCell>{[row.entity_type, row.entity_id].filter(Boolean).join(" / ") || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
