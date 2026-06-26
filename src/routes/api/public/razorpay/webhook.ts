import { createFileRoute } from "@tanstack/react-router";
import { upsertRazorpaySubscriptionFromEvent, verifyRazorpaySignature } from "@/lib/razorpay.functions";

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
        switch (event.event) {
          case "subscription.activated":
          case "subscription.authenticated":
          case "subscription.charged":
          case "subscription.completed":
          case "subscription.cancelled":
          case "subscription.paused":
          case "subscription.resumed":
            await upsertRazorpaySubscriptionFromEvent(event);
            break;
          default:
            break;
        }
        return Response.json({ received: true });
      },
    },
  },
});
