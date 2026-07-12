import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Calendar,
  BookOpen,
  Users,
  Sparkles,
  GraduationCap,
  Globe2,
  ShieldCheck,
  Zap,
  ClipboardList,
  LineChart,
  ArrowRight,
  CheckCircle2,
  Star,
  BrainCircuit,
} from "lucide-react";
import { createLead } from "@/lib/admin.functions";
import { getPublicSiteStats } from "@/lib/site-analytics.functions";
import { AcquisitionSourceFields } from "@/components/AcquisitionSourceFields";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CurriculumOS - AI Curriculum Planning for K-12 Schools" },
      {
        name: "description",
        content:
          "Plan an entire academic year in minutes. Capacity-aware scheduling, textbook alignment, multi-teacher balance, and exam-ready syllabus completion - for CBSE, ICSE, IB, Cambridge, Common Core and more.",
      },
      { property: "og:title", content: "CurriculumOS - AI Curriculum Planning for K-12 Schools" },
      {
        property: "og:description",
        content:
          "From holiday calendar to lesson plan in minutes. Built for school leaders worldwide.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.syllabus-synk.in/" },
    ],
    links: [{ rel: "canonical", href: "https://www.syllabus-synk.in/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <AiFutureWorkforce />
      <HowItWorks />
      <Boards />
      <Testimonials />
      <Contact />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-amber-500 text-white shadow-md">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight">CurriculumOS</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <a href="#features" className="hover:text-slate-900">
            Features
          </a>
          <a href="#ai-future-workforce" className="hover:text-slate-900">
            AI Future Workforce
          </a>
          <a href="#how" className="hover:text-slate-900">
            How it works
          </a>
          <a href="#boards" className="hover:text-slate-900">
            Curricula
          </a>
          <Link to="/partners" className="hover:text-slate-900">
            Partners
          </Link>
          <a href="#contact" className="hover:text-slate-900">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/auth" search={{ invite: undefined }}>
              Sign in
            </Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:opacity-95"
          >
            <Link to="/auth" search={{ invite: undefined }}>
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background gradients */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"
      />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -z-10 h-[480px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-500/30 via-indigo-500/30 to-amber-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="container mx-auto px-4 pt-20 pb-28 text-center text-white">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-white/80">AI Operating System for School Leadership</span>
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          Plan a flawless{" "}
          <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent">
            academic year
          </span>{" "}
          in minutes - not months.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
          CurriculumOS turns holidays, exams, events, and textbooks into a capacity-aware curriculum
          that guarantees syllabus completion across every class, teacher, and stream.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="bg-gradient-to-r from-amber-400 to-fuchsia-500 text-slate-950 font-semibold shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            <Link to="/auth" search={{ invite: undefined }}>
              Start planning free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-white/30 bg-white/5 text-white hover:bg-white/10"
          >
            <a href="#contact">Book a demo</a>
          </Button>
        </div>

        <PublicVisitorProof />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
          {[
            "Trusted by school leaders",
            "CBSE * ICSE * IB * Cambridge",
            "Secure & private",
            "Free pilot for your school",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t}
            </span>
          ))}
        </div>

        {/* Mock preview card */}
        <div className="mx-auto mt-14 max-w-5xl">
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/[0.02] p-2 shadow-2xl backdrop-blur">
            <div className="grid gap-3 rounded-xl bg-slate-950/70 p-4 sm:grid-cols-3">
              {[
                {
                  label: "Teaching days available",
                  value: "187",
                  trend: "after holidays & exams",
                  accent: "from-indigo-500 to-cyan-400",
                },
                {
                  label: "Syllabus completion",
                  value: "98%",
                  trend: "30 days pre-board",
                  accent: "from-emerald-500 to-lime-400",
                },
                {
                  label: "Teacher load balance",
                  value: "Yes Even",
                  trend: "across 14 classes",
                  accent: "from-fuchsia-500 to-amber-400",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left"
                >
                  <p className="text-[11px] uppercase tracking-wide text-white/50">{c.label}</p>
                  <p
                    className={`mt-2 bg-gradient-to-r ${c.accent} bg-clip-text text-3xl font-bold text-transparent`}
                  >
                    {c.value}
                  </p>
                  <p className="mt-1 text-xs text-white/60">{c.trend}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicVisitorProof() {
  const statsFn = useServerFn(getPublicSiteStats);
  const { data } = useQuery({
    queryKey: ["public-site-stats"],
    queryFn: () => statsFn(),
    staleTime: 5 * 60 * 1000,
  });

  const currentOpen = 1;
  const totalVisitors = (data?.totalVisitors ?? 176) + currentOpen;
  const totalVisits = (data?.totalVisits ?? 412) + currentOpen;
  const weekVisitors = (data?.visitors7d ?? 38) + currentOpen;

  const items = [
    {
      label: "School leaders exploring",
      value: totalVisitors.toLocaleString(),
      detail: "estimated launch interest + every live visit",
    },
    {
      label: "Product page views",
      value: totalVisits.toLocaleString(),
      detail: "estimated launch reach + every page open",
    },
    {
      label: "This week",
      value: weekVisitors.toLocaleString(),
      detail: "estimated weekly interest + every visit",
    },
  ];

  return (
    <div className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left shadow-lg shadow-black/10 backdrop-blur"
        >
          <p className="text-[11px] uppercase tracking-wide text-white/55">{item.label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{item.value}</p>
          <p className="text-xs text-white/55">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
function Logos() {
  const items = ["CBSE", "ICSE", "IB", "Cambridge", "Common Core", "British", "Australian"];
  return (
    <section className="border-y border-slate-100 bg-slate-50/60 py-8">
      <div className="container mx-auto px-4">
        <p className="text-center text-xs uppercase tracking-widest text-slate-500">
          Trusted across curricula worldwide
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-slate-400">
          {items.map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Calendar,
    title: "Capacity engine",
    body: "Automatically subtracts holidays, vacations, exams, events, training & buffers - never plans beyond reality.",
    color: "from-indigo-500 to-violet-500",
  },
  {
    icon: BookOpen,
    title: "Textbook intelligence",
    body: "Aligns plans to your exact edition, author and publisher. Auto-recommends books by region & fee tier.",
    color: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: Users,
    title: "Multi-teacher balance",
    body: "Prevents student overload by syncing tough chapters across subjects.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Sparkles,
    title: "One-click recalibration",
    body: "Weather closure? Sports overrun? Re-engineer the year while protecting revision time.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Globe2,
    title: "Country-aware sessions",
    body: "Knows India runs Apr-Mar, USA Aug-Jun, UK Sep-Jul. Subjects & streams match local policy.",
    color: "from-sky-500 to-blue-500",
  },
  {
    icon: ShieldCheck,
    title: "Syllabus guarantee",
    body: "30/45/60-day pre-exam completion rules built-in for primary, secondary & senior secondary.",
    color: "from-rose-500 to-red-500",
  },
  {
    icon: BrainCircuit,
    title: "AI Future Workforce",
    body: "Optional AI education add-on with grade-wise learning paths, weekly AI class planning, monthly updates, teacher readiness, and future-career projects.",
    color: "from-violet-500 to-fuchsia-500",
  },
];

function Features() {
  return (
    <section id="features" className="container mx-auto px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Why CurriculumOS
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Everything an academic leader needs
        </h2>
        <p className="mt-4 text-slate-600">
          From the first holiday entry to the final lesson plan - one intelligent system replaces
          six spreadsheets.
        </p>
      </div>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card
            key={f.title}
            className="group relative overflow-hidden border-slate-200 transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div
              aria-hidden
              className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${f.color} opacity-10 transition group-hover:opacity-20`}
            />
            <CardContent className="relative pt-7">
              <div
                className={`inline-flex rounded-xl bg-gradient-to-br ${f.color} p-2.5 text-white shadow-md`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function AiFutureWorkforce() {
  const pathways = [
    "Classes 1-5: AI awareness, patterns, smart devices, and responsible technology.",
    "Classes 6-8: data labeling, machine learning basics, chatbots, image recognition, ethics, bias, and privacy.",
    "Classes 9-12: Python for AI, generative AI, prompt engineering, AI agents, machine learning, and capstone projects.",
  ];
  const demoPlan = [
    ["Week 1", "AI awareness and key concepts", "Teacher-led discussion, examples, safety norms"],
    ["Week 2", "Guided demonstration", "Smart tool, data, chatbot, or image-recognition activity"],
    ["Week 3", "Classroom practice", "Worksheet, mini-project, group activity, or lab task"],
    ["Week 4", "Review and assessment", "Reflection, short quiz, presentation, and next-step plan"],
  ];
  const careers = [
    "AI engineer",
    "Data analyst",
    "Machine learning specialist",
    "Prompt engineer",
    "Robotics and automation",
    "AI ethics and governance",
  ];

  return (
    <section id="ai-future-workforce" className="bg-slate-950 py-24 text-white">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              Future-ready education ecosystem
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              World-class AI Future Force Curriculum Planner for Classes 1-12.
            </h2>
            <p className="mt-5 max-w-3xl text-white/70">
              Yes, Syllabus Synk includes a comprehensive web-based AI Future Force Curriculum Planner
              designed to create age-appropriate AI education courses from Classes 1 to 12. It helps
              schools introduce AI education through one or two periods per week without disturbing
              regular academics, exams, or revision schedules.
            </p>
            <div className="mt-8 grid gap-3">
              {pathways.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-white/78">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-gradient-to-r from-amber-400 to-fuchsia-500 font-semibold text-slate-950 hover:opacity-95"
              >
                <Link to="/auth" search={{ invite: undefined }}>
                  Explore AI curriculum <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                <a href="#contact">Talk to our team</a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-semibold">One-month demo plan</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Schools can request a one-month sample plan for selected classes. The plan adapts to
                once-a-week or twice-a-week availability and shows topics, activities, assessments,
                and teacher delivery notes for the month.
              </p>
              <div className="mt-4 grid gap-2">
                {demoPlan.map(([week, title, detail]) => (
                  <div key={week} className="rounded-lg bg-white/10 p-3 text-sm">
                    <div className="font-medium">{week}: {title}</div>
                    <div className="mt-1 text-xs text-white/65">{detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <BrainCircuit className="mt-1 h-5 w-5 text-amber-300" />
                <div>
                  <h3 className="font-semibold">Curriculum commitment</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Our AI Future Workforce Team continuously monitors global developments in
                    Artificial Intelligence and emerging technologies. The curriculum for senior
                    students will be regularly updated to incorporate the latest innovations, industry
                    practices, and future workforce requirements.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 text-fuchsia-300" />
                <div>
                  <h3 className="font-semibold">Teacher professional development</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Artificial Intelligence is evolving rapidly across the world. Schools should
                    encourage their Computer Science and Technology teachers to continuously enhance
                    their knowledge and skills in AI so students receive relevant and future-ready
                    education.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-semibold">Career awareness built in</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {careers.map((career) => (
                  <span key={career} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                    {career}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Tell us your school",
      d: "Country, board, fee tier, calendar dates.",
      icon: GraduationCap,
    },
    {
      n: "02",
      t: "Drop in your textbooks",
      d: "Or let AI recommend books by region.",
      icon: BookOpen,
    },
    {
      n: "03",
      t: "Block holidays & events",
      d: "System computes real teaching capacity.",
      icon: Calendar,
    },
    {
      n: "04",
      t: "Generate the year",
      d: "Calendars, lesson plans, training, exports.",
      icon: Zap,
    },
    {
      n: "05",
      t: "Generate class test / exam paper",
      d: "Select subject, class, exam type, and chapter range so teachers can choose from which chapter to which chapter the paper should be generated.",
      icon: ClipboardList,
    },
    {
      n: "06",
      t: "Add AI Future Workforce",
      d: "Optional AI curriculum with one or two weekly classes, grade-wise preview, teacher readiness, monthly updates, and future-ready projects.",
      icon: BrainCircuit,
    },
  ];
  return (
    <section id="how" className="bg-gradient-to-b from-white via-indigo-50/40 to-white py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From blank slate to bulletproof plan
          </h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent">
                {s.n}
              </span>
              <s.icon className="absolute right-5 top-5 h-5 w-5 text-slate-300" />
              <h3 className="mt-3 font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Boards() {
  const list = [
    "CBSE",
    "ICSE",
    "State Boards",
    "IB",
    "Cambridge",
    "British",
    "American",
    "Australian",
    "Canadian",
    "Custom",
  ];
  return (
    <section id="boards" className="container mx-auto px-4 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
            Built for every curriculum
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            10+ boards. Local subjects. Country-aware sessions.
          </h2>
          <p className="mt-4 text-slate-600">
            Indian schools start in April. American schools start in August. CurriculumOS already
            knows - and ships the right subject catalog, streams, and completion rules out of the
            box.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {list.map((b) => (
              <span
                key={b}
                className="rounded-full bg-gradient-to-r from-indigo-50 to-fuchsia-50 px-3.5 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-amber-400 p-1 shadow-2xl">
            <div className="rounded-[1.4rem] bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Grade 12 - Science (PCM)</h3>
                <LineChart className="h-5 w-5 text-indigo-500" />
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Physics", "6 / wk", "from-indigo-500 to-violet-500"],
                  ["Chemistry", "6 / wk", "from-fuchsia-500 to-pink-500"],
                  ["Mathematics", "8 / wk", "from-amber-500 to-orange-500"],
                  ["English", "4 / wk", "from-emerald-500 to-teal-500"],
                ].map(([s, p, c]) => (
                  <li
                    key={s}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${c}`} />
                      {s}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    {
      q: "What used to take our HOD team three weeks now takes one afternoon.",
      a: "Principal, CBSE school, Delhi",
    },
    {
      q: "Finally a tool that understands April-to-March sessions and rebate cycles.",
      a: "Academic Director, ICSE network",
    },
    {
      q: "Multi-teacher load balancing alone is worth the subscription.",
      a: "Head of Middle School, IB",
    },
    {
      q: "The AI Future Force roadmap helps us introduce AI without disturbing regular academics. It gives leadership a clear way to prepare students for future careers.",
      a: "School Leader, K-12 innovation program",
    },
  ];
  return (
    <section className="bg-slate-950 py-24 text-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
            Loved by academic leaders
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Schools planning smarter
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {t.map((x, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
            >
              <div className="flex gap-0.5 text-amber-300">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-white/85">"{x.q}"</p>
              <p className="mt-4 text-xs text-white/50">- {x.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const fn = useServerFn(createLead);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    school_name: "",
    country: "",
    board: "",
    message: "",
    acquisition_source: "",
    acquisition_detail: "",
    partner_code: "",
    referred_by: "",
    request_ai_future_force_demo: false,
    demo_classes: "",
    demo_frequency: "once",
    demo_available_periods: "",
    demo_contact_details: "",
  });
  const m = useMutation({
    mutationFn: () => {
      const demoDetails = form.request_ai_future_force_demo
        ? [
            "",
            "AI Future Force one-month demo plan request:",
            `School name: ${form.school_name || "-"}`,
            `Board and location: ${[form.board, form.country].filter(Boolean).join(", ") || "-"}`,
            `Classes required: ${form.demo_classes || "-"}`,
            `Preferred frequency: ${form.demo_frequency === "twice" ? "Twice a week" : "Once a week"}`,
            `Available periods during the month: ${form.demo_available_periods || "-"}`,
            `Contact person details: ${form.demo_contact_details || form.name || "-"}`,
          ].join("\n")
        : "";
      const { request_ai_future_force_demo, demo_classes, demo_frequency, demo_available_periods, demo_contact_details, ...lead } = form;
      return fn({ data: { ...lead, message: `${form.message || ""}${demoDetails}`.trim() } });
    },
    onSuccess: () => {
      toast.success("Thanks! We'll be in touch within one business day.");
      setForm({
        name: "",
        email: "",
        phone: "",
        school_name: "",
        country: "",
        board: "",
        message: "",
        acquisition_source: "",
        acquisition_detail: "",
        partner_code: "",
        referred_by: "",
        request_ai_future_force_demo: false,
        demo_classes: "",
        demo_frequency: "once",
        demo_available_periods: "",
        demo_contact_details: "",
      });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not submit. Try again."),
  });
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <section id="contact" className="relative isolate overflow-hidden py-24">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50"
      />
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Talk to us
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Book a 20-minute walkthrough
            </h2>
            <p className="mt-4 text-slate-600">
              Tell us about your school. We'll send a tailored demo and a sample academic plan for
              your board.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              {[
                "Personalized to your curriculum & calendar",
                "Real teaching-capacity audit on the call",
                "No credit card required",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600">
              Prefer email? Reach support at{" "}
              <a
                href="mailto:support@syllabus-synk.in"
                className="font-medium text-indigo-600 hover:underline"
              >
                support@syllabus-synk.in
              </a>
              .
            </p>
          </div>
          <Card className="border-slate-200 shadow-xl">
            <CardContent className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  m.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="n">Your name *</Label>
                    <Input id="n" required value={form.name} onChange={set("name")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e">Email *</Label>
                    <Input
                      id="e"
                      type="email"
                      required
                      value={form.email}
                      onChange={set("email")}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="p">Phone</Label>
                    <Input id="p" value={form.phone} onChange={set("phone")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s">School</Label>
                    <Input id="s" value={form.school_name} onChange={set("school_name")} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="c">Country</Label>
                    <Input id="c" value={form.country} onChange={set("country")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b">Board</Label>
                    <Input
                      id="b"
                      value={form.board}
                      onChange={set("board")}
                      placeholder="CBSE, IB, ..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m">How can we help?</Label>
                  <Textarea id="m" rows={3} value={form.message} onChange={set("message")} />
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.request_ai_future_force_demo}
                    onChange={(e) => setForm({ ...form, request_ai_future_force_demo: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">
                      Request a One-Month AI Future Force Course Demo Plan
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      Share your classes and available periods so our team can prepare a sample AI course plan.
                    </span>
                  </span>
                </label>

                {form.request_ai_future_force_demo && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-classes">Classes required</Label>
                        <Input
                          id="demo-classes"
                          value={form.demo_classes}
                          onChange={set("demo_classes")}
                          placeholder="Classes 1-5, 6-8, 9-12..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-frequency">Preferred frequency</Label>
                        <select
                          id="demo-frequency"
                          value={form.demo_frequency}
                          onChange={set("demo_frequency")}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="once">Once a week</option>
                          <option value="twice">Twice a week</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor="demo-periods">Available periods during the month</Label>
                      <Textarea
                        id="demo-periods"
                        rows={2}
                        value={form.demo_available_periods}
                        onChange={set("demo_available_periods")}
                        placeholder="Example: Mondays period 3, Thursdays period 5, 4 periods total..."
                      />
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor="demo-contact">Contact person's details</Label>
                      <Textarea
                        id="demo-contact"
                        rows={2}
                        value={form.demo_contact_details}
                        onChange={set("demo_contact_details")}
                        placeholder="Name, designation, phone, email, preferred demo mode..."
                      />
                    </div>
                  </div>
                )}
                <AcquisitionSourceFields
                  value={form}
                  onChange={(next) => setForm({ ...form, ...next })}
                />
                <Button
                  type="submit"
                  disabled={m.isPending}
                  className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:opacity-95"
                >
                  {m.isPending ? "Sending..." : "Request a demo"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container mx-auto grid gap-6 px-4 py-10 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">CurriculumOS</div>
          <p>AI curriculum planning for K-12 schools worldwide.</p>
          <p>
            Website:{" "}
            <a href="https://www.syllabus-synk.in" className="hover:text-slate-800">
              https://www.syllabus-synk.in
            </a>
          </p>
          <p>
            Support:{" "}
            <a href="mailto:support@syllabus-synk.in" className="hover:text-slate-800">
              support@syllabus-synk.in
            </a>
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Company address</div>
          <p>Rashi Bhartiya Innovation LLP</p>
          <p>
            Email:{" "}
            <a href="mailto:support@syllabus-synk.in" className="hover:text-slate-800">
              support@syllabus-synk.in
            </a>
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1 lg:text-right">
          <div className="flex flex-wrap gap-5 lg:justify-end">
            <a href="#features" className="hover:text-slate-800">
              Features
            </a>
            <Link to="/partners" className="hover:text-slate-800">
              Refer & earn
            </Link>
            <a href="#contact" className="hover:text-slate-800">
              Contact
            </a>
            <Link to="/auth" search={{ invite: undefined }} className="hover:text-slate-800">
              Sign in
            </Link>
          </div>
          <p>(c) {new Date().getFullYear()} CurriculumOS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



