import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAiHelpAssistant } from "@/lib/ai-help.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const starterPrompts = [
  "How do I create a free 30-day preview?",
  "Which plan includes AI Leadership Suite?",
  "How do I generate a yearly syllabus?",
];

export function AiHelpAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi, I am the Syllabus Synk help assistant. Ask me about setup, syllabus planning, subscriptions, exports, or AI Leadership Suite.",
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
    onError: (e: any) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I could not answer that right now. Please email support@syllabus-synk.in. ${e?.message ?? ""}` },
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
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 flex h-[560px] max-h-[calc(100vh-120px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white/10 p-2"><Bot className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-semibold">AI Help Assistant</div>
                <div className="text-xs text-slate-300">Product and academic guidance</div>
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
                placeholder="Ask for help..."
                rows={2}
                className="min-h-11 resize-none"
              />
              <Button size="icon" className="h-11 w-11 shrink-0" onClick={() => submit()} disabled={ask.isPending || !input.trim()}>
                {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              For account-specific issues: support@syllabus-synk.in
            </div>
          </div>
        </div>
      )}

      <Button
        className="h-14 rounded-full px-5 shadow-xl"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle className="mr-2 h-5 w-5" />
        Help
      </Button>
    </div>
  );
}
