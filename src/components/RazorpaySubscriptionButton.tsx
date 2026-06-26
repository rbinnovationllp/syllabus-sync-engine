import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createRazorpaySubscription } from "@/lib/razorpay.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => { open: () => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay checkout")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export function RazorpaySubscriptionButton({
  priceId,
  label = "Pay with Razorpay",
  onStarted,
}: {
  priceId: string;
  label?: string;
  onStarted?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      await loadCheckoutScript();
      const result = await createRazorpaySubscription({ data: { priceId } });
      if (!result.ok) throw new Error(result.error);
      const checkout = new window.Razorpay!({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "Syllabus Sync",
        description: result.planName,
        notes: { priceId: result.priceId },
        handler: () => {
          toast.success("Payment received. Your subscription will activate after Razorpay confirmation.");
          onStarted?.();
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        theme: { color: "#0f766e" },
      });
      checkout.open();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start Razorpay checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={start} disabled={loading} className="w-full">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
