# Project Status

Date: 2026-07-11

Project: CurriculumOS / Syllabus Synk

Overall status: Active development. Broad product surface is implemented or prototyped, but the project is not yet production-ready until the production-readiness blockers are closed and full build/type checks are clean.

This file is the living project record. Update it after every minor or major product change so the homepage AI Help Assistant can stay aligned with current capabilities, known gaps, and recent amendments. The detailed release-gate checklist lives in `PRODUCTION_READINESS_REVIEW.md`; keep both documents aligned when production blockers change.

## Current Product Positioning

Syllabus Synk / CurriculumOS is both:
- An Academic Planning Platform for school calendars, teaching capacity, syllabus completion, curriculum generation, exports, execution monitoring, governance, and academic operations.
- A Future-Ready Education Ecosystem through AI Leadership Suite and AI Future Workforce / AI Future Force, helping schools prepare students and teachers for AI-enabled careers and emerging technologies.

## Current Product Scope

Implemented or partially implemented areas include:
- Public marketing website, demo lead capture, partner/referral landing page, visitor proof counters, AI Leadership Suite messaging, and AI Future Workforce homepage section.
- Floating homepage AI Help Assistant with local fallback answers and optional AI-provider answers.
- Authentication with email/password, Google sign-in, reset-password flow, invitation preview, and invitation acceptance.
- Authenticated dashboard and app shell navigation.
- Institution onboarding for school profile, board, fees, textbooks, teaching matrix, calendar, holidays, events, exams, and teacher training days.
- Tutor/coaching onboarding for retail single-access users with one class, one subject, textbook, class duration, holidays, and exams.
- Capacity-aware academic planning that subtracts holidays, vacations, weekly offs, exams, events, training days, and buffer days.
- AI annual calendar generation, per-subject curriculum generation, schedule recalculation, AI credit accounting, run history, PDF/DOCX exports, demo watermarking, version history, and soft-delete/recycle-bin foundations.
- Teacher curriculum proposal workflow for proposed changes, AI review, finalization, teacher acknowledgement, and admin review.
- AI Leadership Suite V2: principal dashboard, teacher copilot, content studio, assessment generator, academic digital twin, teacher intelligence, student intelligence, and parent communication drafts.
- AI Future Workforce / AI Future Force add-on with grade-wise AI curriculum previews, one/two weekly AI class planning, monthly releases, foundation module for late-session enrollment, teacher enablement messaging, and future-career positioning.
- Academic Execution module for daily teacher progress logging and principal/coordinator monitoring.
- Teacher assignment management.
- School Governance module for official School Super Admin declaration, delegated authority visibility, session registry foundation, and recycle-bin governance.
- Seat invitations and member management with role assignment and subscription seat limits.
- School Profile read-only source of truth for academic setup and audit visibility.
- School Storage backed by AWS S3 signed upload/download URLs and subscription storage quotas.
- School CRM for contacts, admissions enquiries, admission stage updates, and open follow-ups.
- Company CRM for super-admin operations, school accounts, subscriptions, support/onboarding tickets, plan catalog, visitor conversion, acquisition/referral attribution, and pipeline metrics.
- Admin & CRM dashboard for leads, clients, subscriptions, usage, AI usage, AI model settings, schools, admin access, partner enforcement, curriculum reviews, and audit logs.
- Partner program with referral code/link, statistics, commission records, and enforcement workflow.
- Notifications and cron foundations for reminders, curriculum risk, disruption notices, unread counts, and mark-read/delete actions.
- Platform health, audit logs, activity records, AI model policy/settings, and review-confirmation logs.
- Pricing and billing screens for USD/INR monthly and annual plans, Stripe checkout/portal, Razorpay subscriptions, optional UPI panel, add-ons, AI credit top-ups, extra seats, extra campuses, and separately quoted services.

## Recent Work Completed

Recent changes completed through 2026-07-11:
- Expanded the homepage AI Help Assistant knowledge base to cover AI Future Workforce / AI Future Force, AI Leadership Suite, onboarding, planning, execution, governance, CRM, storage, seats, payments, admin, partner, notifications, and support flows.
- Added runtime loading of this `PROJECT_STATUS.md` into AI-provider assistant answers, so future amendments to the project status become part of the assistant's guidance automatically.
- Updated assistant starter prompts and greeting to include AI Future Workforce and teacher preparation.
- Added a dedicated AI Future Workforce homepage section explaining grade-wise learning paths, teacher professional development, curriculum update commitment, and future career awareness.
- Updated homepage feature and workflow labels from AI Future Force to public-facing AI Future Workforce wording where appropriate.
- Added explicit messaging that Computer Science and Technology teachers should continuously upgrade AI knowledge and skills as part of lifelong professional development.
- Added explicit curriculum commitment messaging that the AI Future Workforce Team monitors global AI developments and updates senior-student curriculum with new tools, industry practices, and workforce requirements.
- Fixed a Company CRM issue where the visitor conversion report component referenced an undefined `conversion` query.
- Preserved the existing AI Future Force implementation language in authenticated product areas while aligning public/assistant wording around AI Future Workforce.
- Earlier July work added `PRODUCTION_READINESS_REVIEW.md`, created the initial `PROJECT_STATUS.md`, fixed homepage visitor proof calculations, cleaned contact-form typing, corrected typed `/auth` route usage, and ran focused checks on touched files.

