import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, BookOpen, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CurriculumOS — AI Operating System for School Leadership" },
      { name: "description", content: "Automate localized school academic planning, textbook alignment, and multi-teacher scheduling. Built for K-12 leaders worldwide." },
      { property: "og:title", content: "CurriculumOS — AI Operating System for School Leadership" },
      { property: "og:description", content: "Automate localized school academic planning, textbook alignment, and multi-teacher scheduling." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">CurriculumOS</span>
          <div className="flex gap-2">
            <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          The AI operating system for modern school leadership
        </h1>
        <p className="text-lg text-muted-foreground mt-6">
          Replace weeks of manual scheduling with bulletproof academic planning in minutes.
          Match textbook difficulty to your fee tier, balance multi-teacher workloads, and
          guarantee curriculum compliance — across CBSE, ICSE, IB, Cambridge, Common Core, and more.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Button size="lg" asChild><Link to="/auth">Start planning</Link></Button>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Calendar, title: "Capacity engine", body: "Calculates exact teaching days available after holidays, vacations, events, exams, training, and buffers." },
          { icon: BookOpen, title: "Smart book matching", body: "AI matches textbooks to your fee tier and region when you don't have them on hand." },
          { icon: Users, title: "Multi-teacher balance", body: "Distributes tough chapters so students never hit a homework wall." },
          { icon: Sparkles, title: "Recalibration", body: "One click re-engineers the year after closures, weather, or sports overruns." },
        ].map((f) => (
          <Card key={f.title}>
            <CardContent className="pt-6">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
