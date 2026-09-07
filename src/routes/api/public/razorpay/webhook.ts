import { createFileRoute } from "@tanstack/react-router";
import {
  updateRazorpayRefundFromEvent,
  updateRazorpayPaymentFromEvent,
  upsertRazorpaySubscriptionFromEvent,
  verifyRazorpaySignature,
} from "@/lib/razorpay.webhook.server";

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature");
        if (!verifyRazorpaySignature(body, signature)) {
          return new Response("Invalid signature", { status: 400 });
        }
        const event = JSON.parse(body);
        const { handlePremiumPaymentEvent } = await import("@/lib/ai-education-premium-payment.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (await handlePremiumPaymentEvent(event, supabaseAdmin)) return Response.json({ received: true });
        switch (event.event) {
          case "subscription.activated":
          case "subscription.authenticated":
          case "subscription.charged":
          case "subscription.completed":
          case "subscription.cancelled":
          case "subscription.paused":
          case "subscription.pending":
          case "subscription.halted":
          case "subscription.resumed":
            await upsertRazorpaySubscriptionFromEvent(event);
            break;
          case "payment.captured":
          case "payment.failed":
            await updateRazorpayPaymentFromEvent(event);
            break;
          case "payment.refunded":
          case "refund.created":
          case "refund.processed":
            await updateRazorpayRefundFromEvent(event);
            break;
          default:
            break;
        }
        return Response.json({ received: true });
      },
    },
  },
});