## AI Assistant Knowledge Maintenance

The AI Help Assistant now uses two knowledge layers:
- Static product knowledge in `src/lib/ai-help.functions.ts` for core workflows and safe local fallback answers.
- Dynamic living project context from `PROJECT_STATUS.md`, loaded on the server for AI-provider answers.

Maintenance rule:
- After any minor or major feature change, update this file in the same work session.
- If a feature is added, renamed, moved, gated by plan, or still prototype/partial, record that here.
- If pricing, plan limits, support policy, payment behavior, or AI Future Workforce curriculum details change, update both the relevant source file and this document.
- If a production blocker is completed or newly discovered, update both this file and `PRODUCTION_READINESS_REVIEW.md`.
- The assistant should clearly distinguish implemented features from prototypes, blocked areas, and planned work.

## Module Status

### Public Website and Lead Capture

Status: Implemented with ongoing content refinement.

Working:
- Marketing homepage, feature sections, board/curriculum support messaging, testimonials, contact/demo form, public visitor counters, partner page, and AI Future Workforce homepage visibility.
- Lead capture saves school, contact, board, country, message, acquisition source, and partner/referral context.

Needs work:
- Final client-approved copy review.
- Production analytics validation after deployment.
- Visual QA across mobile and desktop after every homepage amendment.

### AI Help Assistant

Status: Implemented and expanded.

Working:
- Floating help widget on the homepage/root layout.
- Starter prompts, conversation history, local fallback answers, AI-provider answer path, safety rules, and support escalation.
- Knowledge now covers major product modules and AI Future Workforce.
- AI-provider answers load `PROJECT_STATUS.md` as living context.

Needs work:
- Add automated regression tests for common user questions.
- Consider a structured knowledge file or admin-editable knowledge table if non-developers need to update assistant content.
- Ensure every future feature change amends this status file.

### Authentication and Access Control

Status: Partially implemented.

Working:
- Email/password login and signup.
- Google sign-in.
- Password recovery.
- Protected authenticated routes.
- Invitation preview and acceptance.
- Basic global and organization roles.

Needs work:
- Complete role matrix for Company Super Admin, School Super Admin, Principal, Coordinator, Teacher, Administrative Staff, and Viewer.
- Granular module-wise and feature-wise permissions.
- Consistent audit logging for access denials and admin actions.
- End-to-end tests for login, logout, recovery, expired invitations, and role access.

### Onboarding, Capacity, and Curriculum Planning

Status: Implemented core workflow.

Working:
- Institution and tutor onboarding flows.
- School profile, board, region, fee tier, textbooks, teaching matrix, calendar dates, weekly offs, school timings, grade-subject rows, teachers, completed chapters, holidays, vacations, events, exam windows, and training days.
- Capacity calculation and results dashboard.
- Annual calendar generation, subject curriculum generation, recalculation, exports, AI credit balance, and generation history.
- 30-day preview for unpaid users and paid full-year generation path.

Needs work:
- More automated tests for edge cases such as unusual calendars, overlapping holidays/exams/events, and multiple boards.
- Full QA of export formatting and watermarks.
- Confirm generated Supabase types are current for all newer tables.

### AI Leadership Suite

Status: Prototype to partially implemented depending on module.

Working:
- Principal Dashboard.
- Teacher Copilot.
- Content Studio.
- Assessment Generator.
- Academic Digital Twin.
- Teacher Intelligence.
- Student Intelligence placeholder/cohort guidance.
- Parent Communication Hub.
- Human review confirmation before downloads in V2 generator.

Needs work:
- Harden assessment generation so it only uses approved syllabus coverage.
- Add full review/approval/lock/export audit workflow for assessments.
- Connect Student Intelligence to real student, attendance, homework, and assessment datasets.
- Broaden tests around plan gates and V2 output persistence.

### AI Future Workforce / AI Future Force

Status: Implemented as optional add-on with current naming alignment in progress.

Working:
- Authenticated module under AI Future Force.
- Public and assistant messaging now uses AI Future Workforce.
- Grade bands: Classes 1-5, 6-8, 9-12, and Enterprise Classes 1-12.
- One or two AI classes per week.
- Curriculum preview with objectives, outcomes, projects, activities, tools, and examples.
- Monthly release model and foundation module for final-month enrollment.
- Plus-plan eligibility checks and tester access support.
- Teacher enablement and lifelong AI professional development messaging.
- Curriculum-update commitment based on global AI developments and emerging technology trends.

