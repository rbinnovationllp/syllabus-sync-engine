# Project Status

Date: 2026-07-01

Project: CurriculumOS / Syllabus Sync

Overall status: Active development. Not production-ready.

This status file is the high-level project progress summary. The detailed release-gate checklist lives in `PRODUCTION_READINESS_REVIEW.md`. Keep both documents aligned: update this file when major work is completed, and update the readiness review when a production checkpoint changes from blocked to complete.

## Current Product Scope

CurriculumOS is an AI-assisted school operating system for academic planning, syllabus completion, school administration, subscriptions, CRM, and leadership workflows.

Implemented or partially implemented areas include:
- Public marketing website and partner/referral landing page.
- User authentication with email/password, Google sign-in, password recovery, and invitation acceptance.
- Authenticated dashboard shell.
- School onboarding and academic-year setup.
- Capacity-aware academic planning.
- AI curriculum generation and export workflows.
- AI Leadership Suite V2 prototypes: principal dashboard, teacher copilot, content studio, assessment generator, simulations, teacher intelligence, student intelligence, and parent communication drafts.
- Subscription plans, pricing screens, usage tracking, and subscription gating.
- Razorpay subscription creation and webhook-based subscription status updates.
- Stripe-related payment infrastructure from earlier implementation.
- School seat invitations and member management.
- School CRM prototype for contacts, admissions enquiries, and interactions.
- Company/Master CRM prototype for accounts, deals, support tickets, subscription profiles, plan catalog, site analytics, and subscriptions.
- Public site visitor analytics and homepage proof counters.
- Company admin and super-admin views for admin CRM, platform health, AI usage, AI model settings, curriculum reviews, partner enforcement, and audit logs.

## Recent Work Completed

Recent changes completed in this workspace:
- Added `PRODUCTION_READINESS_REVIEW.md` as the mandatory production-readiness checklist.
- Added this `PROJECT_STATUS.md` summary so the project has both a high-level status file and a detailed readiness review.
- Fixed homepage public visitor proof calculations so the landing page uses server-prepared totals instead of mixing visit counts into visitor counts.
- Cleaned up contact-form error and input typing on the landing page.
- Fixed typed `/auth` route usage on the landing page, partner page, logout redirect, protected-route redirect, and reset-password redirect by passing the required `invite` search shape.
- Removed a loose route cast in the app shell for the AI Suite link.
- Ran focused lint checks on changed files successfully.
- Ran filtered TypeScript checks for changed files successfully.

## Production Readiness Summary

Production readiness is currently blocked.

Primary blockers:
- Company Super Admin is not yet separated from School Super Admin as a dedicated role.
- Company Super Admin does not yet have centralized, audited, subscription-independent bypass access across every module.
- Controlled role-assumption/troubleshooting access is not implemented.
- Hidden company admin login exists only as a protected route; it does not yet require a separate secret PIN/security code.
- Failed company admin access attempts are not fully logged.
- Razorpay integration does not yet cover payment failure events, invoice records, renewals, replay-safe webhook auditing, or complete payment lifecycle tests.
- Assessment/question-paper generation is still a draft generator and does not yet enforce approved syllabus coverage.
- School Super Admin delegation is not granular module-wise and feature-wise.
- School CRM and Company/Master CRM are useful prototypes but not complete operational systems.
- Supabase generated TypeScript types are stale for newer CRM, analytics, and subscription tables.
- Full TypeScript/build checks still fail because of broader existing issues.

See `PRODUCTION_READINESS_REVIEW.md` for the detailed requirement-by-requirement checklist.

## Module Status

### Authentication and Access Control

Status: Partially implemented.

Working:
- Email/password login and sign-up.
- Google sign-in.
- Password recovery.
- Authenticated route protection.
- Invitation preview and acceptance.
- Basic global and organization roles.

Needs work:
- Complete role matrix for Company Super Admin, School Super Admin, Principal, Coordinator, Teacher, Administrative Staff, and Viewer.
- Module-wise and feature-wise permission checks.
- Consistent audit logging for access denials and admin actions.
- End-to-end tests for login, logout, recovery, expired invitations, and role access.

### Company Super Admin

Status: Partially implemented.

Working:
- Global `super_admin` role exists.
- Super-admin-only server functions exist for platform health, company CRM, site analytics, and audit views.

Needs work:
- Dedicated `company_super_admin` role separate from school/org roles.
- Permanent subscription-independent access to all schools and modules.
- Secure role-assumption workflow.
- Secret PIN/security-code challenge for private admin access.
- Full audit logging for all privileged access and failed access attempts.

### Razorpay and Subscriptions

Status: Partially implemented.

Working:
- Razorpay subscription creation.
- Checkout button.
- Webhook signature verification.
- Subscription upsert from selected webhook events.
- Active subscription gate.

Needs work:
- Payment failure handling.
- Invoice storage and invoice UI.
- Renewal and failure audit trail.
- Webhook idempotency/replay tracking.
- Review of active statuses such as `created` and `past_due`.

### Examination and Question Paper Generation

Status: Prototype.

Working:
- V2 assessment generator can create editable assessment drafts.

Needs work:
- Explicit weekly, fortnightly, monthly, quarterly, half-yearly, annual, subject-wise, practice, and assessment paper workflows.
- Approved syllabus coverage records.
- Approval flow from teacher/coordinator/principal before generation.
- Guardrails so only approved syllabus portions appear in generated papers.
- Review, approval, lock, export, and audit trail.

### School Super Admin Delegation

Status: Partially implemented.

Working:
- School admins can invite, revoke invitations, and remove members.
- Teacher assignment workflow exists.

Needs work:
- User suspension/reactivation.
- Granular per-user permissions.
- Module-wise and feature-wise access grants/restrictions.
- School-level audit logs and activity monitoring.
- First-class Principal and Administrative Staff role handling.

### CRM

Status: Partially implemented.

Working:
- School CRM tables/functions for contacts, enquiries, and interactions.
- Company CRM tables/functions for accounts, deals, support tickets, subscription profiles, plans, analytics, and subscriptions.

Needs work:
- Complete school CRM workflows for students, parents, teachers, staff, communication, and academic follow-ups.
- Complete Master CRM workflows for renewals, onboarding, training, support, usage analytics, revenue, and account management.
- Granular CRM permissions.
- Fresh Supabase generated types for new CRM tables.

## Technical Health

Known issues:
- Full TypeScript check fails because generated Supabase types do not include several newer tables.
- Some route/search typing issues remain outside the files fixed in the latest pass.
- Full Vite build was blocked in the sandbox by parent-folder access during config loading.
- Full project lint has many existing formatting/type issues outside the recently touched files.

Recent focused checks:
- Focused lint passed for changed files.
- Filtered TypeScript check showed no errors for changed files.
- `git diff --check` passed.

## Documentation Relationship

`PROJECT_STATUS.md`:
- High-level progress summary.
- Current module status.
- Recent work completed.
- Technical health snapshot.

`PRODUCTION_READINESS_REVIEW.md`:
- Mandatory production-readiness checklist.
- Requirement-by-requirement validation.
- Release blockers and acceptance criteria.

These files are intentionally related, but not duplicates.
