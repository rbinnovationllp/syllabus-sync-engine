import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiUsageReport } from "@/lib/ai-usage.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Coins } from "lucide-react";

export function AiUsageTab() {
  const fn = useServerFn(getAiUsageReport);
  const [days, setDays] = useState(30);
  const [action, setAction] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const q = useQuery({
    queryKey: ["ai-usage", days, action, status],
    queryFn: () => fn({ data: {
      days,
      action: action === "all" ? null : action,
      status: status === "all" ? null : status,
    } }),
  });

  const maxDayCredits = useMemo(
    () => Math.max(1, ...(q.data?.byDay ?? []).map((d: any) => d.credits)),
    [q.data],
  );

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = q.data;
  if (!d) return null;

  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Window</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 60, 90, 180].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-medium ml-2">Action</span>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {d.byAction.map((a: any) => (
                <SelectItem key={a.action} value={a.action}>{a.action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-medium ml-2">Status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Sparkles} label="Total runs" value={d.totals.total_runs} accent="indigo" />
        <Stat icon={Coins} label="Credits spent" value={d.totals.total_credits} accent="amber" />
        <Stat icon={CheckCircle2} label="Successful" value={d.totals.success} accent="emerald" />
        <Stat icon={AlertTriangle} label="Failed" value={d.totals.failed} accent="rose" />
      </div>

      <Card>
        <CardHeader><CardTitle>Daily credit spend</CardTitle></CardHeader>
        <CardContent>
          {d.byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in window.</p>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {d.byDay.map((b: any) => (
                <div
                  key={b.day}
                  className="flex-1 bg-gradient-to-t from-indigo-500 to-fuchsia-400 rounded-t hover:opacity-80 transition"
                  style={{ height: `${(b.credits / maxDayCredits) * 100}%`, minHeight: 2 }}
                  title={`${b.day}: ${b.credits} credits, ${b.runs} runs`}
                />
              ))}
            </div>
          )}
          {d.byDay.length > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{d.byDay[0].day}</span>
              <span>{d.byDay[d.byDay.length - 1].day}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By action</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Action</TableHead><TableHead>Runs</TableHead>
                <TableHead>Credits</TableHead><TableHead>Failed</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {d.byAction.map((a: any) => (
                  <TableRow key={a.action}>
                    <TableCell className="font-medium text-xs">{a.action}</TableCell>
                    <TableCell>{a.runs}</TableCell>
                    <TableCell>{a.credits}</TableCell>
                    <TableCell>
                      {a.failed > 0
                        ? <Badge variant="destructive">{a.failed}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top users (by credits)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Runs</TableHead><TableHead>Credits</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {d.byUser.map((u: any) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell>{u.runs}</TableCell>
                    <TableCell>{u.credits}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>User</TableHead>
              <TableHead>Action</TableHead><TableHead>Status</TableHead>
              <TableHead>Credits</TableHead><TableHead>Error</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.recent.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{r.email ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{r.action}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "default" : "destructive"} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.credits_spent ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {r.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  const accents: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    rose: "from-rose-500 to-red-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
        </div>
        <div className={`rounded-xl bg-gradient-to-br ${accents[accent]} p-2.5 text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