Needs work:
- Decide whether to rename authenticated route/UI from AI Future Force to AI Future Workforce everywhere, or keep Force as internal module name.
- Add payment lifecycle for the add-on if not fully wired to checkout/webhooks.
- Add content governance for monthly releases and senior-student update review.

### Academic Execution and Governance

Status: Partially implemented.

Working:
- Teachers can record daily teaching progress against assignments.
- Principals/coordinators can monitor class-wise, subject-wise, and teacher-wise completion.
- School Super Admin declaration and member authority visibility.
- Session registry foundation and recycle-bin governance display.

Needs work:
- Forced logout/session management policy.
- More granular permission delegation.
- School-level audit logs and activity monitoring.
- Stronger linkage between execution logs and generated curriculum schedule.

### Seats and Teacher Assignments

Status: Partially implemented.

Working:
- Invite admins, coordinators, teachers, and viewers.
- Copy/revoke invitations.
- Remove members.
- Enforce seat availability from plan plus extra seats.
- Assign/revoke teacher access to grade/section/subject.

Needs work:
- User suspension/reactivation.
- Granular permission grants per module.
- Better guardrails around removing critical admins.

### School CRM

Status: Useful prototype.

Working:
- Contacts for parents, admissions, vendors, alumni, and other relationships.
- Admissions enquiries with stage updates.
- Open follow-up display and completion.

Needs work:
- Interaction creation UI expansion.
- Student/parent/teacher/staff workflows.
- Communication history and deeper academic follow-up flows.
- Granular CRM permissions.

### Company CRM and Admin

Status: Partially implemented; one issue fixed on 2026-07-11.

Working:
- Company CRM for super admins.
- School accounts, active subscriptions, support tickets, plan catalog, acquisition attribution, visitor conversion, and pipeline metrics.
- Admin dashboard for leads, clients, subscriptions, usage, AI usage, AI model settings, schools, admin access, partners, proposals, and audit logs.
- Company CRM visitor conversion query bug fixed.

Needs work:
- Verify Company CRM after build/runtime because this area had an undefined query issue.
- Complete operational CRM workflows for renewals, onboarding, training, support, usage analytics, revenue, and account management.
- Dedicated Company Super Admin role separate from school/org super admin.
- Secret PIN/security-code challenge for private admin access.
- Full audit logging for failed admin access attempts.

### Payments, Plans, and Usage

Status: Partially implemented.

Working:
- Plan catalog and pricing for retail, primary, middle, high, enterprise, and plus tiers.
- USD/INR monthly and annual pricing.
- AI credit limits and action costs.
- Add-ons for AI credits, extra users, extra campus, and AI Future Force bands.
- Stripe checkout/portal infrastructure.
- Razorpay subscription creation and webhook status updates.
- UPI panel placeholder/path.
- Usage and AI credit reporting.

Needs work:
- Payment failure handling.
- Invoice storage and invoice UI.
- Renewal and failure audit trail.
- Webhook idempotency/replay tracking.
- End-to-end payment lifecycle tests across Stripe, Razorpay, UPI, add-ons, and plan changes.

### Storage

Status: Implemented core upload/download flow.

Working:
- AWS S3 signed upload/download flow.
- File metadata in Supabase.
- Quota display based on plan.
- Delete action.

Needs work:
- S3 CORS and production bucket validation.
- File category/retention policies.
- Granular file permissions and audit trail.

### Partner and Referral Program

Status: Partially implemented.

Working:
- Partner onboarding.
- Referral code/link.
- Partner statistics and commission records.
- Admin enforcement workflow.
- Acquisition attribution in leads and Company CRM.

Needs work:
- Complete payout workflow.
- Full fraud/review process.
- Partner communications and reporting polish.

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
- School CRM and Company CRM are useful prototypes but not complete operational systems.
- Supabase generated TypeScript types are stale for newer CRM, analytics, and subscription tables.
- Full TypeScript/build checks still fail or cannot complete cleanly in the current sandbox environment.

See `PRODUCTION_READINESS_REVIEW.md` for the detailed requirement-by-requirement checklist.

## Technical Health

Known issues:
- Full Vite build is blocked in the sandbox by parent-folder access during config loading.
- A full `tsc --noEmit` run hung in this environment and had to be stopped manually.
- Generated Supabase types appear stale for newer tables.
- Some route/search typing and broader lint/type issues may remain outside the recently touched files.
- Company CRM should receive runtime QA after the newly added visitor conversion query.

Recent focused checks:
- Focused syntax transpile passed for edited files after the AI Future Workforce homepage and assistant updates.
- Earlier focused lint and filtered TypeScript checks passed for previously changed files.

## Documentation Relationship

`PROJECT_STATUS.md`:
- Living high-level project record.
- Current module status.
- Recent work completed.
- AI assistant knowledge context.
- Technical health snapshot.

`PRODUCTION_READINESS_REVIEW.md`:
- Mandatory production-readiness checklist.
- Requirement-by-requirement validation.
- Release blockers and acceptance criteria.

These files are intentionally related, but not duplicates.
