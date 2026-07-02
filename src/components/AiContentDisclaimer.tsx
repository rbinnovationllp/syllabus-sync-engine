import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AI_CONTENT_DISCLAIMER } from "@/lib/governance.functions";

export function AiContentDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{compact ? "Review required" : "AI content review required"}</AlertTitle>
      <AlertDescription className={compact ? "text-xs" : "text-sm"}>
        {AI_CONTENT_DISCLAIMER}
      </AlertDescription>
    </Alert>
  );
}
