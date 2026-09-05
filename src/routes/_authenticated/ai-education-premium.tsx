import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { calculateAiEducationPremium, formatInr } from "@/lib/ai-education-premium";
import { createAiEducationPremiumQuote, getAiEducationPremium } from "@/lib/ai-education-premium.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-education-premium")({ component: AiEducationPremiumPage });

function AiEducationPremiumPage() {
  const getData = useServerFn(getAiEducationPremium); const requestQuote = useServerFn(createAiEducationPremiumQuote);
  const { data, refetch } = useQuery({ queryKey: ["ai-education-premium"], queryFn: () => getData() });
  const [selected, setSelected] = useState<string[]>([]); const [interval, setInterval] = useState<"monthly" | "annual">("monthly"); const [loading, setLoading] = useState(false);
  const quote = useMemo(() => calculateAiEducationPremium(selected, data?.catalog), [selected, data?.catalog]);
  const toggle = (grade: string) => setSelected((all) => all.includes(grade) ? all.filter((x) => x !== grade) : [...all, grade]);
  async function submit() { try { setLoading(true); const result = await requestQuote({ data: { grades: selected as any, billingInterval: interval } }); toast.success(`Request recorded for ${formatInr(interval === "monthly" ? result.monthlyInr : result.annualInr)} ${interval === "monthly" ? "per month" : "per year"}. Payment activation is pending.`); await refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create request"); } finally { setLoading(false); } }
  return <AppShell title="AI Education Premium"><div className="mx-auto max-w-5xl space-y-6"><section><Badge>Independent product</Badge><h1 className="mt-2 text-3xl font-bold">AI Education Premium</h1><p className="mt-1 text-muted-foreground">AI Education Curriculum & Teacher Guidance Platform</p><p className="font-medium">What to teach. When to teach. How to teach — age-appropriately, class by class.</p></section><Card><CardHeader><CardTitle>Select AI education classes</CardTitle><CardDescription>Each selected class is independently entitled and billed. This does not require a Regular Syllabus Planning subscription.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.catalog.map((item) => <label key={item.grade} className="flex cursor-pointer items-center gap-3 rounded border p-3"><Checkbox checked={selected.includes(item.grade)} disabled={!item.active} onCheckedChange={() => toggle(item.grade)} /><span className="flex-1">Class {item.grade}</span><span className="text-sm font-medium">{formatInr(item.monthlyInr)}/mo</span></label>)}</CardContent></Card><Card><CardHeader><CardTitle>Live price summary</CardTitle><CardDescription>No bundle discount is applied unless an authorised future configuration adds one.</CardDescription></CardHeader><CardContent className="space-y-3"><div>Selected: {quote.selected.length ? quote.selected.map((x) => `Class ${x.grade}`).join(", ") : "None"}</div><div className="flex gap-2"><Button variant={interval === "monthly" ? "default" : "outline"} onClick={() => setInterval("monthly")}>Monthly {formatInr(quote.monthlyInr)}</Button><Button variant={interval === "annual" ? "default" : "outline"} onClick={() => setInterval("annual")}>Annual {formatInr(quote.annualInr)}</Button></div><Button disabled={!selected.length || loading} onClick={submit}>{loading ? "Submitting…" : "Request subscription checkout"}</Button></CardContent></Card>{data?.subscribedGrades.length ? <Card><CardHeader><CardTitle>My subscribed classes</CardTitle></CardHeader><CardContent>{data.subscribedGrades.map((grade) => <Badge key={grade} className="mr-2">Class {grade}</Badge>)}</CardContent></Card> : null}</div></AppShell>;
}
