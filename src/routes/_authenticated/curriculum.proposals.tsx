import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyProposals } from "@/lib/proposal.functions";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/curriculum/proposals")({
  head: () => ({ meta: [{ title: "My curriculum proposals — CurriculumOS" }] }),
  component: ProposalsListPage,
});

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  under_ai_review: "secondary",
  finalized: "default",
  flagged_low_quality: "destructive",
  teacher_acknowledged: "secondary",
  rejected: "destructive",
};

function ProposalsListPage() {
  const fn = useServerFn(listMyProposals);
  const q = useQuery({ queryKey: ["my-proposals"], queryFn: () => fn() });

  return (
    <AppShell title="My curriculum proposals">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My curriculum proposals</h1>
        <p className="text-sm text-muted-foreground">
          Drafts and finalized edits you've made to AI-generated curricula for your assigned grade-subjects.
        </p>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !q.data || q.data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No proposals yet</CardTitle>
            <CardDescription>
              Open an academic year from your dashboard and click "Propose changes" on a curriculum to start editing.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {q.data.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Grade {p.grade} · {p.subject}</span>
                    <Badge variant={STATUS_COLORS[p.status] ?? "outline"} className="text-[10px]">
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                    {typeof p.ai_score === "number" && (
                      <span className="text-xs text-muted-foreground">AI {Math.round(p.ai_score * 100)}%</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Updated {new Date(p.updated_at ?? p.created_at).toLocaleString()}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/curriculum/$yearId/propose"
                    params={{ yearId: p.year_id }}
                    search={{ proposal: p.id }}
                  >
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
