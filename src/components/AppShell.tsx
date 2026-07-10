import { Link, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, LogOut, CreditCard, Shield, Users, Briefcase, Building2, ClipboardCheck, Landmark, BrainCircuit } from "lucide-react";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { NotificationBell } from "@/components/NotificationBell";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const statusFn = useServerFn(getMyAdminStatus);
  const { data: status } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { invite: undefined }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="font-semibold tracking-tight">
            CurriculumOS
          </Link>
          <div className="flex items-center gap-3">
            {title && (
              <span className="text-sm text-muted-foreground hidden sm:inline">{title}</span>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/v2/principal">
                <Brain className="h-4 w-4 mr-1" /> AI Suite
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/ai-future-force">
                <BrainCircuit className="h-4 w-4 mr-1" /> AI Future Force
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/school-crm">
                <Building2 className="h-4 w-4 mr-1" /> School CRM
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/academic-execution">
                <ClipboardCheck className="h-4 w-4 mr-1" /> Execution
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/school-governance">
                <Landmark className="h-4 w-4 mr-1" /> Governance
              </Link>
            </Button>
            {status?.isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-1" /> Admin
                </Link>
              </Button>
            )}
            {status?.isSuperAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/company-crm">
                  <Briefcase className="h-4 w-4 mr-1" /> Company CRM
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/seats">
                <Users className="h-4 w-4 mr-1" /> Seats
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pricing">
                <CreditCard className="h-4 w-4 mr-1" /> Plans
              </Link>
            </Button>
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}


