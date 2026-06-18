import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ALLOWED_MODELS, MODEL_PRICING, ACTION_TOKEN_ESTIMATES, DEFAULT_MODEL,
  CREDIT_REVENUE_USD, TOPUP_CREDIT_REVENUE_USD,
  estimateActionCost, estimateCalendarBundleCost, type AllowedModel,
} from "@/lib/ai-policy";
import { AI_ACTION_COSTS, type AiAction } from "@/lib/plans";
import { Sparkles, DollarSign, TrendingUp, Cpu } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/ai-cost")({
  head: () => ({
    meta: [
      { title: "AI cost estimator — CurriculumOS" },
      { name: "description", content: "Project AI provider cost, credit revenue, and gross margin per generated calendar across every supported model." },
    ],
  }),
  component: AiCostPage,
});

const ACTIONS = Object.keys(AI_ACTION_COSTS) as AiAction[];

function fmtUsd(n: number, digits = 4) {
  return `$${n.toFixed(digits)}`;
}

function AiCostPage() {
  const [model, setModel] = useState<AllowedModel>(DEFAULT_MODEL);
  const [subjects, setSubjects] = useState(8);
  const [revenueMode, setRevenueMode] = useState<"plan" | "topup">("plan");

  const revenuePerCredit = revenueMode === "plan" ? CREDIT_REVENUE_USD : TOPUP_CREDIT_REVENUE_USD;

  const perAction = useMemo(
    () => ACTIONS.map((a) => estimateActionCost(a, model, { revenuePerCredit })),
    [model, revenuePerCredit],
  );

  const bundle = useMemo(
    () => estimateCalendarBundleCost(subjects, model, { revenuePerCredit }),
    [model, subjects, revenuePerCredit],
  );

  // Per-model comparison for the same calendar bundle
  const modelCompare = useMemo(
    () =>
      ALLOWED_MODELS.map((m) => ({
        modelName: m,
        bundle: estimateCalendarBundleCost(subjects, m, { revenuePerCredit }),
      })),
    [subjects, revenuePerCredit],
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI cost &amp; margin estimator</h1>
          <p className="text-sm text-muted-foreground">
            Real-time projection of AI provider cost, credit revenue and gross margin
            per generated calendar. Pricing is locked to the safe Gemini Flash family.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Cpu className="h-3 w-3" /> Policy: Flash-only
        </Badge>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Scenario inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Active model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as AllowedModel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALLOWED_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} <span className="ml-2 text-xs text-muted-foreground">({MODEL_PRICING[m].tier})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subjects per calendar</Label>
            <Input
              type="number" min={1} max={60}
              value={subjects}
              onChange={(e) => setSubjects(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <Label>Revenue model</Label>
            <Select value={revenueMode} onValueChange={(v) => setRevenueMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Plan credit (${CREDIT_REVENUE_USD.toFixed(4)}/credit)</SelectItem>
                <SelectItem value="topup">Top-up pack (${TOPUP_CREDIT_REVENUE_USD.toFixed(4)}/credit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Sparkles} label="Credits per calendar" value={bundle.credits.toString()} accent="indigo" />
        <StatCard icon={DollarSign} label="Provider cost (USD)" value={fmtUsd(bundle.providerUsd)} accent="rose" />
        <StatCard icon={DollarSign} label="Revenue (USD)" value={fmtUsd(bundle.revenueUsd, 2)} accent="emerald" />
        <StatCard icon={TrendingUp} label="Gross margin" value={`${bundle.marginPct.toFixed(1)}%`} accent="amber" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Per-action breakdown · {model}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Input tok</TableHead>
                <TableHead className="text-right">Output tok</TableHead>
                <TableHead className="text-right">Provider $</TableHead>
                <TableHead className="text-right">Revenue $</TableHead>
                <TableHead className="text-right">Gross $</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perAction.map((r) => (
                <TableRow key={r.action}>
                  <TableCell className="font-medium">{r.action}</TableCell>
                  <TableCell className="text-right">{r.credits}</TableCell>
                  <TableCell className="text-right">{r.inputTokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.outputTokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtUsd(r.providerUsd)}</TableCell>
                  <TableCell className="text-right">{fmtUsd(r.revenueUsd)}</TableCell>
                  <TableCell className="text-right">{fmtUsd(r.grossUsd)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={r.marginPct >= 60 ? "default" : r.marginPct >= 30 ? "secondary" : "destructive"}>
                      {r.marginPct.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Model comparison · {subjects}-subject calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Provider $</TableHead>
                <TableHead className="text-right">Revenue $</TableHead>
                <TableHead className="text-right">Gross $</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">vs. cheapest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const cheapest = Math.min(...modelCompare.map((r) => r.providerUsd));
                return modelCompare
                  .slice()
                  .sort((a, b) => a.providerUsd - b.providerUsd)
                  .map((r) => (
                    <TableRow key={r.model} className={r.model === model ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{r.model}</TableCell>
                      <TableCell><Badge variant="outline">{MODEL_PRICING[r.model as AllowedModel].tier}</Badge></TableCell>
                      <TableCell className="text-right">{fmtUsd(r.providerUsd)}</TableCell>
                      <TableCell className="text-right">{fmtUsd(r.revenueUsd, 2)}</TableCell>
                      <TableCell className="text-right">{fmtUsd(r.grossUsd, 2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.marginPct >= 60 ? "default" : "secondary"}>
                          {r.marginPct.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.providerUsd === cheapest ? "—" : `+${(((r.providerUsd - cheapest) / cheapest) * 100).toFixed(0)}%`}
                      </TableCell>
                    </TableRow>
                  ));
              })()}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Token budgets are derived from the prompts in <code>ai-generation.functions.ts</code>:
            annual calendar ≈ {ACTION_TOKEN_ESTIMATES.generate_annual_calendar.input}/{ACTION_TOKEN_ESTIMATES.generate_annual_calendar.output} tok,
            subject curriculum ≈ {ACTION_TOKEN_ESTIMATES.generate_subject_curriculum.input}/{ACTION_TOKEN_ESTIMATES.generate_subject_curriculum.output} tok.
            Actual usage varies ±15%.
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Want to change the tenant default? Open the{" "}
        <Link to="/admin" className="underline">Admin → AI Models</Link> tab.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  const accents: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    rose: "from-rose-500 to-pink-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div className={`rounded-xl bg-gradient-to-br ${accents[accent]} p-2.5 text-white shadow-md`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
