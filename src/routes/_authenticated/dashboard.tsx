import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyAcademicYears } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, BookLock, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchYears = useServerFn(listMyAcademicYears);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["my-academic-years"],
    queryFn: () => fetchYears(),
  });

  return (
    <AppShell title="Dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your academic years</h1>
          <p className="text-sm text-muted-foreground">Each year holds your school's calendar, capacity, and curriculum plan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/school/profile" })}>
            <BookLock className="h-4 w-4 mr-1" /> School profile
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/assignments" })}>
            <Users className="h-4 w-4 mr-1" /> Assignments
          </Button>
          <Button onClick={() => navigate({ to: "/onboarding" })}>
            <Plus className="h-4 w-4 mr-1" /> New academic year
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Start your first plan</CardTitle>
            <CardDescription>Run the 4-step onboarding to compute your instructional capacity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/onboarding" })}>Start onboarding</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((y) => {
            const school = Array.isArray(y.schools) ? y.schools[0] : y.schools;
            return (
              <Link
                key={y.id}
                to="/results/$yearId"
                params={{ yearId: y.id }}
                className="block"
              >
                <Card className="hover:border-primary transition-colors h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4" /> {y.label}
                    </CardTitle>
                    <CardDescription>{school?.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>{y.start_date} → {y.end_date}</div>
                    <div>{school?.country} · {school?.board?.toUpperCase()}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
