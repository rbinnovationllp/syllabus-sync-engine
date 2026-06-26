import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, ClipboardCheck, FileText, GraduationCap, LineChart, MessageSquareText, School, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/ai-leadership-suite")({
  head: () => ({
    meta: [
      { title: "AI Leadership Suite - CurriculumOS" },
      { name: "description", content: "Explore the AI Leadership Suite included in Plus plans for school planning, teacher support, content generation, assessments, simulations, and parent communication." },
    ],
  }),
  component: AiLeadershipSuitePage,
});

const modules = [
  {
    icon: School,
    title: "Principal Dashboard",
    text: "Gives school leaders a single view of academic health, syllabus readiness, risk alerts, AI activity, and planning gaps.",
  },
  {
    icon: GraduationCap,
    title: "Teacher Copilot",
    text: "Helps teachers draft lesson strategies, activities, homework, rubrics, projects, and classroom support material.",
  },
  {
    icon: FileText,
    title: "Content Studio",
    text: "Creates editable worksheets, notes, flashcards, projects, revision material, and answer keys for classroom use.",
  },
  {
    icon: ClipboardCheck,
    title: "Assessment Generator",
    text: "Prepares editable tests and exam drafts with marks, duration, difficulty balance, answer keys, and review-ready structure.",
  },
  {
    icon: LineChart,
    title: "Academic Digital Twin",
    text: "Runs what-if scenarios for lost teaching days, exam changes, teacher absence, and syllabus recovery planning.",
  },
  {
    icon: Users,
    title: "Teacher Intelligence",
    text: "Highlights teacher pacing, pending work, workload pressure, and areas where leadership support may be needed.",
  },
  {
    icon: Brain,
    title: "Student Intelligence",
    text: "Shows cohort-level learning risk and intervention signals without turning the product into a heavy student ERP.",
  },
  {
    icon: MessageSquareText,
    title: "Parent Communication Hub",
    text: "Drafts parent notices, progress updates, PTM messages, reminders, and multilingual communication for review before sending.",
  },
];

function AiLeadershipSuitePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="font-semibold tracking-tight">CurriculumOS</Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/pricing"><ArrowLeft className="mr-2 h-4 w-4" />Back to plans</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-14">
        <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-950 p-8 text-white shadow-sm">
          <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-teal-100">
            Included in Plus plans
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">AI Leadership Suite</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
            A practical AI workspace for school leaders and academic teams. It helps plan the academic year, support teachers, generate editable resources, prepare assessments, simulate disruptions, and communicate with parents.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Planning" value="faster" />
            <Stat label="Resources" value="editable" />
            <Stat label="Control" value="review-first" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <Card key={m.title} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{m.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{m.text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Built for school review, not blind automation</h2>
              <p className="mt-1 text-sm text-slate-600">
                Every AI output is editable. Schools review, adjust, save, export, or send only after human approval.
              </p>
            </div>
            <Button asChild>
              <Link to="/pricing"><Sparkles className="mr-2 h-4 w-4" />View Plus plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-300">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
