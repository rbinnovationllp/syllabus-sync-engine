// Run with: bun test src/lib/__tests__/org-errors.test.ts
import { describe, expect, it, mock } from "bun:test";
import { friendlyOrgMemberError, logOrgMemberBootstrap } from "../org-errors";

describe("friendlyOrgMemberError", () => {
  it("rewrites RLS error on org_members into onboarding guidance", () => {
    const out = friendlyOrgMemberError(
      'new row violates row-level security policy for table "org_members"',
    );
    expect(out).toContain("school workspace");
    expect(out).toContain("support@syllabus-synk.in");
    expect(out.toLowerCase()).not.toContain("row-level security");
  });

  it("detects duplicate membership as already-joined", () => {
    const out = friendlyOrgMemberError(
      'duplicate key value violates unique constraint "org_members_org_id_user_id_key"',
    );
    expect(out).toBe("You're already a member of this workspace.");
  });

  it("falls through for unrelated errors", () => {
    expect(friendlyOrgMemberError("network down")).toBe("network down");
    expect(friendlyOrgMemberError(null)).toContain("Unknown error");
  });
});

describe("logOrgMemberBootstrap", () => {
  it("inserts an audit row with org id, role, source and timestamp", async () => {
    const insert = mock(async () => ({ error: null }));
    const admin = { from: () => ({ insert }) };
    await logOrgMemberBootstrap(admin, {
      actorId: "11111111-1111-1111-1111-111111111111",
      actorEmail: "rb@example.com",
      orgId: "22222222-2222-2222-2222-222222222222",
      role: "admin",
      source: "onboarding",
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = (insert.mock.calls[0]?.[0] ?? {}) as any;
    expect(row.action).toBe("org_member_bootstrap");
    expect(row.target_type).toBe("organization");
    expect(row.target_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(row.actor_email).toBe("rb@example.com");
    expect(row.details.role).toBe("admin");
    expect(row.details.source).toBe("onboarding");
    expect(row.details.bypassed_rls).toBe(true);
    expect(typeof row.details.at).toBe("string");
  });

  it("swallows audit errors so user flow continues", async () => {
    const insert = mock(async () => {
      throw new Error("audit table unreachable");
    });
    const admin = { from: () => ({ insert }) };
    await expect(
      logOrgMemberBootstrap(admin, {
        actorId: "a",
        orgId: "b",
        role: "admin",
        source: "invitation_accept",
      }),
    ).resolves.toBeUndefined();
  });
});

