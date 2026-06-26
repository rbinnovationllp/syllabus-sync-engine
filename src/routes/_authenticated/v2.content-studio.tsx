import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { V2Generator } from "@/components/V2Generator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/v2/content-studio")({ component: ContentStudioPage });

function ContentStudioPage() {
  return (
    <AppShell title="AI Content Studio">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">AI Content Studio</h1><p className="text-sm text-muted-foreground">Generate editable worksheets, notes, flashcards, projects, and answer keys.</p></div>
        <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
      </div>
      <V2Generator
        module="content_studio"
        title="Content studio"
        description="Draft editable educational resources for classroom and revision use."
        resourceTypes={["Worksheet", "Flashcards", "Mind map", "Question bank", "Revision notes", "Project", "Activity", "Answer key"]}
        defaultPrompt="Create an editable worksheet with scaffolded questions, challenge tasks, and an answer key for the selected topic."
      />
    </AppShell>
  );
}
