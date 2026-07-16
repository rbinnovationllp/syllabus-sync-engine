# Production Readiness Review

Date: 2026-07-16

This document records mandatory validation checkpoints for CurriculumOS before the project is considered production-ready. Each item must be verified in code, database policy, UI workflow, and operational testing.

Related status file: `PROJECT_STATUS.md` contains the high-level project progress summary. This file contains the detailed production-readiness gate and mandatory validation criteria.

## 1. User Authentication and Access Control

Status: Partially implemented; not production-ready.

Current implementation:
- Email/password login, sign-up, Google sign-in, logout, invitation acceptance, and password recovery exist in `src/routes/auth.tsx` and `src/routes/reset-password.tsx`.
- Authenticated app routes are protected by `src/routes/_authenticated/route.tsx`.
- Server functions use `requireSupabaseAuth` for bearer-token verification.
- Global roles exist through `user_roles`; organization roles exist through `org_members`.
- School seat invitation supports `admin`, `coordinator`, `teacher`, and `viewer` roles.

Mandatory gaps:
- Redirects and links to `/auth` must consistently provide the generated route search params.
- Role checks are not consistently granular by module and feature.
- There is no complete role matrix for Company Super Admin, School Super Admin, Principal, Coordinator, Teacher, Administrative Staff, and Viewer.
- Logout, recovery, role denial, expired invitation, and invalid token flows need end-to-end tests.
- Failed direct access attempts are not consistently logged.
- Tenant isolation, cross-school access denial, export authorization, and role-scoped data visibility must be tested across every school-owned table and workflow.

## 2. Razorpay Integration

Status: Partially implemented; not production-ready.

Current implementation:
- Razorpay subscription creation exists in `src/lib/razorpay.functions.ts`.
- Checkout is launched by `src/components/RazorpaySubscriptionButton.tsx`.
- Webhook signature verification and subscription status upsert exist in `src/lib/razorpay.webhook.server.ts`.
- Webhook route exists at `/api/public/razorpay/webhook`.
- Verified Razorpay storage add-on payment events can automatically activate additional storage for Indian operations, write CRM allocation events, notify School Super Admins, and create support/audit records on failure. Stripe hooks remain future-ready for international markets when activated.
- Paid pilot refund approval can initiate Razorpay refunds from Company CRM after Company Super Admin secret-code confirmation, original Razorpay payment ID verification, server-side refund calculation, audit logging, and refund transaction recording.
- Subscription gating uses `has_active_subscription`.

Mandatory gaps:
- Razorpay payment failure events are partially handled for subscription access and storage allocation exceptions, but the full billing lifecycle still needs production testing.
- Paid pilot refund workflow must be tested in Razorpay test mode and staging with real test payment IDs before live use.
- AI Teaching Credit top-up purchase and monthly allocation replenishment still need billing automation if schools will purchase separate teaching-credit packs beyond manual School Super Admin allocation.
- Syllabus-aware Daily Teaching Assistant is implemented from assigned teacher subjects and generated curriculum week numbers; production rollout should validate exact timetable/date matching once per-period lesson scheduling is fully connected.
- Invoice records and invoice viewing are not implemented.
- Payment status, renewals, cancellations, pauses, resumes, and failures need full test coverage.
- Webhook replay/idempotency handling should be explicit.
- Subscription status changes should be auditable.
- The active-subscription gate currently treats `created` and `past_due` as active; this must be reviewed before production.

## 3. Company Super Admin Access

Status: Partially implemented; not production-ready.

Current implementation:
- A global `super_admin` role exists.
- Super admins can access platform health, company CRM operations, analytics, admin audit logs, and selected system-wide data.
- Company CRM and site analytics server functions require `super_admin`.

Mandatory requirement:
- Provide a dedicated Company Super Admin role that is separate from School Super Admin.
- Company Super Admin must have unrestricted access to review, test, audit, and monitor all modules and features across all schools without requiring subscription purchase, trial, activation, or payment.
- Company Super Admin must view analytics, usage reports, subscription status, billing status, support records, CRM data, and system-wide configurations.
- Company Super Admin access must bypass plan limitations while remaining fully audited.

Additional Requirement - Company Super Admin/Owner Privileged Access:
- The Company Super Admin/Owner must have permanent unrestricted access to all modules, features, schools, and user accounts without going through any subscription, payment, trial, or activation process.
- This access is required to investigate, reproduce, and resolve issues reported by schools, teachers, coordinators, principals, or other users.
- The Company Super Admin must be able to securely access the environment of any subscribed school for troubleshooting purposes while maintaining appropriate audit logs.
- The system must provide an option for the Company Super Admin to temporarily assume the role of any authorized user, including School Super Admin, Principal, Coordinator, Teacher, and Administrative Staff, in a controlled manner.
- Role assumption must support verification of reported errors, permission issues, workflow problems, and feature malfunctions.
- All privileged access and role-assumption activities must be recorded in system audit logs for transparency and compliance.
- This privileged access must remain available at all times, regardless of subscription status, plan limitation, trial status, or payment status of the school.

Hidden Company Admin Login and Secure Access Requirement:
- The Company Admin Dashboard must remain completely hidden from the public website.
- The company admin login must be accessible only through a private URL such as `https://www.syllabus-synk.in/admin`.
- No `Admin Login`, `Company Admin`, or `Super Admin` button, link, text, or description may appear on the homepage, footer, menu, pricing page, partner page, or any public page.
- Company Admin login must require registered admin email or username, strong password, and an additional secret access code or security PIN.
- The secret code must be configurable by the Company Owner/Super Admin and must not be visible to schools or public users.
- The hidden admin panel is strictly for Company Super Admin/Owner management of the platform, subscriptions, schools, users, CRM, support issues, billing review, client-reported error verification, QA, and maintenance.
- This must remain separate from School Admin/Super Admin dashboards.
- School Admin/Super Admin dashboards must never provide access to the Company Admin Dashboard.
- Direct access attempts to the company admin route without valid credentials and secret code must be blocked, logged, and safely redirected.
- All company admin login attempts, successful or failed, must be recorded in audit logs.

