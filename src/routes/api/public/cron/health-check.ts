import { createFileRoute } from "@tanstack/react-router";
import { persistAndAlert } from "@/lib/health.functions";

export const Route = createFileRoute("/api/public/cron/health-check")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const snap = await persistAndAlert();
          return Response.json({ ok: true, severity: snap?.severity });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
