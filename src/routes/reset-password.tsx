import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password - CurriculumOS" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setChecking(true);
      setLinkError("");

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description") || params.get("error");

      if (errorDescription) {
        if (mounted) {
          setLinkError(errorDescription);
          setChecking(false);
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (mounted) {
            setLinkError(error.message);
            setChecking(false);
          }
          return;
        }

        window.history.replaceState({}, document.title, "/reset-password");
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setReady(Boolean(data.session));
        setChecking(false);
        if (!data.session) {
          setLinkError(
            "This reset link is invalid or expired. Please request a fresh password reset email.",
          );
        }
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
        setLinkError("");
      }
    });

    void prepareRecoverySession();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Password updated. You are signed in.");
    navigate({ to: "/dashboard" });
  }

  async function resendReset() {
    navigate({ to: "/auth", search: { invite: undefined } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              {checking
                ? "Validating reset link..."
                : ready
                  ? "Choose a new password for your account."
                  : "The reset link could not be validated."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkError && !ready && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {linkError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!ready || loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password
              </Button>
              {!ready && !checking && (
                <Button type="button" variant="outline" className="w-full" onClick={resendReset}>
                  Request a fresh reset link
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
