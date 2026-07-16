import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { V2Generator } from "@/components/V2Generator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/v2/content-studio")({ component: ContentStudioPage });

function ContentStudioPage() {
  return (
    <AppShell title="AI Content Studio">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Teaching Resource Studio</h1>
          <p className="text-sm text-muted-foreground">
            Create chapter-list mapped teaching packs, worksheets, quizzes, activities, slide outlines, and interactive classroom templates using existing AI credits.
          </p>
        </div>
        <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
      </div>
      <V2Generator
        module="content_studio"
        title="Teaching resource studio"
        description="Draft review-ready resources that help Syllabus Synk move closer to a full teaching-learning ecosystem without increasing base subscription prices."
        resourceTypes={[
          "Chapter-list mapped teaching pack",
          "Activity-based lesson pack",
          "Worksheet",
          "Quiz and answer key",
          "Flashcards",
          "Mind map",
          "Question bank",
          "Revision notes",
          "Slide outline",
          "Project",
          "Experiment or demonstration",
          "Real-life example bank",
          "Diagram labeling activity",
          "Timeline activity",
          "Concept map",
          "Interactive classroom template",
          "Remedial practice pack",
          "Teacher training micro-module",
          "AI Future Force lab activity",
          "Answer key",
        ]}
        defaultPrompt="Create a chapter-list mapped teaching resource pack for the selected topic. Use official/open resources where available and school-provided chapter details for private publisher books. Include learning objectives, simple explanation, classroom activity, worksheet, quiz, answer key, real-life examples, differentiation support, and teacher review notes. Use existing Syllabus Synk AI credits; do not treat this as a separate subscription price increase."
      />
    </AppShell>
  );
}
