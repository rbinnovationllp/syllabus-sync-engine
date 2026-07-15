import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  GraduationCap,
  IndianRupee,
  Users,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Share2,
  Wallet,
  HandshakeIcon,
} from "lucide-react";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Become a Partner - Earn 10% Recurring with CurriculumOS" },
      {
        name: "description",
        content:
          "Refer schools to CurriculumOS and earn 10% recurring commission on every subscription, for as long as they stay subscribed. No cap. Monthly payouts.",
      },
      {
        property: "og:title",
        content: "Partner with CurriculumOS - 10% recurring referral commission",
      },
      {
        property: "og:description",
        content:
          "Educators, consultants and edtech influencers - turn your network into recurring income.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.syllabus-synk.in/partners" },
    ],
    links: [{ rel: "canonical", href: "https://www.syllabus-synk.in/partners" }],
  }),
  component: PartnersLanding,
});

function PartnersLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <Nav />
      <Hero />
      <HowItPays />
      <WhoFits />
      <Steps />
      <Terms />
      <FinalCTA />
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/">Back to site</Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:opacity-95"
          >
            <Link to="/auth" search={{ invite: undefined }}>
              Become a partner <ArrowRight className="ml-1 h-4 w-4" />
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
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"
      />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -z-10 h-[480px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400/30 via-fuchsia-500/30 to-indigo-500/30 blur-3xl"
      />

      <div className="container mx-auto px-4 pt-20 pb-24 text-center text-white">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-white/80">CurriculumOS Partner Program</span>
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          Earn{" "}
          <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent">
            10% recurring
          </span>{" "}
          for every school you refer.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
          Help schools plan their academic year in minutes - and earn a 10% commission on every
          subscription payment they make, every month, for as long as they remain a customer.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="bg-gradient-to-r from-amber-400 to-fuchsia-500 text-slate-950 font-semibold shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            <Link to="/auth" search={{ invite: undefined }}>
              Join the partner program <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-white/30 bg-white/5 text-white hover:bg-white/10"
          >
            <a href="#terms">Read the terms</a>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
          {[
            "10% lifetime commission",
            "Monthly payouts",
            "90-day cookie window",
            "No cap, no minimums to start",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItPays() {
  const tiers = [
    {
      plan: "Retail (1 class)",
      price: "Rs 499 / mo",
      earn: "Rs 50",
      note: "per month per referral",
    },
    {
      plan: "Primary Bundle",
      price: "Rs 4,999 / mo",
      earn: "Rs 500",
      note: "per month per referral",
    },
    {
      plan: "High School Bundle",
      price: "Rs 9,999 / mo",
      earn: "Rs 1,000",
      note: "per month per referral",
    },
    {
      plan: "Enterprise (multi-campus)",
      price: "Custom",
      earn: "10%",
      note: "of contract value, recurring",
    },
  ];
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          What you earn
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          10% of every successful payment
        </h2>
        <p className="mt-4 text-slate-600">
          Refer ten schools on the Primary Bundle and earn Rs 5,000 every month - automatically -
          for as long as they stay subscribed.
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <Card key={t.plan} className="border-slate-200">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t.plan}</p>
              <p className="mt-2 text-sm text-slate-600">School pays {t.price}</p>
              <p className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-3xl font-bold text-transparent">
                {t.earn}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Indicative figures. Final commission is calculated as 10% of the net invoice value the
        active payment gateway settles for each referred school.
      </p>
    </section>
  );
}

function WhoFits() {
  const who = [
    {
      icon: GraduationCap,
      t: "Educators & ex-principals",
      d: "Recommend to schools in your network - earn while you mentor.",
    },
    {
      icon: Users,
      t: "Edtech consultants",
      d: "Add CurriculumOS to your stack and monetise every implementation.",
    },
    {
      icon: Share2,
      t: "Edu-creators & influencers",
      d: "Share your link in newsletters, YouTube, LinkedIn - own the funnel.",
    },
    {
      icon: HandshakeIcon,
      t: "Education NGOs",
      d: "Fund your programs with recurring revenue from school partners.",
    },
  ];
  return (
    <section className="bg-gradient-to-b from-white via-indigo-50/40 to-white py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600">
            Who it's for
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            If schools listen to you, this is for you
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {who.map((w) => (
            <div key={w.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-2.5 text-white">
                <w.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{w.t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{w.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { n: "01", t: "Sign up free", d: "Create your CurriculumOS account.", icon: Sparkles },
    {
      n: "02",
      t: "Activate partner mode",
      d: "Accept the NDA & terms - get a unique referral link in seconds.",
      icon: ShieldCheck,
    },
    {
      n: "03",
      t: "Share your link",
      d: "WhatsApp, email, LinkedIn - every click is tracked for 90 days.",
      icon: Share2,
    },
    {
      n: "04",
      t: "Get paid monthly",
      d: "10% lands in your partner ledger on every successful invoice.",
      icon: Wallet,
    },
  ];
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Live in under five minutes
        </h2>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
    </section>
  );
}

function Terms() {
  const items = [
    "Commission is 10% of the net invoice amount successfully settled by the active payment gateway. Refunds and chargebacks reverse the corresponding commission.",
    "Attribution is sticky: the first valid referral code captured at signup wins, for the full lifetime of that school's subscription.",
    'Cookie window: 90 days from first click. Self-referrals, fraudulent traffic, paid brand bidding on "CurriculumOS" keywords, and incentivised signups are not permitted.',
    "Payouts are released monthly once your ledger crosses Rs 2,000 (or equivalent). Below the threshold, balance rolls forward.",
    "All partners accept a short NDA and code-of-conduct on activation. Breach may forfeit accrued and future commissions after a show-cause notice.",
    "If a referred school signs up without a referral code attributed, the referral defaults to the house partner of record and no third-party commission is paid.",
  ];
  return (
    <section id="terms" className="bg-slate-50 py-24">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
            Partner terms - plain English
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Fair, transparent, and built to last
          </h2>
        </div>
        <ul className="mt-10 space-y-4">
          {items.map((x) => (
            <li
              key={x}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-slate-500">
          Full legal terms are presented and accepted in-app when you activate partner mode.
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden py-24">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-amber-500"
      />
      <div className="container mx-auto px-4 text-center text-white">
        <IndianRupee className="mx-auto h-10 w-10 opacity-80" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Turn your network into recurring income
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85">
          No cap. No long forms. Sign up, accept the terms, and start sharing.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            asChild
            className="bg-white text-slate-900 font-semibold hover:bg-white/90"
          >
            <Link to="/auth" search={{ invite: undefined }}>
              Become a partner now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          (c) {new Date().getFullYear()} CurriculumOS - Rashi Bhartiya Innovation LLP. All rights
          reserved.
        </p>
        <div className="flex gap-5">
          <Link to="/" className="hover:text-slate-800">
            Home
          </Link>
          <Link to="/pricing" className="hover:text-slate-800">
            Pricing
          </Link>
          <a href="mailto:support@syllabus-synk.in" className="hover:text-slate-800">
            support@syllabus-synk.in
          </a>
        </div>
      </div>
    </footer>
  );
}
