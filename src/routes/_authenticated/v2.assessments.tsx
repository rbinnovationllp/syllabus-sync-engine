import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { V2Generator } from "@/components/V2Generator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/v2/assessments")({ component: AssessmentGeneratorPage });

function AssessmentGeneratorPage() {
  return (
    <AppShell title="Assessment Generator">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Intelligent Assessment Generator</h1><p className="text-sm text-muted-foreground">Create editable tests and exam drafts with marks, duration, difficulty, and Bloom balance.</p></div>
        <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
      </div>
      <V2Generator
        module="assessment_generator"
        title="Assessment generator"
        description="Generate editable class tests and exam papers by class, subject, exam type, chapter range, marks, duration, difficulty, and answer key."
        resourceTypes={["Class test", "Weekly test", "Unit test", "Half-yearly exam", "Mid-term exam", "Annual exam", "Practice paper", "Chapter-wise assessment"]}
        defaultPrompt="Create a syllabus-aligned question paper from the selected chapter range. Include clear instructions, marks distribution, difficulty balance, Bloom taxonomy distribution, and answer key."
      />
    </AppShell>
  );
}

