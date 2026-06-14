import { Link, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, CreditCard, Shield, Users } from "lucide-react";
import { getMyAdminStatus } from "@/lib/admin.functions";

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
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-semibold tracking-tight">CurriculumOS</Link>
          <div className="flex items-center gap-3">
            {title && <span className="text-sm text-muted-foreground hidden sm:inline">{title}</span>}
            {status?.isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><Shield className="h-4 w-4 mr-1" /> Admin</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/seats"><Users className="h-4 w-4 mr-1" /> Seats</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pricing"><CreditCard className="h-4 w-4 mr-1" /> Plans</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

