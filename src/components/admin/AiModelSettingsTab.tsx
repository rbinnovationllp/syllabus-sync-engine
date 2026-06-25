import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyOrgsWithAiSettings,
  updateOrgAiSettings,
} from "@/lib/ai-settings.functions";
import {
  ALLOWED_MODELS, MODEL_PRICING, DEFAULT_MODEL,
  estimateCalendarBundleCost, type AllowedModel,
} from "@/lib/ai-policy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

const SAMPLE_SUBJECTS = 8;

export function AiModelSettingsTab() {
  const listFn = useServerFn(listMyOrgsWithAiSettings);
  const updateFn = useServerFn(updateOrgAiSettings);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-orgs-ai-settings"], queryFn: () => listFn() });

  const mutate = useMutation({
    mutationFn: (vars: { org_id: string; active_model: string; allow_fallback_escalation: boolean }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("AI model updated");
      qc.invalidateQueries({ queryKey: ["my-orgs-ai-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  // Pre-compute per-model cost so we can show the impact of switching.
  const compare = useMemo(
    () =>
      ALLOWED_MODELS.map((m) => ({
        model: m,
        bundle: estimateCalendarBundleCost(SAMPLE_SUBJECTS, m),
      })),
    [],
  );
  const cheapest = Math.min(...compare.map((c) => c.bundle.providerUsd));

  if (q.isLoading) {
    return <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const orgs = q.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Policy-locked model catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            GPT-5 and Gemini Pro models are blocked by policy. Only low-cost Flash
            family models are selectable. Cost shown is for a sample {SAMPLE_SUBJECTS}-subject calendar.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Input $/1M</TableHead>
                <TableHead className="text-right">Output $/1M</TableHead>
                <TableHead className="text-right">Sample calendar cost</TableHead>
                <TableHead className="text-right">vs. cheapest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compare.map(({ model, bundle }) => (
                <TableRow key={model}>
                  <TableCell className="font-medium">{model}</TableCell>
                  <TableCell><Badge variant="outline">{MODEL_PRICING[model].tier}</Badge></TableCell>
                  <TableCell className="text-right">${MODEL_PRICING[model].input.toFixed(3)}</TableCell>
                  <TableCell className="text-right">${MODEL_PRICING[model].output.toFixed(3)}</TableCell>
                  <TableCell className="text-right">${bundle.providerUsd.toFixed(4)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {bundle.providerUsd === cheapest ? "—" : `+${(((bundle.providerUsd - cheapest) / cheapest) * 100).toFixed(0)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't belong to any organization yet.
            </p>
          ) : (
            <div className="space-y-4">
              {orgs.map((o: any) => {
                const projected = estimateCalendarBundleCost(SAMPLE_SUBJECTS, o.active_model as AllowedModel);
                const canEdit = o.role === "admin" || o.role === "super_admin";
                return (
                  <div key={o.org_id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{o.org_name}</h3>
                          <Badge variant="outline">{o.role}</Badge>
                          {!canEdit && (
                            <Badge variant="secondary" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> read-only
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Projected provider cost per calendar: <strong>${projected.providerUsd.toFixed(4)}</strong>
                          {" · "}margin <strong>{projected.marginPct.toFixed(0)}%</strong>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Active AI model</Label>
                        <Select
                          value={o.active_model ?? DEFAULT_MODEL}
                          disabled={!canEdit || mutate.isPending}
                          onValueChange={(v) =>
                            mutate.mutate({
                              org_id: o.org_id,
                              active_model: v,
                              allow_fallback_escalation: o.allow_fallback_escalation,
                            })
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ALLOWED_MODELS.map((m) => {
                              const c = estimateCalendarBundleCost(SAMPLE_SUBJECTS, m);
                              return (
                                <SelectItem key={m} value={m}>
                                  {m} · ${c.providerUsd.toFixed(4)}/calendar
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={o.allow_fallback_escalation}
                            disabled={!canEdit || mutate.isPending}
                            onCheckedChange={(checked) =>
                              mutate.mutate({
                                org_id: o.org_id,
                                active_model: o.active_model,
                                allow_fallback_escalation: checked,
                              })
                            }
                          />
                          <Label className="text-xs">
                            Escalate to a stronger Flash model when AI confidence is low
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
