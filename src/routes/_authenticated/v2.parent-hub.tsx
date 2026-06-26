import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { generateParentCommunication } from "@/lib/v2.phase2.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/v2/parent-hub")({ component: ParentHubPage });

function extractDateTime(prompt: string) {
  const date = prompt.match(/\b(\d{1,2}\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4})\b/i)?.[1];
  const time = prompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|noon)?)\b/i)?.[1];
  return { date, time };
}

function localParentDraft({
  communicationType,
  audience,
  prompt,
}: {
  communicationType: string;
  audience: string;
  language: string;
  prompt: string;
}) {
  const lower = `${communicationType} ${prompt}`.toLowerCase();
  const { date, time } = extractDateTime(prompt);
  const isPtm = lower.includes("ptm") || lower.includes("parent teacher") || lower.includes("parent-teacher");
  const isExam = lower.includes("exam") || lower.includes("test") || lower.includes("assessment");
  const isHoliday = lower.includes("holiday") || lower.includes("vacation") || lower.includes("closure");
  const isHomework = lower.includes("homework") || lower.includes("assignment");

  if (isPtm) {
    return [
      `Subject: Parent-Teacher Meeting Notice`,
      "",
      `Dear ${audience},`,
      "",
      "This is to inform you that a Parent-Teacher Meeting has been scheduled for your ward's class.",
      "",
      date ? `Date: ${date}` : "Date: As per school schedule",
      time ? `Time: ${time}` : "Time: As per school schedule",
      "Venue: School campus",
      "",
      "You are requested to attend the meeting and discuss your ward's academic progress, classroom participation, homework completion, and areas where additional support may be helpful.",
      "",
      "Your presence will help us work together for the student's continued improvement.",
      "",
      "Regards,",
      "Academic Team",
    ].join("\n");
  }

  if (isExam) {
    return [
      `Subject: Examination Reminder`,
      "",
      `Dear ${audience},`,
      "",
      "This is a reminder regarding the upcoming examination schedule.",
      "",
      "Please ensure that your ward follows a regular revision routine, brings the required stationery, and reaches school on time.",
      "",
      "Students are advised to revise the completed syllabus carefully and clarify doubts with their teachers before the examination.",
      "",
      "Regards,",
      "Academic Team",
    ].join("\n");
  }

  if (isHoliday) {
    return [
      `Subject: Holiday Notice`,
      "",
      `Dear ${audience},`,
      "",
      "This is to inform you about the upcoming holiday/closure as per the school calendar.",
      "",
      "Classes will resume as per the regular schedule after the holiday. Students are requested to complete any assigned work and revise the topics covered in class.",
      "",
      "Regards,",
      "Academic Team",
    ].join("\n");
  }

  if (isHomework) {
    return [
      `Subject: Homework and Study Routine Update`,
      "",
      `Dear ${audience},`,
      "",
      "We request your support in helping your ward maintain a regular homework and study routine.",
      "",
      "Please encourage your ward to complete assignments on time, revise the daily lessons, and inform the class teacher if any academic support is required.",
      "",
      "Regards,",
      "Academic Team",
    ].join("\n");
  }

  return [
    `Subject: ${communicationType}`,
    "",
    `Dear ${audience},`,
    "",
    "We would like to share the following academic update with you.",
    "",
    prompt.replace(/^prepare\s+(a\s+)?/i, "").replace(/\.$/, "") + ".",
    "",
    "Kindly take note of the above information and contact the school if any clarification is required.",
    "",
    "Regards,",
    "Academic Team",
  ].join("\n");
}

function ParentHubPage() {
  const fn = useServerFn(generateParentCommunication);
  const [communicationType, setCommunicationType] = useState("Monthly progress update");
  const [audience, setAudience] = useState("Grade 8 parents");
  const [language, setLanguage] = useState("English");
  const [prompt, setPrompt] = useState("Prepare a warm parent message about homework consistency, revision discipline, and upcoming academic support.");
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);

  const generate = useMutation({
    mutationFn: () => fn({ data: { communication_type: communicationType, audience, language, prompt, save: true } }),
    onSuccess: (result: any) => {
      const serverLooksGeneric = typeof result.content === "string" && result.content.includes("This is a") && result.content.includes(prompt);
      if (serverLooksGeneric) {
        setDraft({ title: `${communicationType} for ${audience}`, content: localParentDraft({ communicationType, audience, language, prompt }) });
      } else {
        setDraft({ title: result.title, content: result.content });
      }
      toast.success("Parent draft generated");
    },
    onError: (error: any) => {
      setDraft({
        title: `${communicationType} for ${audience}`,
        content: localParentDraft({ communicationType, audience, language, prompt }),
      });
      toast.warning(error?.message ? `Local draft created. Server save failed: ${error.message}` : "Local draft created. Server save failed.");
    },
  });

  function handleGenerate() {
    setDraft({
      title: `${communicationType} for ${audience}`,
      content: localParentDraft({ communicationType, audience, language, prompt }),
    });
    generate.mutate();
  }

  return (
    <AppShell title="Parent Communication Hub">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parent Communication Hub</h1>
          <p className="text-sm text-muted-foreground">Generate editable notices, progress updates, reminders, and parent messages.</p>
        </div>
        <Button asChild variant="outline"><Link to={"/v2/student-intelligence" as any}>Student Intelligence</Link></Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Message brief</CardTitle><CardDescription>Draft multilingual parent communication for review before sending.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Communication type</Label><Input value={communicationType} onChange={(e) => setCommunicationType(e.target.value)} /></div>
            <div className="space-y-2"><Label>Audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
            <div className="space-y-2"><Label>Language</Label><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></div>
            <div className="space-y-2"><Label>Request</Label><Textarea rows={7} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
            <Button className="w-full" onClick={handleGenerate} disabled={generate.isPending}>
              <Send className="mr-2 h-4 w-4" /> {generate.isPending ? "Drafting..." : "Generate parent draft"}
            </Button>
          </CardContent>
        </Card>

        <Card className="min-h-[620px]">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><CardTitle>{draft?.title ?? "Editable parent message"}</CardTitle><CardDescription>Review and adjust before using in WhatsApp, email, or circulars.</CardDescription></div>
              <Badge variant="secondary">{language}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {draft ? (
              <Textarea className="min-h-[480px] whitespace-pre-wrap text-sm leading-6" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            ) : (
              <div className="flex min-h-[480px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                Your editable parent communication will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
