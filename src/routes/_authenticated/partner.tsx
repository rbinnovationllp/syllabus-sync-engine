import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2 } from "lucide-react";
import {
  becomePartner,
  getMyCommissions,
  getMyPartner,
  getMyPartnerStats,
} from "@/lib/partner.functions";

export const Route = createFileRoute("/_authenticated/partner")({
  component: PartnerPage,
});

function formatMoney(cents: number, currency = "usd") {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function PartnerPage() {
  const fetchPartner = useServerFn(getMyPartner);
  const fetchStats = useServerFn(getMyPartnerStats);
  const fetchCommissions = useServerFn(getMyCommissions);
  const qc = useQueryClient();

  const partnerQ = useQuery({ queryKey: ["partner"], queryFn: () => fetchPartner() });
  const statsQ = useQuery({ queryKey: ["partner-stats"], queryFn: () => fetchStats() });
  const commsQ = useQuery({ queryKey: ["partner-commissions"], queryFn: () => fetchCommissions() });

  const partner = partnerQ.data;
  const isHouse = partner?.is_house ?? false;

  return (
    <AppShell title="Partner program">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">School Partner Program</h1>
        <p className="text-sm text-muted-foreground">
          Earn 10% of every subscription payment, for as long as the school stays subscribed.
        </p>
      </div>

      {!partner ? (
        <JoinCard onJoined={() => {
          qc.invalidateQueries({ queryKey: ["partner"] });
          qc.invalidateQueries({ queryKey: ["partner-stats"] });
        }} />
      ) : (
        <div className="space-y-6">
          {isHouse && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You are signed in as the house partner account. This account is internal and is
              excluded from public leaderboards.
            </div>
          )}

          {partner.status === "under_review" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Under review:</strong> a show-cause notice has been issued on your account.
              All commissions are on hold pending response.
            </div>
          )}
          {partner.status === "suspended" && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              <strong>Suspended:</strong> new commissions are forfeited.
            </div>
          )}
          {partner.status === "terminated" && (
            <div className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
              <strong>Terminated:</strong> no new commissions will be recorded.
            </div>
          )}

          <LinkCard code={partner.code} />

          <StatsGrid stats={statsQ.data} loading={statsQ.isLoading} />

          <Card>
            <CardHeader>
              <CardTitle>Commission ledger</CardTitle>
              <CardDescription>Last 200 recorded commissions. Schools are anonymised.</CardDescription>
            </CardHeader>
            <CardContent>
              {commsQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !commsQ.data || commsQ.data.length === 0 ? (
                <div className="text-sm text-muted-foreground">No commissions yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">School</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commsQ.data as Array<{
                        id: string; org_id: string; commission_cents: number;
                        currency: string; status: string; accrued_at: string; paid_at: string | null;
                      }>).map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {new Date(c.accrued_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs">
                            School #{c.org_id.slice(0, 6).toUpperCase()}
                          </td>
                          <td className="py-2 pr-3 font-medium">
                            {formatMoney(c.commission_cents, c.currency)}
                          </td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={c.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function JoinCard({ onJoined }: { onJoined: () => void }) {
  const become = useServerFn(becomePartner);
  const [displayName, setDisplayName] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptNda, setAcceptNda] = useState(false);

  const mut = useMutation({
    mutationFn: () => become({ data: { displayName, payoutEmail: payoutEmail || undefined, acceptTerms, acceptNda } }),
    onSuccess: () => { toast.success("You're in! Your referral link is ready."); onJoined(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not enrol"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Become a partner</CardTitle>
        <CardDescription>
          Get a unique link. Schools that subscribe through it earn you 10% of every payment, for life.
          Minimum payout $50; paid monthly via manual bank transfer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name or organisation" />
        </div>
        <div>
          <Label htmlFor="pe">Payout email (optional)</Label>
          <Input id="pe" type="email" value={payoutEmail} onChange={(e) => setPayoutEmail(e.target.value)} placeholder="finance@example.com" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
          <span>
            I accept the <strong>Partner Terms</strong>: 10% recurring commission, $50 minimum,
            refunds reverse commission, no misrepresentation, breach may trigger a show-cause notice
            and suspension or termination at CurriculumOS's discretion.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={acceptNda} onCheckedChange={(v) => setAcceptNda(v === true)} />
          <span>
            I accept the <strong>NDA & non-compete</strong>: I will not share product internals,
            prompts, screenshots or any non-public information, and will not simultaneously partner
            with, build, or actively promote a competing curriculum-planning product.
          </span>
        </label>
        <Button disabled={mut.isPending || !displayName.trim() || !acceptTerms || !acceptNda}
                onClick={() => mut.mutate()}>
          {mut.isPending ? "Enrolling…" : "Enrol & generate my link"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LinkCard({ code }: { code: string }) {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/?ref=${code}`
    : `https://curriculumos.app/?ref=${code}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your referral link</CardTitle>
        <CardDescription>Code: <span className="font-mono">{code}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button variant="outline" onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Link copied");
          }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Try CurriculumOS — ${url}`)}`}
               target="_blank" rel="noreferrer">
              <Share2 className="h-4 w-4 mr-1" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:?subject=${encodeURIComponent("CurriculumOS")}&body=${encodeURIComponent(url)}`}>
              <Share2 className="h-4 w-4 mr-1" /> Email
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
               target="_blank" rel="noreferrer">
              <Share2 className="h-4 w-4 mr-1" /> LinkedIn
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsGrid({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading || !stats?.hasPartner) {
    return <div className="text-sm text-muted-foreground">Loading stats…</div>;
  }
  const t = stats.totals;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat title="Lifetime earned" value={formatMoney(t.lifetimeAccruedCents, t.currency)} />
      <Stat title="Pending payout" value={formatMoney(t.pendingPayoutCents, t.currency)} />
      <Stat title="Paid out" value={formatMoney(t.lifetimePaidCents, t.currency)} />
      <Stat title="Paying schools" value={String(stats.payingOrgs)} />
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, string> = {
    accrued: "bg-blue-100 text-blue-900",
    approved: "bg-indigo-100 text-indigo-900",
    paid: "bg-green-100 text-green-900",
    reversed: "bg-zinc-200 text-zinc-700",
    forfeited: "bg-red-100 text-red-900",
  };
  return <Badge className={variant[status] ?? ""} variant="secondary">{status}</Badge>;
}
