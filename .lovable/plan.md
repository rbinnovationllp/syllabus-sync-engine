# CurriculumOS — Build Roadmap

Nine focused PRs. Each is shippable on its own. Order is chosen so dependencies land before consumers.

---

## PR 1 — Master School Profile (read-only view + admin-only edit RLS)

**Goal:** A single trusted source of truth that every other feature reads from (capacity engine, reschedule flow, plan generators, AI prompts).

**Scope**
- New route `/_authenticated/school/profile` — read-only summary of onboarding data: school info, board, working days/periods, subject allocation, holidays, vacations, events, exams, training days, textbooks.
- "Edit" button visible only to `school_admin` / `super_admin` (via `has_role`).
- Tighten RLS on `schools`, `academic_years`, `holidays`, `vacation_breaks`, `events`, `exam_windows`, `training_days`, `grade_subjects`, `subject_curricula`, `textbooks_input`, `annual_calendars`: SELECT for any org member; INSERT/UPDATE/DELETE only for school_admin of that school.
- Add `audit_log` trigger on every master-data UPDATE (who, what, before/after) → reuses `admin_audit_log`.

**Why first:** every later PR queries this profile; locking permissions now prevents teachers from corrupting masters later.

---

## PR 2 — Teacher Assignments + Admin Panel

**Goal:** School admins create teacher accounts and scope them to specific classes/subjects.

**Scope**
- New table `teacher_assignments(id, school_id, teacher_user_id, grade, section, subject, academic_year_id)` + GRANTs + RLS.
- New route `/_authenticated/admin` (gated by `has_role('school_admin')`):
  - Tab 1: Teachers — invite by email (reuses `invitations`), list, deactivate.
  - Tab 2: Assignments — assign teacher to grade/section/subject.
  - Tab 3: Roles & permissions.
- Teacher's existing dashboards filter curricula/plans by `teacher_assignments` (only their classes visible).
- Server fn `assignTeacher`, `revokeAssignment`, `listSchoolTeachers` (all `requireSupabaseAuth` + role check).

---

## PR 3 — Curriculum Versioning + Permanent Storage

**Goal:** Every generated/edited curriculum is preserved forever; users can compare versions and re-export old ones.

**Scope**
- New tables: `curricula(id, school_id, grade, subject, academic_year_id, status, current_version_id)`, `curriculum_versions(id, curriculum_id, version_no, payload jsonb, diff_summary, created_by, created_at)`.
- All AI generations write a new version row (never overwrite).
- UI: "Version history" drawer on each curriculum — list, view diff summary, restore, export any version.
- Retention policy enforced in DB: no automatic delete; soft-delete only by school_admin with confirmation + 30-day recycle bin.

---

## PR 4 — Reschedule / Disruption Flow (AI Recalibration)

**Goal:** Teachers report a disruption; AI redistributes remaining chapters within the available teaching capacity, honoring the Master School Profile.

**Scope**
- New table `disruptions(id, school_id, curriculum_id, reason, lost_days, lost_periods, affected_grades, affected_sections, reported_by, created_at, applied_version_id)`.
- New route `/_authenticated/curriculum/$id/reschedule` — short form (reason dropdown, lost days/periods, affected classes).
- Server fn `recalibrateCurriculum` (`requireSupabaseAuth`):
  1. Reads Master School Profile (immutable to teacher).
  2. Recomputes available teaching days.
  3. Calls Lovable AI Gateway to redistribute: compress easy chapters, protect tough ones, preserve revision window per syllabus-completion rules (30/45/60 days).
  4. Writes new `curriculum_versions` row, links to disruption.
  5. Returns diff summary + warnings if completion target slips.
- If infeasible → returns the three options (reduce events / add classes / Saturdays) for admin approval.

---

## PR 5 — Subscription Plan Limits Enforcement

**Goal:** Enforce per-tier caps so a Basic school cannot generate 500 curricula on a $X plan.

**Scope**
- Extend `subscriptions` consumption: per-plan caps (curricula/month, AI generations/month, teacher seats, classes).
- Server-side guard middleware `enforcePlanLimits(action)` called by: curriculum generation, reschedule, export, teacher invite.
- On cap hit → structured error `{code:'PLAN_LIMIT', limit, used, upgradeUrl}`.
- UI: banner in dashboard at 80% usage; modal at 100% with upgrade CTA → Stripe checkout (already connected).
- Admin usage page shows current month consumption per metric.

---

## PR 6 — Notifications & Alerts

**Goal:** Teachers/admins receive in-app + email alerts for syllabus risk, plan changes, training reminders, exam approach.

