import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listProposalsForReview, rejectProposalPostHoc } from "@/lib/proposal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, ShieldAlert } from "lucide-react";

const STATUS_OPTIONS = [
  { v: "", label: "All statuses" },
  { v: "draft", label: "Draft" },
  { v: "under_ai_review", label: "Under AI review" },
  { v: "finalized", label: "Finalized" },
  { v: "flagged_low_quality", label: "Flagged (low quality)" },
  { v: "teacher_acknowledged", label: "Teacher acknowledged" },
  { v: "rejected", label: "Rejected" },
];

export function CurriculumReviewsTab() {
  const fn = useServerFn(listProposalsForReview);
  const rejectFn = useServerFn(rejectProposalPostHoc);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const q = useQuery({
    queryKey: ["admin-proposals", status],
    queryFn: () => fn({ data: { status: status || undefined } }),
  });

  const reject = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      rejectFn({ data: { proposal_id: vars.id, reason: vars.reason } }),
    onSuccess: () => {
      toast.success("Proposal rejected");
      qc.invalidateQueries({ queryKey: ["admin-proposals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <div>
          <CardTitle>Curriculum edit proposals ({rows.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Review teacher-driven changes, AI scoring, and forced finalizations across all schools.
          </p>
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.v || "all"} value={o.v || "all"}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {q.isLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No proposals match this filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Grade / Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI score</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.updated_at ?? p.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">Gr {p.grade} · {p.subject}</TableCell>
                  <TableCell>
                    <Badge variant={
                      p.status === "finalized" ? "default"
                      : p.status === "flagged_low_quality" || p.status === "rejected" ? "destructive"
                      : "secondary"
                    } className="text-[10px]">{p.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {typeof p.ai_score === "number" ? `${Math.round(p.ai_score * 100)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{p.ai_verdict ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        to="/curriculum/$yearId/propose"
                        params={{ yearId: p.year_id }}
                        search={{ proposal: p.id }}
                      >
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                    {p.status !== "rejected" && (
                      <RejectDialog
                        onSubmit={(reason) => reject.mutate({ id: p.id, reason })}
                        pending={reject.isPending}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RejectDialog({ onSubmit, pending }: { onSubmit: (r: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject proposal</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Provide a rationale (min 10 chars). The teacher will see this in their proposal history.
        </p>
        <Textarea
          rows={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Removes mandatory board-mapped chapters without replacement."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 10}
            onClick={() => { onSubmit(reason.trim()); setOpen(false); setReason(""); }}
          >
            {pending ? "Rejecting…" : "Reject proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
