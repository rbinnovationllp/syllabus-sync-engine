import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { acceptInvitation, previewInvitation } from "@/lib/seats.functions";
import { AcquisitionSourceFields } from "@/components/AcquisitionSourceFields";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in - CurriculumOS" },
      { name: "description", content: "Sign in to plan your school's academic year with CurriculumOS." },
    ],
  }),
  component: AuthPage,
});

function authRedirectUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const { invite } = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [acquisition, setAcquisition] = useState({
    acquisition_source: "",
    acquisition_detail: "",
    partner_name: "",
    partner_referral_code: "",
    other_source: "",
  });
  const [invitePreview, setInvitePreview] = useState<{
    email: string;
    role: string;
    org_name: string | null;
  } | null>(null);

  useEffect(() => {
    if (!invite) return;
    previewInvitation({ data: { token: invite } })
      .then((p) => {
        if (!p) return toast.error("This invitation link is invalid or expired.");
        if (p.status !== "pending") return toast.error(`Invitation already ${p.status}.`);
        setInvitePreview({ email: p.email, role: p.role, org_name: p.org_name });
        setEmail(p.email);
        setTab("signup");
      })
      .catch(() => {});
  }, [invite]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      if (invite) await tryAcceptInvite();
      navigate({ to: "/dashboard" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryAcceptInvite() {
    if (!invite) return;
    try {
      const res = await acceptInvitation({ data: { token: invite } });
      toast.success(`Joined ${invitePreview?.org_name ?? "organisation"} as ${res.role}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept invitation");
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      if (m.includes("invalid")) return toast.error("Wrong email or password. Use 'Forgot password?' if you don't remember it.");
      if (m.includes("not confirmed")) return toast.error("Please confirm your email first - check your inbox.");
      return toast.error(error.message);
    }
    await tryAcceptInvite();
    setLoading(false);
    navigate({ to: "/dashboard" });
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name, ...acquisition },
      },
    });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        toast.error("An account with this email already exists. Try signing in instead.");
        setTab("signin");
        return;
      }
      return toast.error(error.message);
    }
    setLoading(false);
    if (!data.session) {
      toast.success("Account created. Check your email to confirm, then sign in.");
      setTab("signin");
      return;
    }
    await tryAcceptInvite();
    toast.success("Account created - you're signed in.");
    navigate({ to: "/dashboard" });
  }

  async function handleForgotPassword() {
    if (!email) return toast.error("Enter your email above first, then click Forgot password.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl("/reset-password"),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent. Check your inbox.");
  }

  async function handleGoogle() {
    setLoading(true);
    const redirectTo = authRedirectUrl("/auth" + (invite ? `?invite=${encodeURIComponent(invite)}` : ""));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setLoading(false);
      toast.error("Google sign-in failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-bold tracking-tight">CurriculumOS</h1>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">AI operating system for school leadership</p>
        </div>
        {invitePreview && (
          <Card className="mb-4 border-primary/40 bg-primary/5">
            <CardContent className="pt-6 text-sm">
              You've been invited to join{" "}
              <strong>{invitePreview.org_name ?? "an organisation"}</strong> as{" "}
              <strong>{invitePreview.role}</strong>. Sign in or create an account with{" "}
              <strong>{invitePreview.email}</strong> to accept.
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to plan your academic year.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4 pt-4">
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-password">Password</Label>
                      <button type="button" onClick={handleForgotPassword} className="text-xs text-primary hover:underline" disabled={loading}>
                        Forgot password?
                      </button>
                    </div>
                    <PasswordInput id="si-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={handleEmailSignUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Name</Label>
                    <Input
                      id="su-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Password</Label>
                    <PasswordInput
                      id="su-password"
                      required
                      autoComplete="new-password"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <AcquisitionSourceFields value={acquisition} onChange={setAcquisition} />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





