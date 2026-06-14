# CurriculumOS — Build Plan

A platform this large can't ship in one pass. I'll build it in 6 phases, each independently usable. You approve this plan once; after each phase you can redirect.

## Stack

- **Frontend**: TanStack Start (already scaffolded), React 19, Tailwind, shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — Postgres + Auth + RLS for multi-tenant isolation
- **AI**: Lovable AI Gateway (`google/gemini-3-flash-preview` default, `gemini-3-pro` for deep textbook analysis)
- **Billing**: Lovable's built-in Stripe (5 tier products)
- **Exports**: `docx`, `exceljs` for native; Google Docs/Sheets via per-user OAuth (Phase 6)

---

## Phase 1 — Foundation & Onboarding Wizard

**Goal**: A signed-in user can complete the 4-step wizard and see `T_available` calculated.

- Enable Lovable Cloud; email/password + Google auth
- Schema: `organizations`, `org_members`, `user_roles` (admin/teacher), `schools`, `onboarding_drafts`, `academic_years`, `grade_subjects`, `events`, `holidays` — all RLS-scoped to `org_id`
- 4-step wizard route `/onboarding`:
  1. Institutional + geo + board (CBSE/ICSE/IB/Cambridge/Common Core/etc.)
  2. Fee tier + textbook entry (leave-blank allowed; flagged for Phase 3 AI fill)
  3. Calendar shape + multi-teacher period matrix (subject × grade × periods/week)
  4. Holidays, vacations, events with `prep_days` field
- **Capacity engine** (server fn): implements `T_available = C_total − (H_gov + H_school + V + E + X + T_training + W_offs + B_buffer)`; returns per-grade-subject available blocks
- Results dashboard: capacity card + breakdown waterfall chart
- Zero-null fallback: missing fields hydrate from `regional_benchmarks` seed table

## Phase 2 — Billing Tiers & Access Enforcement

**Goal**: Tier tokens gate grade/subject access at DB + UI level.

- Enable Lovable Stripe Payments
- 5 products created via `batch_create_product`: `retail_single_access`, `bundle_primary_access`, `bundle_middle_access`, `bundle_high_access`, `enterprise_global_access`
- Stripe webhook at `/api/public/webhooks/stripe` (HMAC-verified) writes to `subscriptions` table
- `entitlements` table + `has_access(org_id, grade, subject)` SQL function called from RLS policies on planning tables
- Paywall UI on locked grades; upgrade CTA

## Phase 3 — AI Book Matching + Difficulty Tagging

**Goal**: Empty textbook fields auto-fill; chapters get Simple/Medium/Tough tags.

- `publishers`, `textbooks`, `chapters` reference tables (seeded for Budget/Mid/Premium tiers across regions — start with India/UK/US/Singapore seed sets)
- Server fn `recommendTextbooks({ region, fee_tier, board, grade })` → Lovable AI structured output picking from registry
- Background server fn `analyzeChapter({ textbook_id, chapter_id })` using `gemini-3-pro` with structured output: `{ difficulty, concept_dependencies, estimated_periods }`
- Queue table `analysis_jobs` polled by client; results stored in `chapter_analyses`

## Phase 4 — Scheduling & Interleaving Engine

**Goal**: Produce the master academic calendar + per-class ledger + weekly lesson plans.

- Pure-TS scheduling algorithm:
  - Allocate periods per subject across available days
  - Interleave Tough chapters with Simple ones (no two Tough in same week across the student's subjects)
  - Cross-subject homework-load balancer (scales lighter subjects when another is in a Tough block)
  - Board completion guardrails (30/45/60-day buffers by class group)
- Outputs persisted to `lesson_plans`, `weekly_blocks`, `daily_assignments`
- Split-screen workspace UI: left = chat assistant (Lovable AI, RAG over the plan), right = live editable calendar/spreadsheet view (TanStack Table + custom calendar grid)

## Phase 5 — Recalibration Engine

**Goal**: "Recalibrate System" button re-engineers the remaining year.

- Server fn `recalibrate({ academic_year_id, disruption })`:
  1. Compress upcoming Simple chapter windows
  2. Move secondary drills to self-study
  3. Check guardrail compliance
  4. If still infeasible → return `advice` payload (Option A: trim events; Option B: zero-period Saturdays) for user choice
- Audit trail in `recalibration_events`
- Teacher Professional Development module: `training_modules` seeded by segment (Primary/Middle/Higher Secondary), Saturday orientation scheduler that doesn't collide with student calendar

## Phase 6 — Exports

**Goal**: All 5 deliverables export to 4 formats.

- Native: `.xlsx` via `exceljs`, `.docx` via `docx` — generated server-side, returned as download
- Google Docs / Sheets: per-user Google OAuth flow (separate from Lovable Cloud auth); tokens stored encrypted; writes via Drive + Docs/Sheets APIs
- Five export templates: Master Calendar, Curriculum Ledger, Monthly Roadmap, Weekly Lesson Blocks, Teacher PD Guide

---

## Cross-cutting

- **Multi-tenant isolation**: every table has `org_id`; RLS policies use `has_org_access(org_id)` security-definer fn; roles via separate `user_roles` table (never on profiles)
- **1:1:1 ID guardrail**: Stripe `client_reference_id` = `auth.uid()`; webhook rejects mismatches
- **Public landing page** at `/` with marketing pitch (separate route from app)
- **Error boundaries** + `notFoundComponent` on every route with a loader
- **No mock AI**: all AI calls hit Lovable AI Gateway from server fns; 402/429 surfaced to UI

## What I need from you to start Phase 1

1. Confirm Lovable Cloud enable (required for auth + DB)
2. Confirm "user profiles needed" — yes, since we need school role + display name
3. Approve this phased approach, or tell me to merge/reorder phases

Phase 1 alone is ~1 large iteration. I'll stop after Phase 1 results dashboard works end-to-end and wait for your sign-off before moving to billing.
