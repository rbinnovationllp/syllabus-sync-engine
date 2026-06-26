import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { V2Generator } from "@/components/V2Generator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/v2/copilot")({ component: TeacherCopilotPage });

function TeacherCopilotPage() {
  return (
    <AppShell title="AI Teacher Copilot">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">AI Teacher Copilot</h1><p className="text-sm text-muted-foreground">Generate teaching strategies, classroom activities, homework, rubrics, and projects.</p></div>
        <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
      </div>
      <V2Generator
        module="teacher_copilot"
        title="Teacher copilot workspace"
        description="Create editable classroom support aligned to a grade, subject, and textbook context."
        resourceTypes={["Teaching strategy", "Classroom activity", "Worksheet", "Project", "Rubric", "Homework", "Practical exercise"]}
        defaultPrompt="Create a differentiated classroom plan for the next chapter, including activity, homework, and exit-ticket checks."
      />
    </AppShell>
  );
}
