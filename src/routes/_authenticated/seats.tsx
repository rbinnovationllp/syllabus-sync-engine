import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Trash2, X, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { listMyOrg, inviteSeatMember, revokeInvitation, removeSeatMember } from "@/lib/seats.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/seats")({
  component: SeatsPage,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Principal / Admin",
  coordinator: "Academic Coordinator",
  teacher: "Teacher",
  viewer: "Read-only",
  super_admin: "Super Admin",
};

function SeatsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOrg);
  const inviteFn = useServerFn(inviteSeatMember);
  const revokeFn = useServerFn(revokeInvitation);
  const removeFn = useServerFn(removeSeatMember);
  const { plan, subscription, isActive } = useSubscription();

  const { data, isLoading } = useQuery({ queryKey: ["my-org"], queryFn: () => listFn() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "coordinator" | "teacher" | "viewer">("teacher");

  const invite = useMutation({
    mutationFn: (vars: { org_id: string }) =>
      inviteFn({ data: { org_id: vars.org_id, email, role } }),
    onSuccess: () => {
      toast.success("Invitation created");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["my-org"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { invitation_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-org"] }),
  });

  const remove = useMutation({
    mutationFn: (vars: { org_id: string; user_id: string }) => removeFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-org"] }),
  });

  if (isLoading) {
    return <AppShell title="Manage Seats"><div className="p-8 text-center text-muted-foreground">Loading…</div></AppShell>;
  }

  if (!data) {
    return (
      <AppShell title="Manage Seats">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No organization yet</AlertTitle>
          <AlertDescription>
            Complete <Link to="/onboarding" className="underline">onboarding</Link> to create your school's workspace before inviting teammates.
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const baseSeats = plan?.limits.maxUsers ?? 1;
  const extraSeats = (subscription as { extra_seats?: number } | null)?.extra_seats ?? 0;
  const totalSeats = baseSeats + extraSeats;
  const usedSeats = data.members.length;
  const pendingInvites = data.invitations.filter((i) => i.status === "pending").length;
  const projectedUsed = usedSeats + pendingInvites;
  const canInvite = projectedUsed < totalSeats;
  const isOrgAdmin = data.myRole === "admin" || data.myRole === "super_admin";

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard");
  }

  return (
    <AppShell title="Manage Seats">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.org?.name}</h1>
            <p className="text-sm text-muted-foreground">Invite teammates and manage who has access.</p>
          </div>
          <Card className="border-primary/20">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">{usedSeats} / {totalSeats} seats used</div>
                <div className="text-xs text-muted-foreground">
                  {plan?.name ?? "No plan"} • {baseSeats} base{extraSeats > 0 ? ` + ${extraSeats} extra` : ""}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/pricing">Add seats (₹199/mo)</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {!isActive && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No active subscription</AlertTitle>
            <AlertDescription>
              You can invite teammates only with an active plan.{" "}
              <Link to="/pricing" className="underline">View plans</Link>.
            </AlertDescription>
          </Alert>
        )}

        {isOrgAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Invite a teammate</CardTitle>
              <CardDescription>
                They'll receive a link to join. Choose the role appropriate to their responsibilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-[1fr_200px_auto] gap-3">
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teacher@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Principal / Admin</SelectItem>
                    <SelectItem value="coordinator">Academic Coordinator</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="viewer">Read-only Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={!email || !canInvite || !isActive || invite.isPending}
                  onClick={() => data.org && invite.mutate({ org_id: data.org.id })}
                >
                  Send invite
                </Button>
              </div>
              {!canInvite && (
                <div className="sm:col-span-3 text-sm text-destructive">
                  You've reached your seat limit ({totalSeats}). Add seats from the pricing page to invite more teammates.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Members ({data.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((m) => {
                  const profile = m.profiles as { email?: string; display_name?: string } | null;
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="font-medium">{profile?.display_name ?? profile?.email ?? m.user_id.slice(0, 8)}</div>
                        {profile?.display_name && profile?.email && (
                          <div className="text-xs text-muted-foreground">{profile.email}</div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {isOrgAdmin && data.org && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove.mutate({ org_id: data.org!.id, user_id: m.user_id })}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {data.invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
              <CardDescription>Share the link with the invitee — they'll sign up and join automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABELS[inv.role] ?? inv.role}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "pending" ? "default" : "secondary"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        {inv.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => copyInviteLink(inv.token)} title="Copy link">
                              <Copy className="h-4 w-4" />
                            </Button>
                            {isOrgAdmin && (
                              <Button size="icon" variant="ghost" onClick={() => revoke.mutate(inv.id)} title="Revoke">
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
