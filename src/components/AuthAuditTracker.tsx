import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordPlatformActivity } from "@/lib/governance.functions";

export function AuthAuditTracker() {
  const record = useServerFn(recordPlatformActivity);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const action =
        event === "SIGNED_IN"
          ? "user.login"
          : event === "SIGNED_OUT"
            ? "user.logout"
            : event === "PASSWORD_RECOVERY"
              ? "user.password_reset_started"
              : null;

      if (!action) return;

      void record({
        data: {
          action,
          entity_type: "auth",
          user_id: session?.user?.id ?? null,
          user_name: session?.user?.email ?? null,
          metadata: {
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            path: typeof window !== "undefined" ? window.location.pathname : null,
          },
        },
      }).catch(() => {
        /* audit logging should never block the user */
      });
    });

    return () => data.subscription.unsubscribe();
  }, [record]);

  return null;
}
