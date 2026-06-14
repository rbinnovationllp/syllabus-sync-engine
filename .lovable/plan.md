# Build plan: AI core + exports + admin audit

## 1. Database (one migration)

New tables — all RLS-scoped to owner; `service_role` full access.

- `annual_calendars` — `year_id`, `user_id`, `plan` (jsonb: months → topics/assessments/events), `meta` (jsonb), generated/updated_at.
- `subject_curricula` — `year_id`, `user_id`, `grade`, `subject`, `chapters` (jsonb: ordered list with week_no, periods, difficulty, notes), `meta` (jsonb).
- `ai_runs` — `user_id`, `action` (enum: `generate_annual_calendar` | `generate_subject_curriculum` | `recalculate_schedule`), `year_id`, `credits_spent`, `status`, `error`, `lovable_run_id`, `created_at`. For analytics + debugging.
- `admin_audit_log` — `actor_id`, `actor_email`, `action` (text), `target_type`, `target_id`, `details` (jsonb), `created_at`. Visible to `super_admin` only.

Helper trigger: `audit_admin_action()` not used — we'll log explicitly from `admin.functions.ts` (keeps it simple, no SQL side-effects on RLS-blocked rows).

## 2. AI gateway helper

`src/lib/ai-gateway.server.ts` — paste the canonical `createLovableAiGatewayProvider` helper from Lovable AI knowledge. Server-only.

## 3. AI generation server functions

New file `src/lib/ai-generation.functions.ts` — three `createServerFn` handlers:

- `generateAnnualCalendar({ year_id })` — 50 credits
- `generateSubjectCurriculum({ year_id, grade, subject })` — 25 credits
- `recalculateSchedule({ year_id, disruption })` — 20 credits

Each handler:
1. `requireSupabaseAuth` middleware.
2. `requireActiveSubscription(supabase, userId)` → if not ok, return `{ error: "PAID_PLAN_REQUIRED" }`.
3. Load year + capacity + holidays + subjects from DB (admin client).
4. Call `consume_ai_credits(_user_id, _cost, _monthly_quota, _check_env)` RPC. If returns NULL → return `{ error: "INSUFFICIENT_CREDITS" }`.
5. Call Lovable AI Gateway via `generateText` with `Output.object({ schema })` — structured JSON output (Zod schema matches table columns).
6. Persist to `annual_calendars` / `subject_curricula` (upsert on `year_id` (+ grade/subject)).
7. Insert `ai_runs` row with `lovable_run_id`.

Model: `google/gemini-3-flash-preview` (default). System prompt embeds: never exceed available teaching days, respect difficulty distribution (avoid clustering tough chapters), keep syllabus-completion buffer (30/45/60 days before exams by grade band).

## 4. UI wiring

`src/routes/_authenticated/results.$yearId.tsx`:
- Three buttons: **Generate Annual Calendar**, **Generate Subject Curriculum** (per row), **Recalculate**.
- Loading state via `useMutation`. Show error toast for `PAID_PLAN_REQUIRED` → link to `/pricing`; for `INSUFFICIENT_CREDITS` → link to AI top-up.
- Render persisted calendar (month table) and curriculum (chapter list per grade-subject) below capacity stats.

## 5. Exports with DEMO watermark

`src/lib/exports.functions.ts` — two server fns:
- `exportYearPdf({ year_id })`
- `exportYearDocx({ year_id })`

Both:
1. `requireSupabaseAuth`.
2. Check `has_active_subscription` — branch `unpaid = true` if false (don't block — watermark instead, per user choice).
3. Load year + calendar + curricula.
4. PDF: use `pdf-lib` (Worker-safe, pure JS). Each page rendered with `StandardFonts.Helvetica`; on unpaid, draw `DEMO_WATERMARK_TEXT` rotated 45°, grey 60pt, centred.
5. DOCX: use `docx` npm package server-side. On unpaid, every page gets a header with watermark text in 48pt grey rotated.
6. Call `record_export(_user_id)` RPC.
7. Return `{ filename, base64, mime }`. Client downloads via blob.

Server route alternative considered; sticking with createServerFn + base64 keeps it simple and same-origin.

## 6. Admin audit log

`src/lib/admin.functions.ts`:
- Add private `logAdminAction(supabaseAdmin, actor, action, details)` helper.
- Call it from `promoteToAdmin`, `revokeAdmin`, `updateLeadStage`.
- New `listAuditLog()` server fn — super_admin only.

`src/routes/_authenticated/admin.tsx` — new "Audit log" tab listing 100 most recent entries (actor email, action, target, timestamp).

## 7. Packages

`bun add pdf-lib docx ai @ai-sdk/openai-compatible zod` (zod already present).

## Out of scope

- Lesson plans, teacher training calendar (PRD items, but bigger AI scope — separate turn).
- Email delivery of PDF/DOCX.
- Multi-tenant org-scoped sharing of generated plans.

## Technical notes

- `consume_ai_credits` RPC already exists and handles monthly quota + top-up grants atomically.
- `has_active_subscription` RPC already exists.
- Lovable AI gateway returns `X-Lovable-AIG-Run-ID` — stored on `ai_runs` for debugging.
- All AI prompts include school's board (CBSE / IB / etc.) and language; model is asked to use board-standard terminology.
- PDF/DOCX generation runs in Workers SSR runtime — `pdf-lib` and `docx` are pure JS and known to work there.