Mandatory gaps:
- There is no dedicated `company_super_admin` role separate from school/org `super_admin`.
- There is no controlled role-assumption feature.
- There is no secret PIN/code challenge for `/admin`.
- Failed `/admin` access attempts are not logged.
- Company Super Admin subscription bypass is not centralized across all feature gates.

## 4. Examination and Question Paper Generation

Status: Prototype only; not production-ready.

Current implementation:
- `src/routes/_authenticated/v2.assessments.tsx` provides an AI assessment generator.
- Supported labels include Class test, Weekly test, Unit test, Half-yearly exam, Mid-term exam, Annual exam, Practice paper, and Chapter-wise assessment.
- Output is saved as editable `v2_ai_outputs`.

Mandatory gaps:
- Fortnightly Tests, Monthly Tests, Quarterly Examinations, Subject-wise Question Papers, and Practice/Assessment Papers must be explicit workflow types.
- The generator does not yet enforce approved syllabus coverage.
- There is no approval workflow before paper generation.
- There is no structured coverage submission from Class Teacher, Subject Teacher, Academic Coordinator, or Principal.
- There is no rule preventing unapproved syllabus portions from appearing in generated question papers.
- There is no question-paper review, approval, versioning, lock, export, or print audit trail.

Required production workflow:
1. Teacher submits syllabus coverage by class, subject, chapter, learning outcome, and completion date.
2. Coordinator or Principal reviews and approves coverage.
3. Question paper generator reads only approved coverage records.
4. Generated paper is saved as draft.
5. Competent authority reviews and approves the paper.
6. Final paper is locked and exported with audit history.

## 5. School Super Admin Delegation Framework

Status: Partially implemented; not production-ready.

Current implementation:
- School admins can invite and remove members through the seat-management flow.
- Supported school roles include admin, coordinator, teacher, and viewer.
- Teacher assignments exist for grade/section/subject assignment.

Mandatory gaps:
- There is no granular permission matrix.
- Permissions are not configurable module-wise and feature-wise per staff member.
- There is no suspend/reactivate user-account flow.
- There is no immediate access-restriction workflow beyond member removal.
- Activity monitoring and audit logs for school-level user management are incomplete.
- Principal and administrative staff roles are not fully modeled as first-class permissions.

## 6. CRM Integration

Status: Partially implemented; not production-ready.

Current implementation:
- School CRM tables and functions exist for contacts, admissions enquiries, and interactions.
- Company CRM exists for accounts, deals, support tickets, subscription profiles, plan catalog, site analytics, and subscriptions.
- Company CRM access is restricted to `super_admin`.

Mandatory gaps:
- School CRM does not yet fully model students, parents, teachers, staff, academic follow-ups, and communication records as separate complete workflows.
- Master CRM reporting is present but incomplete for onboarding, renewal operations, revenue management, training, and consolidated school usage.
- CRM permissions are not yet granular by role or feature.
- Several new CRM tables are missing from generated Supabase TypeScript types, causing TypeScript failures.

## 7. School Data Privacy, Security, and Ask SynkAI Knowledge Governance

Status: Framework added; not independently production-verified.

Current implementation:
- School Data Privacy, Security & Confidentiality Framework is documented in Terms, School Governance, Ask SynkAI knowledge, and database seed policy.
- The framework states school data ownership, platform custodian role, no unauthorized sale/sharing/commercial use, tenant isolation, role-based access, company-admin support access limits, encryption expectations, audit logging, backups, secure exports, and future security principles.
- Ask SynkAI has a managed knowledge-index foundation with Company Super Admin refresh/review/approval controls and unknown-question support-ticket escalation.
- School Storage uses AWS S3 signed upload/download URLs for large school files, while Supabase remains the application data and metadata system.

Mandatory gaps:
- Verify tenant isolation through automated tests for every school-scoped table.
- Verify teachers can only access assigned classes/subjects and cannot infer another school's data through search, export, dashboard, CRM, storage, or AI workflows.
- Verify Company Super Admin support/troubleshooting access is explicitly authorized, scoped, and audit logged.
- Verify sensitive exports are permission-controlled, scoped to authorized data, and audit tracked.
- Document operational backup, restore, incident-response, and disaster-recovery procedures.
- Confirm production database, backups, object storage, and transport encryption settings with the hosting providers.
- Add scheduled or release-triggered Ask SynkAI knowledge refresh and approval workflow after deployments.

## Release Gate Summary

Production readiness is blocked until:
- Company Super Admin is separated from School Super Admin and given audited, subscription-independent privileged access.
- Hidden admin login receives secret-code/PIN protection and logs every successful and failed attempt.
- Razorpay failure, renewal, invoice, and audit workflows are implemented and tested.
- Question-paper generation is tied to approved syllabus coverage only.
- School Super Admin gets module-wise and feature-wise permission delegation.
- School CRM and Master CRM are completed and covered by role-based permissions.
- School data privacy/security controls, tenant-isolation tests, export audits, backup/recovery procedures, and Ask SynkAI knowledge approval process are production verified.
- Supabase generated types are refreshed for all new tables.
- Full TypeScript, lint, build, and end-to-end checks pass.