**Scope**
- New table `notifications(id, user_id, school_id, type, title, body, link, read_at, created_at)` + RLS (user sees own only).
- Server fn `createNotification` (admin/system only).
- Scheduled server route `/api/public/cron/notifications-tick` (called by pg_cron every 6h):
  - Detect curricula <30/45/60 days from exam still incomplete → alert teacher + admin.
  - Detect upcoming training day in 7 days → reminder.
  - Detect new disruption applied → notify affected teachers.
- UI: bell icon in header + `/notifications` page.
- Email via existing email infra (digest, not per-event spam).

---

## PR 7 — Admin AI Usage Dashboard

**Goal:** School admin sees who's burning credits.

**Scope**
- Read-only route `/_authenticated/admin/ai-usage` (admin role).
- Charts (recharts): credits used this month, top 10 teachers by consumption, generation type breakdown (new vs recalibrate vs lesson plan), trend last 6 months.
- Queries `ai_runs` + `plan_usage` + `ai_credit_grants`; joins to `profiles` for teacher names.
- Export CSV button.

---

## PR 8 — Monitoring + Threshold Alerts

**Goal:** Founder gets paged before users notice.

**Scope**
- Internal route `/_authenticated/super-admin/health` (super_admin only).
- Polls `supabase--db_health` equivalent metrics via server fn every 60s on view; persisted snapshot every 15 min in new table `health_snapshots(captured_at, connections_pct, db_size_mb, p95_latency_ms, error_rate, cache_hit_pct)`.
- Threshold rules (configurable):
  - connections > 70% of pool → WARN
  - p95 latency > 500ms → WARN
  - error rate > 1% over 5 min → CRITICAL
  - cache hit rate < 80% → INFO
- Scheduled `/api/public/cron/health-check` (every 5 min) writes snapshot + emails super_admin on CRITICAL.

---

## PR 9 — Internal CRM (for you, the founder)

**Goal:** A private CRM inside CurriculumOS to manage your sales pipeline: leads, schools, contacts, deals, activities, follow-ups. Only `super_admin` can access.

**Scope**

**Routes** (all under `/_authenticated/crm`, gated by `has_role('super_admin')`):
- `/crm` — pipeline dashboard: KPIs (open deals, won this month, MRR, leads by stage), upcoming activities.
- `/crm/leads` — kanban + table view (stages: New → Contacted → Qualified → Demo → Proposal → Won/Lost).
- `/crm/leads/$id` — lead detail: contact info, activities timeline, notes, linked school, files.
- `/crm/accounts` — schools you're selling to (separate from platform-tenant `schools`).
- `/crm/contacts` — people at those accounts (principal, coordinator, IT head).
- `/crm/deals` — opportunities with amount, close date, probability, stage.
- `/crm/activities` — calls, meetings, emails, tasks; calendar view.
- `/crm/import` — CSV import for leads/contacts.

**Tables** (all RLS-restricted to super_admin only):
- `crm_accounts(id, name, board, city, country, fee_tier, website, owner_user_id, created_at)`
- `crm_contacts(id, account_id, full_name, role, email, phone, linkedin, notes)`
- `crm_leads(id, source, account_id, contact_id, stage, score, owner_user_id, created_at, last_touched_at)`
- `crm_deals(id, account_id, name, amount_inr, probability, expected_close_date, stage, status, owner_user_id)`
- `crm_activities(id, type, subject, body, due_at, completed_at, account_id, contact_id, lead_id, deal_id, owner_user_id)`
- `crm_notes(id, parent_type, parent_id, body, created_by, created_at)`

**Features**
- Pipeline kanban with drag-to-change-stage (server fn updates row + writes activity).
- Auto-link: if a CRM account converts (deal won), one click provisions a real `schools` row + sends signup invite.
- Reuse existing `leads` table data as a feed into `crm_leads` (website signups auto-appear in CRM).
- AI assist: "Draft follow-up email" button uses Lovable AI Gateway with lead context.
- Activity reminders surface in PR 6's notification system.
- CSV import + export.
- Search across accounts/contacts/deals.

**Optional integrations (later, on request):**
- Email send via connected provider (Gmail/Outlook).
- Calendar sync.
- WhatsApp Business API for outreach logging.

---

## Cross-cutting

- Every new public-schema table includes `GRANT` + RLS + policies in the same migration.
- All AI calls go through Lovable AI Gateway (no extra keys).
- All server-side writes use `createServerFn` with `requireSupabaseAuth` + explicit role checks for privileged actions.
- After every PR: run security linter, fix high-severity findings before merging next.

---

## Suggested execution order
1, 2, 3, 4, 5, 6, 7, 8, 9 — but **PR 9 (CRM)** can run in parallel with PRs 5–8 since it shares no tables with the platform tenant data.

Tell me which PR to start with (I recommend **PR 1**) or whether to begin PR 9 (CRM) in parallel.