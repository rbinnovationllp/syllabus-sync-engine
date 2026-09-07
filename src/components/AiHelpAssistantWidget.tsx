import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAiHelpAssistant } from "@/lib/ai-help.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, Send, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const starterPrompts = [
  "What is Syllabus Synk?",
  "Show a one-month AI Future Force plan",
  "Request an AI Future Force demo",
  "How can schools add AI classes?",
];

export function AiHelpAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi, I am Ask Synk AI. Ask me about Syllabus Synk, AI Future Force for Classes 1-12, demo plans, pricing, implementation, dashboards, or curriculum planning.",
    },
  ]);
  const askFn = useServerFn(askAiHelpAssistant);
  const page = typeof window === "undefined" ? "" : window.location.pathname;

  const visibleHistory = useMemo(() => messages.slice(-8), [messages]);

  const ask = useMutation({
    mutationFn: async (message: string) => askFn({ data: { message, page, history: visibleHistory } }),
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    },
    retry: false,
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ask Synk AI is temporarily unavailable. Please try again later, or email support@syllabus-synk.in for help." },
      ]);
    },
  });

  function submit(message = input) {
    const trimmed = message.trim();
    if (!trimmed || ask.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    ask.mutate(trimmed);
  }

  return (
    <div className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[9999] pointer-events-none sm:right-4 sm:bottom-4">
      {open && (
        <div className="pointer-events-auto mb-3 flex h-[min(560px,calc(100vh-96px))] w-[calc(100vw-24px)] max-w-[420px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:w-[380px]">
          <div className="flex items-center justify-between border-b bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white/10 p-2"><Bot className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-semibold">Ask Synk AI</div>
                <div className="text-xs text-slate-300">Visitor guidance and demo help</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, index) => (
              <div key={index} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="grid gap-2 border-t px-4 py-3">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-md border px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => submit(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask Synk AI..."
                rows={2}
                className="min-h-11 resize-none"
              />
              <Button size="icon" className="h-11 w-11 shrink-0" onClick={() => submit()} disabled={ask.isPending || !input.trim()}>
                {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              For demos and account-specific issues: support@syllabus-synk.in
            </div>
          </div>
        </div>
      )}

      <Button
        className="pointer-events-auto h-14 min-w-[132px] rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-xl hover:bg-slate-900"
        onClick={() => setOpen((v) => !v)}
      >
        Ask Synk AI
      </Button>
    </div>
  );
}

