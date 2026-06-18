import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPartnersAdmin,
  getPartnerDetailAdmin,
  issueShowCause,
  recordPartnerResponse,
  decideEnforcement,
} from "@/lib/enforcement.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, ShieldCheck, Gavel, FileText } from "lucide-react";

const REASON_OPTIONS = [
  { value: "confidentiality_breach", label: "Confidentiality / NDA breach" },
  { value: "competitor_engagement", label: "Competitor engagement" },
  { value: "fraud", label: "Fraudulent referrals" },
  { value: "spam", label: "Spam / incentivised signups" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "other", label: "Other" },
];

function money(cents: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    paused: "bg-slate-100 text-slate-700 border-slate-200",
    under_review: "bg-amber-100 text-amber-800 border-amber-200",
    suspended: "bg-orange-100 text-orange-800 border-orange-200",
    terminated: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function EnforcementTab() {
  const fn = useServerFn(listPartnersAdmin);
  const q = useQuery({ queryKey: ["admin-partners"], queryFn: () => fn() });
  const [selected, setSelected] = useState<string | null>(null);

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading partners…</div>;
  const partners = q.data ?? [];

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-amber-600" />
            Partner enforcement
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {partners.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No referral partners yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Forfeited</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.display_name ?? "—"}
                      {p.is_house && <Badge className="ml-2 bg-indigo-100 text-indigo-700">House</Badge>}
                      <div className="text-xs text-muted-foreground">{p.payout_email ?? ""}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">{money(p.totals.lifetime, p.totals.currency)}</TableCell>
                    <TableCell className="text-right">{money(p.totals.pending, p.totals.currency)}</TableCell>
                    <TableCell className="text-right text-rose-700">{money(p.totals.forfeited, p.totals.currency)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelected(p.id)} disabled={p.is_house}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && <PartnerDrawer partnerId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PartnerDrawer({ partnerId, onClose }: { partnerId: string; onClose: () => void }) {
  const fn = useServerFn(getPartnerDetailAdmin);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-partner", partnerId],
    queryFn: () => fn({ data: { partner_id: partnerId } }),
  });

  const [scOpen, setScOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState(false);
  const [respOpen, setRespOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-partner", partnerId] });
    qc.invalidateQueries({ queryKey: ["admin-partners"] });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partner enforcement</DialogTitle>
          <DialogDescription>
            Issue show-cause notices, log responses, and decide suspension, reinstatement, or termination.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading || !q.data ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">{q.data.partner.display_name}</div>
                  <div className="text-xs text-muted-foreground">{q.data.partner.payout_email}</div>
                  <div className="mt-1 font-mono text-xs">{q.data.partner.code}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {statusBadge(q.data.partner.status)}
                  {q.data.partner.status_reason && (
                    <div className="text-xs text-muted-foreground max-w-xs text-right">
                      {q.data.partner.status_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setScOpen(true)}>
                <AlertTriangle className="h-4 w-4 mr-1 text-amber-600" /> Issue show-cause
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRespOpen(true)}>
                <FileText className="h-4 w-4 mr-1" /> Log partner response
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDecideOpen(true)}>
                <ShieldAlert className="h-4 w-4 mr-1" /> Decide outcome
              </Button>
            </div>

            <section>
              <h3 className="text-sm font-semibold mb-2">Enforcement timeline</h3>
              {q.data.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions on record. Issue a show-cause to begin.</p>
              ) : (
                <ul className="space-y-2">
                  {q.data.actions.map((a: any) => (
                    <li key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Reason: {a.reason_category.replace(/_/g, " ")}
                        {a.forfeited_amount_cents > 0 && ` · Forfeited ${money(a.forfeited_amount_cents)}`}
                        {a.response_due_at && ` · Response due ${new Date(a.response_due_at).toLocaleDateString()}`}
                      </div>
                      {a.notice_text && <p className="mt-2 whitespace-pre-wrap">{a.notice_text}</p>}
                      {a.response_text && (
                        <p className="mt-2 rounded bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap">
                          <span className="text-xs font-medium text-slate-500">Partner response:</span>
                          <br />
                          {a.response_text}
                        </p>
                      )}
                      {a.evidence_url && (
                        <a href={a.evidence_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
                          View evidence ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Recent commissions</h3>
              {q.data.commissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.commissions.slice(0, 20).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{new Date(c.accrued_at).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{money(c.gross_amount_cents, c.currency)}</TableCell>
                        <TableCell className="text-right font-medium">{money(c.commission_cents, c.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}

        {scOpen && (
          <ShowCauseDialog partnerId={partnerId} onClose={() => setScOpen(false)} onDone={refresh} />
        )}
        {respOpen && (
          <ResponseDialog partnerId={partnerId} onClose={() => setRespOpen(false)} onDone={refresh} />
        )}
        {decideOpen && (
          <DecideDialog partnerId={partnerId} onClose={() => setDecideOpen(false)} onDone={refresh} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShowCauseDialog({ partnerId, onClose, onDone }: { partnerId: string; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(issueShowCause);
  const [reason, setReason] = useState("policy_violation");
  const [notice, setNotice] = useState("");
  const [evidence, setEvidence] = useState("");
  const [days, setDays] = useState(7);
  const m = useMutation({
    mutationFn: () => fn({ data: { partner_id: partnerId, reason_category: reason as any, notice_text: notice, evidence_url: evidence || undefined, response_days: days } }),
    onSuccess: () => { toast.success("Show-cause issued"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Issue show-cause</DialogTitle>
          <DialogDescription>Partner moves to <strong>under review</strong>. Accrual continues until you decide.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason category</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notice (the partner will receive this verbatim)</Label>
            <Textarea rows={6} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Describe the alleged breach, cite specific clauses, and ask for a written response." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Evidence URL (optional)</Label>
              <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Response window (days)</Label>
              <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || notice.trim().length < 20}>
            {m.isPending ? "Issuing…" : "Issue notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponseDialog({ partnerId, onClose, onDone }: { partnerId: string; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(recordPartnerResponse);
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { partner_id: partnerId, response_text: text } }),
    onSuccess: () => { toast.success("Response logged"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log partner response</DialogTitle>
          <DialogDescription>Paste the partner's written reply for the audit trail.</DialogDescription>
        </DialogHeader>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Partner reply…" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !text.trim()}>
            {m.isPending ? "Saving…" : "Save response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecideDialog({ partnerId, onClose, onDone }: { partnerId: string; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(decideEnforcement);
  const [decision, setDecision] = useState<"reinstated" | "suspended" | "terminated">("suspended");
  const [reason, setReason] = useState("policy_violation");
  const [notice, setNotice] = useState("");
  const [forfeit, setForfeit] = useState(false);
  const m = useMutation({
    mutationFn: () => fn({ data: { partner_id: partnerId, decision, reason_category: reason as any, notice_text: notice, forfeit_accrued: forfeit } }),
    onSuccess: (r: any) => {
      toast.success(`Partner ${r.new_status}${r.forfeited_cents > 0 ? ` · forfeited ${money(r.forfeited_cents)}` : ""}`);
      onDone(); onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Decide enforcement outcome</DialogTitle>
          <DialogDescription>Suspension stops future accrual. Termination is permanent. Forfeiture clears unpaid accrued commissions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Decision</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reinstated"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Reinstate (back to active)</span></SelectItem>
                <SelectItem value="suspended">Suspend (stop accrual, can be reinstated)</SelectItem>
                <SelectItem value="terminated">Terminate (permanent)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason category</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Decision rationale</Label>
            <Textarea rows={5} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Summarise the findings, the partner's response, and why this outcome is fair." />
          </div>
          {decision !== "reinstated" && (
            <label className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
              <Checkbox checked={forfeit} onCheckedChange={(v) => setForfeit(Boolean(v))} className="mt-0.5" />
              <span>
                <span className="font-medium text-rose-800">Forfeit all unpaid accrued commissions.</span>
                <span className="block text-xs text-rose-700/80">Only check this if the breach is material and policy permits forfeiture.</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || notice.trim().length < 10} variant={decision === "reinstated" ? "default" : "destructive"}>
            {m.isPending ? "Saving…" : `Confirm ${decision}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
