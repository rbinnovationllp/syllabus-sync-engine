process.on("uncaughtException", (e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
import ts from "typescript";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const out = await fs.mkdtemp(path.join(os.tmpdir(), "syllabus-pricing-"));
const compiled = new Set();
async function compile(name) {
  const dest = path.join(out, name + ".mjs");
  if (compiled.has(name)) return dest;
  compiled.add(name);
  const source = await fs.readFile("src/lib/" + name + ".ts", "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const dep = match[1];
    const resolved = dep.startsWith("./")
      ? pathToFileURL(await compile(dep.slice(2))).href
      : import.meta.resolve(dep);
    code = code
      .replaceAll('"' + dep + '"', '"' + resolved + '"')
      .replaceAll("'" + dep + "'", '"' + resolved + '"');
  }
  await fs.writeFile(dest, code);
  return dest;
}
async function mod(name) {
  return import(pathToFileURL(await compile(name)).href);
}

const plans = await mod("plans"),
  premium = await mod("ai-education-premium"),
  payment = await mod("ai-education-premium-payment.server"),
  claude = await mod("anthropic-teaching-planner.server"),
  skill = await mod("ai-teaching-planner-skill.server");
let tests = 0;
async function test(name, fn) {
  await fn();
  tests++;
  console.log("PASS " + name);
}
const expected = [
  ["retail_single_access", 9, 590, 1, 500],
  ["bundle_primary_access", 29, 3540, 6, 2000],
  ["bundle_middle_access", 49, 5900, 10, 4000],
  ["bundle_high_access", 69, 8260, 18, 6500],
  ["enterprise_global_access", 179, 21240, 60, 25000],
];
await test("Five active plans, exact prices, stable IDs, seats and credits", () => {
  assert.equal(plans.PLANS.length, 5);
  for (const [id, usd, inr, seats, credits] of expected) {
    const p = plans.planForTier(id);
    assert.equal(p.limits.maxUsers, seats);
    assert.equal(p.limits.aiCreditsPerMonth, credits);
    for (const currency of ["usd", "inr"])
      for (const interval of ["monthly", "annual"]) {
        const price = p.prices.find((x) => x.currency === currency && x.interval === interval);
        assert.equal(
          price.amount,
          (currency === "usd" ? usd : inr) * 100 * (interval === "annual" ? 10 : 1),
        );
        if (currency === "inr") assert.match(price.display, /Inclusive of GST/);
      }
  }
  assert.deepEqual(plans.gradesEntitled("bundle_primary_access"), [
    "Pre-K",
    "K",
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  assert.deepEqual(plans.gradesEntitled("bundle_middle_access"), ["6", "7", "8"]);
  assert.deepEqual(plans.gradesEntitled("bundle_high_access"), ["9", "10", "11", "12"]);
  assert.equal(plans.planForTier("enterprise_global_access").limits.maxCampuses, 1);
});
await test("Discontinued plans cannot be purchased; historical entitlement lookup survives", () => {
  for (const tier of [
    "bundle_primary_plus_access",
    "bundle_middle_plus_access",
    "bundle_high_plus_access",
    "enterprise_plus_access",
  ]) {
    const id = tier.replace(/_access$/, "") + "_monthly_inr";
    assert.equal(plans.purchasablePrice(id), null);
    assert.equal(plans.tierForPriceId(id), tier);
    assert.ok(plans.limitsForTier(tier));
  }
  assert.equal(plans.purchasablePrice("ai_future_force_primary_inr"), null);
});
await test("Top-ups, storage, seat and campus totals; no top-up recurrence", () => {
  for (const [id, value] of Object.entries({
    ai_credits_500: 590,
    ai_credits_2k: 2360,
    ai_credits_10k: 8260,
    extra_user: 236,
    extra_campus: 5900,
    extra_storage_25gb: 295,
    extra_storage_50gb: 590,
    extra_storage_100gb: 1180,
    extra_storage_250gb: 2360,
    extra_storage_500gb: 4130,
  })) {
    const a = plans.ADD_ONS.find((p) => p.id === id);
    assert.equal(a.prices.find((p) => p.currency === "inr").amount, value * 100);
    if (id.startsWith("ai_credits")) assert.equal(a.recurring, false);
  }
});
await test("Tax extraction and annual two-month discount every month", () => {
  assert.deepEqual(plans.gstInclusiveBreakdown(59000, "inr"), {
    taxableMinor: 50000,
    gstMinor: 9000,
    totalMinor: 59000,
  });
  for (let month = 0; month < 12; month++)
    assert.equal(plans.annualRebateEligible("inr", new Date(2026, month, 1)), true);
});
await test("Captured payment binding and manipulated-payment rejection", () => {
  const s = { id: "s1", provider_order_id: "order_1", final_amount_minor: 200000, currency: "inr" },
    p = {
      id: "pay_1",
      order_id: "order_1",
      amount: 200000,
      currency: "INR",
      status: "captured",
      captured: true,
      amount_refunded: 0,
    },
    o = {
      id: "order_1",
      amount: 200000,
      currency: "INR",
      notes: { product: "ai_education_premium", premiumSubscriptionId: "s1" },
    };
  payment.assertPremiumPayment(s, p, o);
  for (const change of [
    { amount: 1 },
    { status: "authorized" },
    { order_id: "order_2" },
    { currency: "USD" },
    { amount_refunded: 10 },
  ])
    assert.throws(() => payment.assertPremiumPayment(s, { ...p, ...change }, o));
  assert.equal(payment.verifyPremiumCheckout("order_1", "pay_1", "0".repeat(64), "secret"), false);
});
await test("Entitlement expiry and future terms fail closed", () => {
  const row = {
    status: "active",
    starts_at: "2026-01-01",
    ends_at: "2026-03-01",
    ai_education_premium_subscriptions: {
      status: "active",
      starts_at: "2026-01-01",
      renews_at: "2026-03-01",
    },
  };
  assert.equal(premium.entitlementActive(row, Date.parse("2026-02-01")), true);
  assert.equal(premium.entitlementActive(row, Date.parse("2026-03-01")), false);
  assert.equal(premium.entitlementActive(row, Date.parse("2025-12-01")), false);
  assert.equal(premium.entitlementActive({ ...row, ends_at: null }), false);
});
await test("Skill contents and class resources are loaded, with content versioning", async () => {
  for (const g of ["1", "3", "6", "9", "12"]) {
    const s = await skill.loadTeachingPlannerSkill(g, "lesson");
    assert.ok(s.text.length > 10000);
    assert.match(s.text, /Output template/);
    assert.match(s.version, /^[a-f0-9]{64}$/);
  }
});
await test("Claude backend sends skill instructions, validates output, handles failures", async () => {
  const old = globalThis.fetch,
    key = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "unit-test-placeholder";
  let captured;
  try {
    globalThis.fetch = async (url, opts) => {
      captured = JSON.parse(opts.body);
      return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), {
        status: 200,
      });
    };
    await assert.rejects(
      () => claude.generateWithClaude("actual skill content", "school context"),
      /ANTHROPIC_INVALID_RESPONSE/,
    );
    assert.equal(captured.system, "actual skill content");
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(
      () => claude.generateWithClaude("skill", "context"),
      /ANTHROPIC_RATE_LIMIT/,
    );
  } finally {
    globalThis.fetch = old;
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  }
});

if (!process.env.PGLITE_MODULE)
  throw Error(
    "Set PGLITE_MODULE to the installed @electric-sql/pglite entry point for database tests.",
  );
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);create table organizations(id uuid primary key);create table org_members(org_id uuid,user_id uuid,role text);
create table user_roles(user_id uuid,role text);
create function has_role(u uuid,r text) returns boolean language sql security definer as $$select exists(select 1 from user_roles where user_id=u and role=r)$$;
create function is_org_member(o uuid) returns boolean language sql security definer as $$select exists(select 1 from org_members where org_id=o and user_id=auth.uid())$$;
create function is_org_admin(o uuid) returns boolean language sql security definer as $$select exists(select 1 from org_members where org_id=o and user_id=auth.uid() and role in ('admin','super_admin','owner'))$$;
create table subscriptions(id uuid primary key default gen_random_uuid(),gst_charged_separately boolean default true);
create table subscription_plan_catalog(plan_code text primary key,plan_name text,school_level text,variant text,monthly_usd numeric,monthly_inr numeric,monthly_credits integer,user_limit integer,storage_gb integer,feature_flags jsonb,active boolean default true,updated_at timestamptz);
create table organization_subscription_profiles(id uuid primary key,org_id uuid,plan_code text references subscription_plan_catalog(plan_code),ends_at timestamptz);
insert into subscription_plan_catalog(plan_code) values('RET-SINGLE'),('PRI-BASE'),('MID-BASE'),('HIGH-BASE'),('ENT-BASE'),('PRI-PLUS'),('MID-PLUS'),('HIGH-PLUS'),('ENT-PLUS');
`);
const files = [
  "20260905000100_ai_education_premium.sql",
  "20260906000100_ai_education_premium_group_pricing.sql",
  "20260906000200_ai_education_premium_teaching_plans.sql",
  "20260906000300_ai_education_premium_billing_security.sql",
  "20260906000400_gst_inclusive_catalog.sql",
];
await test("All five Premium and inclusive-pricing migrations execute on PostgreSQL", async () => {
  for (const f of files) await db.exec(await fs.readFile("supabase/migrations/" + f, "utf8"));
});
const admin = "00000000-0000-0000-0000-000000000001",
  teacher = "00000000-0000-0000-0000-000000000002",
  stranger = "00000000-0000-0000-0000-000000000003",
  org = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
await db.exec(
  `insert into auth.users values('${admin}'),('${teacher}'),('${stranger}');insert into organizations values('${org}'),('${other}');insert into org_members values('${org}','${admin}','admin'),('${org}','${teacher}','teacher'),('${other}','${stranger}','admin');grant usage on schema auth,public to authenticated,service_role;grant select,insert,update on all tables in schema public to authenticated;grant all on all tables in schema public to service_role;select set_config('request.jwt.claim.sub','${admin}',false);`,
);
const sql = async (s, p = []) => (await db.query(s, p)).rows;
const quote = async (code = "classes_1_5", interval = "monthly") =>
  (await sql("select premium_create_quote($1,$2,$3) as q", [org, code, interval]))[0].q;
const rows = await sql("select * from ai_education_premium_package_catalog order by sort_order");
await test("Nine exact Premium monthly/annual group prices, GST inclusive", () => {
  const expected = [
    [2000, 20000],
    [3000, 30000],
    [4000, 40000],
    [5000, 50000],
    [6000, 60000],
    [5000, 50000],
    [7000, 70000],
    [9000, 90000],
    [12000, 120000],
  ];
  assert.equal(rows.length, 9);
  rows.forEach((r, i) => {
    assert.deepEqual([r.monthly_price_inr, r.annual_price_inr], expected[i]);
    assert.equal(r.gst_inclusive, true);
  });
});
let first;
await test("Inactive, future and unknown packages cannot be quoted", async () => {
  await db.exec(
    "update ai_education_premium_package_catalog set active=false where code='classes_1_2'",
  );
  await assert.rejects(() => quote("classes_1_2"), /UNAVAILABLE/);
  await db.exec(
    "update ai_education_premium_package_catalog set active=true,effective_from=now()+interval '1 day' where code='classes_1_2'",
  );
  await assert.rejects(() => quote("classes_1_2"), /UNAVAILABLE/);
  await assert.rejects(() => quote("forged"), /UNAVAILABLE/);
  await db.exec(
    "update ai_education_premium_package_catalog set effective_from=null where code='classes_1_2'",
  );
});
await test("Quote snapshots tax and group price; repeat request reuses quote", async () => {
  first = await quote();
  assert.equal(first.final_amount_minor, 500000);
  assert.equal(first.base_amount_minor + first.tax_amount_minor, 500000);
  assert.equal((await quote()).id, first.id);
  assert.equal(
    (await sql("select count(*)::int as n from ai_education_premium_entitlements"))[0].n,
    0,
  );
});
await test("Only captured validated settlement grants classes; payment replay is idempotent", async () => {
  await sql("update ai_education_premium_subscriptions set provider_order_id=$1 where id=$2", [
    "order_test",
    first.id,
  ]);
  await assert.rejects(
    () => sql("select premium_settle_payment('order_test','pay_test',1,'INR')"),
    /MISMATCH/,
  );
  await sql("select premium_settle_payment('order_test','pay_test',500000,'INR')");
  await sql("select premium_settle_payment('order_test','pay_test',500000,'INR')");
  assert.equal((await sql("select count(*)::int as n from ai_education_premium_payments"))[0].n, 1);
  assert.equal(
    (await sql("select count(*)::int as n from ai_education_premium_entitlements"))[0].n,
    5,
  );
});
await test("Premium-only class access, teacher assignment and cross-school denial", async () => {
  assert.equal(
    (await sql("select premium_has_class($1,$2,$3) as ok", [org, "5", admin]))[0].ok,
    true,
  );
  assert.equal(
    (await sql("select premium_has_class($1,$2,$3) as ok", [org, "6", admin]))[0].ok,
    false,
  );
  assert.equal(
    (await sql("select premium_has_class($1,$2,$3) as ok", [org, "1", teacher]))[0].ok,
    false,
  );
  await sql(
    "insert into ai_education_premium_teacher_assignments(org_id,user_id,grade) values($1,$2,$3)",
    [org, teacher, "1"],
  );
  assert.equal(
    (await sql("select premium_has_class($1,$2,$3) as ok", [org, "1", teacher]))[0].ok,
    true,
  );
  assert.equal(
    (await sql("select premium_has_class($1,$2,$3) as ok", [org, "1", stranger]))[0].ok,
    false,
  );
  assert.equal((await sql("select count(*)::int as n from subscriptions"))[0].n, 0);
});
await test("Annual upgrade queues a full year after monthly expiry without changing current access", async () => {
  const annual = await quote("classes_1_5", "annual");
  assert.equal(annual.final_amount_minor, 5000000);
  await sql(
    "update ai_education_premium_subscriptions set provider_order_id='order_annual' where id=$1",
    [annual.id],
  );
  await sql("select premium_settle_payment('order_annual','pay_annual',5000000,'INR')");
  const periods = await sql(
    "select starts_at,renews_at from ai_education_premium_subscriptions where id=any($1::uuid[]) order by starts_at",
    [[first.id, annual.id]],
  );
  assert.equal(periods[0].renews_at.toISOString(), periods[1].starts_at.toISOString());
  assert.ok(periods[1].renews_at - periods[1].starts_at >= 365 * 86400000);
  await assert.rejects(() => quote("classes_1_5", "annual"), /ALREADY_SCHEDULED/);
});
await test("Generation concurrency and per-minute quotas are enforced in the database", async () => {
  await sql("select premium_claim_generation($1,$2,$3,$4)", [org, teacher, "1", "hash1"]);
  await assert.rejects(
    () => sql("select premium_claim_generation($1,$2,$3,$4)", [org, teacher, "1", "hash1"]),
    /IN_PROGRESS/,
  );
  for (const h of ["hash2", "hash3"])
    await sql("select premium_claim_generation($1,$2,$3,$4)", [org, teacher, "1", h]);
  await assert.rejects(
    () => sql("select premium_claim_generation($1,$2,$3,$4)", [org, teacher, "1", "hash4"]),
    /LIMIT/,
  );
});
await test("Saved-plan RLS blocks expired and unsubscribed class reads", async () => {
  await sql(
    "insert into ai_education_premium_teaching_plans(org_id,grade,academic_year,topic,context_hash,output,skill_version,model) values($1,'1','2026','Test','cached','{}','v1','test'),($1,'6','2026','Hidden','hidden','{}','v1','test')",
    [org],
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${teacher}',false);`,
  );
  assert.equal(
    (await sql("select count(*)::int as n from ai_education_premium_teaching_plans"))[0].n,
    1,
  );
  await assert.rejects(
    () => sql("select premium_settle_payment('order_test','pay_fake',500000,'INR')"),
    /permission denied/,
  );
  await db.exec("reset role");
  await sql(
    "update ai_education_premium_entitlements set ends_at=now()-interval '1 second' where subscription_id=$1",
    [first.id],
  );
  await db.exec("set role authenticated");
  assert.equal(
    (await sql("select count(*)::int as n from ai_education_premium_teaching_plans"))[0].n,
    0,
  );
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${admin}',false);`);
});
await test("Base database prices/limits match frontend and retired entries stay inactive", async () => {
  for (const [id, usd, inr, seats, credits] of expected) {
    const r = (await sql("select * from subscription_plan_catalog where plan_id=$1", [id]))[0];
    assert.equal(Number(r.monthly_inr), inr);
    assert.equal(Number(r.annual_inr), inr * 10);
    assert.equal(r.user_limit, seats);
    assert.equal(r.monthly_credits, credits);
  }
  assert.equal(
    (
      await sql(
        "select count(*)::int as n from subscription_plan_catalog where plan_code like '%PLUS' and active",
      )
    )[0].n,
    0,
  );
});
await db.close();
console.log(`PASS ${tests} test groups`);
