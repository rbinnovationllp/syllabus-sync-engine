import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lock, Pencil, Loader2, History } from "lucide-react";
import { listMyAcademicYears } from "@/lib/onboarding.functions";
import { getSchoolProfile, listProfileAuditLog } from "@/lib/school-profile.functions";

const searchSchema = z.object({ year: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/school/profile")({
  head: () => ({ meta: [{ title: "Master School Profile — CurriculumOS" }] }),
  validateSearch: searchSchema,
  component: SchoolProfilePage,
});

function SchoolProfilePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const listYears = useServerFn(listMyAcademicYears);
  const fetchProfile = useServerFn(getSchoolProfile);
  const fetchAudit = useServerFn(listProfileAuditLog);

  const years = useQuery({ queryKey: ["my-years"], queryFn: () => listYears() });

  const yearId = search.year ?? years.data?.[0]?.id;
  const profile = useQuery({
    queryKey: ["school-profile", yearId],
    queryFn: () => fetchProfile({ data: { academic_year_id: yearId! } }),
    enabled: !!yearId,
  });
  const audit = useQuery({
    queryKey: ["profile-audit"],
    queryFn: () => fetchAudit({ data: { limit: 30 } }),
    enabled: !!profile.data?.can_edit,
  });

  if (years.isLoading || (yearId && profile.isLoading)) {
    return (
      <AppShell title="Master School Profile">
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!yearId) {
    return (
      <AppShell title="Master School Profile">
        <Card>
          <CardHeader>
            <CardTitle>No academic year yet</CardTitle>
            <CardDescription>Run onboarding to create your school's master profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/onboarding" })}>Start onboarding</Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const p = profile.data!;
  const school = p.school as any;
  const year = p.year as any;

  return (
    <AppShell title="Master School Profile">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{school?.name}</h1>
          <p className="text-sm text-muted-foreground">
            Read-only source of truth for capacity, curriculum, and AI plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(years.data ?? []).length > 1 && (
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={yearId}
              onChange={(e) => navigate({ to: "/school/profile", search: { year: e.target.value } })}
            >
              {(years.data ?? []).map((y: any) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          )}
          {p.can_edit ? (
            <Button onClick={() => navigate({ to: "/onboarding" })}>
              <Pencil className="h-4 w-4 mr-1" /> Edit profile
            </Button>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> Admin-only edits
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">School</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row k="Board" v={school?.board?.toUpperCase()} />
            <Row k="Country" v={school?.country} />
            <Row k="State" v={school?.state_province} />
            <Row k="City" v={school?.city} />
            <Row k="Fee tier" v={school?.fee_tier} />
            <Row k="Currency" v={school?.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic year — {year.label}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row k="Start" v={year.start_date} />
            <Row k="End" v={year.end_date} />
            <Row k="Working days/week" v={year.working_days_per_week} />
            <Row k="Periods/day" v={year.periods_per_day} />
            <Row k="Period duration" v={`${year.period_duration_minutes} min`} />
            <Row k="Buffer days" v={year.buffer_days} />
          </CardContent>
        </Card>

        <ProfileList title={`Holidays (${p.holidays.length})`} rows={p.holidays.map((h: any) => ({ a: h.date, b: h.name }))} />
        <ProfileList title={`Vacations (${p.vacations.length})`} rows={p.vacations.map((v: any) => ({ a: `${v.start_date} → ${v.end_date}`, b: v.name }))} />
        <ProfileList title={`Events (${p.events.length})`} rows={p.events.map((e: any) => ({ a: e.date, b: `${e.name}${e.prep_days ? ` (+${e.prep_days}d prep)` : ""}` }))} />
        <ProfileList title={`Exam windows (${p.exams.length})`} rows={p.exams.map((e: any) => ({ a: `${e.start_date} → ${e.end_date}`, b: e.name }))} />
        <ProfileList title={`Training days (${p.training.length})`} rows={p.training.map((t: any) => ({ a: t.date, b: t.name ?? "Teacher training" }))} />
        <ProfileList title={`Subjects (${p.grade_subjects.length})`} rows={p.grade_subjects.map((g: any) => ({ a: `Grade ${g.grade}`, b: `${g.subject} — ${g.periods_per_week}/wk` }))} />
      </div>

      {p.textbooks.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Textbooks ({p.textbooks.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Publisher</TableHead><TableHead>Edition</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.textbooks.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{t.author ?? "—"}</TableCell>
                    <TableCell>{t.publisher ?? "—"}</TableCell>
                    <TableCell>{t.edition_year ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {p.can_edit && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Recent profile changes</CardTitle>
            <CardDescription>Every admin edit to master data is logged.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {audit.isLoading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : !audit.data || audit.data.length === 0 ? (
              <div className="text-muted-foreground">No changes recorded yet.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Table</TableHead></TableRow></TableHeader>
                <TableBody>
                  {audit.data.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                      <TableCell>{row.actor_email ?? "—"}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.target_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v ?? "—"}</span>
    </div>
  );
}

function ProfileList({ title, rows }: { title: string; rows: { a: string; b: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {rows.length === 0 ? (
          <div className="text-muted-foreground">None.</div>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-auto">
            {rows.slice(0, 50).map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted-foreground whitespace-nowrap">{r.a}</span>
                <span className="text-right">{r.b}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
