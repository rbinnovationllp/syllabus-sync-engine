# Project Status

Date: 2026-07-17

Project: CurriculumOS / Syllabus Synk

Overall status: Active development. Broad product surface is implemented or prototyped, but the project is not yet production-ready until the production-readiness blockers are closed and full build/type checks are clean.

This file is the living project record. Update it after every minor or major product change so the homepage AI Help Assistant can stay aligned with current capabilities, known gaps, and recent amendments. The detailed release-gate checklist lives in `PRODUCTION_READINESS_REVIEW.md`; keep both documents aligned when production blockers change.

## Current Product Positioning

Syllabus Synk / CurriculumOS is both:
- An Academic Planning Platform for school calendars, teaching capacity, syllabus completion, curriculum generation, exports, execution monitoring, governance, and academic operations.
- A Future-Ready Education Ecosystem through AI Leadership Suite and AI Future Workforce / AI Future Force, helping schools prepare students and teachers for AI-enabled careers and emerging technologies.

It is best described for schools as a cloud-based, web-based software platform / web-based application. It helps schools prepare capacity-aware syllabus plans, track teacher progress, monitor syllabus completion, manage academic workflows, and support future-ready AI education programs through secure online dashboards.

The project uses AI assistant and agent-style capabilities in several areas, though not every part is a fully autonomous agent. Main AI/agent-style areas include Ask Synk AI, AI Curriculum Generation, AI Leadership Suite, AI Future Force / AI Future Workforce, AI Teaching Assistant, Teacher Credit Recommendation Engine, and Ask SynkAI Knowledge Sync. The next higher level can include autonomous agents for syllabus-delay recovery, daily teacher progress checks, principal reports, post-deployment knowledge refresh, and lead/support-ticket follow-up.

Teachers can access their dashboard from mobile phones, tablets, or computers through a browser. This is useful when teachers are not expected or allowed to carry laptops into classrooms. Teachers can use mobile phones for daily lesson status updates, topics taught, syllabus progress, and quick AI teaching support. For the best experience, school administrators should use laptops or desktops for larger planning, reporting, setup, and review tasks.

Book-content positioning: Syllabus Synk does not require schools to upload full textbooks for syllabus planning and must not claim access to all publisher book content on the internet. It plans from official curriculum frameworks, NCERT/state-board resources where officially available, school-entered book details, chapter lists, unit structures, learning objectives, prescribed syllabus outlines, teaching periods, holidays, exams, and teacher inputs. For private publisher books, schools can enter book name, publisher, class, subject, chapter list, and unit structure. The Curriculum Mapping Module maps private-publisher chapter lists against recognized/open curriculum-style references where available, assigns confidence/status, estimates periods, and asks for summary/objectives/topics/key concepts only when a chapter cannot reasonably be mapped. If deeper chapter-specific teaching assistance is needed, teachers may upload or paste only the relevant permitted section for internal academic support. Syllabus Synk plans from curriculum structure and chapter lists, not from copyrighted textbook scraping.

## Current Product Scope

Implemented or partially implemented areas include:
- Public marketing website, demo lead capture, partner/referral landing page, visitor proof counters, AI Leadership Suite messaging, and AI Future Workforce homepage section.
- Floating homepage visitor assistant renamed to Ask Synk AI, with local fallback answers, optional AI-provider answers, approved knowledge-index loading, and support-ticket escalation for unknown questions.
- Ask Synk AI can describe Syllabus Synk as a cloud-based/web-based school software platform, explain AI assistant/agent-style capabilities, and clarify mobile teacher-dashboard usage.
- Authentication with email/password, Google sign-in, reset-password flow, invitation preview, and invitation acceptance.
- Authenticated dashboard and app shell navigation.
- Institution onboarding for school profile, board, fees, textbooks, teaching matrix, calendar, holidays, events, exams, and teacher training days.
- Tutor/coaching onboarding for retail single-access users with one class, one subject, textbook, class duration, holidays, and exams.
- Capacity-aware academic planning that subtracts holidays, vacations, weekly offs, exams, events, training days, and buffer days.
- AI annual calendar generation, per-subject curriculum generation, schedule recalculation, AI credit accounting, run history, PDF/DOCX exports, demo watermarking, version history, and soft-delete/recycle-bin foundations.
- Curriculum Mapping Module for copyright-safe private publisher planning: chapter-level mapping, recognized/open curriculum comparison, confidence scoring, unique-chapter information requests, school approval, and approved mapping use inside syllabus generation.
- Teacher curriculum proposal workflow for proposed changes, AI review, finalization, teacher acknowledgement, and admin review.
- AI Leadership Suite V2: principal dashboard, teacher copilot, content studio, assessment generator, academic digital twin, teacher intelligence, student intelligence, and parent communication drafts.
- AI Teaching Assistant / Teacher Copilot for activity-based learning, demonstrations, stories, role-play, project ideas, local examples, visual learning, interactive exercises, syllabus-aware daily lesson help, school-controlled AI Teaching Credits, and reusable AI Teaching Innovation Library.
- AI Teaching Resource Studio / Content Studio for chapter-list mapped teaching packs, activity-based lesson packs, worksheets, quizzes, answer keys, flashcards, question banks, revision notes, slide outlines, projects, experiments/demonstrations, real-life example banks, diagram-labeling activities, timeline activities, concept maps, interactive classroom templates, remedial practice packs, teacher micro-training modules, and AI Future Force lab activities.
- Tata ClassEdge gap-closer positioning: Syllabus Synk is being strengthened toward a richer teaching-learning ecosystem, but base subscription prices remain unchanged; normal usage is adjusted through included monthly AI credits and optional AI credit top-ups for high-volume generation.
- AI Future Workforce / AI Future Force add-on with a web-based Class 1-12 curriculum planner, grade-wise AI curriculum previews, one/two weekly AI class planning, one-month demo plan request flow, monthly releases, foundation module for late-session enrollment, teacher enablement messaging, and future-career positioning.
- Academic Execution module for daily teacher progress logging, expanded lesson/session statuses, principal/school-admin monitoring, daily exception reports, and Teacher Credit Distribution Recommendations.
- Teacher assignment management.
- School Governance module for official School Super Admin declaration, delegated authority visibility, school data privacy/security assurance, session registry foundation, and recycle-bin governance.
- Seat invitations and member management with role assignment and subscription seat limits.
- School Profile read-only source of truth for academic setup and audit visibility.
- School Storage backed by AWS S3 signed upload/download URLs, with Supabase metadata, subscription storage quotas, Super Admin storage analytics, threshold alerts, additional storage allocation support, and academic-session archive metadata.
- School CRM for contacts, admissions enquiries, admission stage updates, and open follow-ups.
- Company CRM for super-admin operations, school accounts, subscriptions, support/onboarding tickets, plan catalog, visitor conversion, acquisition/referral attribution, and pipeline metrics.
- Admin & CRM dashboard for leads, clients, subscriptions, usage, AI usage, AI model settings, schools, admin access, partner enforcement, curriculum reviews, and audit logs.
- Partner program with referral code/link, statistics, commission records, and enforcement workflow.
- Notifications and cron foundations for reminders, curriculum risk, disruption notices, unread counts, and mark-read/delete actions.
- Platform health, audit logs, activity records, AI model policy/settings, and review-confirmation logs.
- Pricing and billing screens for USD/INR monthly and annual plans, Razorpay-first India checkout, future-ready Stripe international checkout/portal, optional UPI panel, add-ons, AI credit top-ups, extra seats, extra campuses, and separately quoted services.
- Paid Pilot Subscription Benefit workflow for approved pilot schools, Company Super Admin refund/credit approval, Razorpay refund initiation, and school credit-ledger tracking.

## Recent Work Completed

Recent changes completed through 2026-07-17:
- Added Curriculum Mapping Module foundation: Supabase tables for curriculum standard references, mapping runs, chapter mappings, and unique-chapter information requests; server-side mapping engine; authenticated school mapping page; AppShell navigation; and syllabus-generation integration with approved mappings.
- Added copyright-safe book-content policy across planning, homepage positioning, onboarding, pricing/status docs, and Ask Synk AI: no full textbook upload required, NCERT/state/open resources used only where officially available, and private publisher planning uses chapter lists, unit structure, and permitted extracts only.
- Expanded AI Content Studio into AI Teaching Resource Studio positioning with chapter-list mapped teaching packs, activity-based lesson packs, worksheets, quizzes, answer keys, slide outlines, interactive classroom templates, teacher micro-training modules, and AI Future Force lab activities.
- Added base-price-protection policy for Tata-style teaching-support enhancements: current subscription prices remain unchanged, normal usage consumes included monthly AI credits, and optional AI credit top-ups handle heavy AI generation.
- Updated Ask Synk AI knowledge and project positioning so it can answer questions about Syllabus Synk as a cloud-based/web-based software platform, the project's AI assistant/agent-style workflows, future autonomous-agent opportunities, and teacher dashboard access from mobile phones.
- Fixed homepage public visitor proof counter instability: removed the artificial `currentOpen` addition and replaced fallback numeric counts with loading placeholders so the count no longer flashes from the baseline value such as 177 to the live database value after refresh.
- Added AI Teaching Assistant premium workflow inside the Teacher Copilot page: teachers can ask "How can I teach this topic effectively?" for any chapter, topic, sub-topic, or learning objective and receive activity-based teaching methods, classroom demonstrations, practical examples, stories, role-play, group activities, projects, local environment examples, real-world applications, visual ideas, and interactive exercises.
- Added multi-subject support for teaching suggestions across Science, Mathematics, Social Science, English, Hindi, languages, Computer Science, Environmental Studies, Commerce, Economics, Geography, History, Physics, Chemistry, Biology, and future subjects.
- Added AI Teaching Credits as a separate school-controlled premium credit model with a monthly school credit pool, purchased-credit extension field, teacher allocation controls, and request costs: Simple Activity Suggestion = 1 credit, Detailed Activity Plan = 2 credits, Complete Teaching Toolkit = 5 credits, Project-Based Learning Plan = 5 credits, and Multi-Day Activity Module = 10 credits.
- Added School Super Admin credit allocation controls in the teaching assistant workspace, including teacher-wise monthly allocation, increase/reduction within used-credit limits, and consumption monitoring.
- Added teacher-facing credit visibility: available credits, used credits, monthly allocation, estimated cost before generation, and credit transaction history.
- Added AI Teaching Innovation Library so teachers can bookmark, search, save, and reuse effective teaching methods without consuming additional credits.
- Added syllabus-aware Daily Teaching Assistant integration inside Academic Execution: teachers see today's planned topics derived from assigned class/subject and generated subject curriculum week, then can request Explain Full Topic, Explain Selected Portion, Generate Activity, Real-Life Examples, Teacher Notes, Student Question Help, Beyond Textbook Explanation, or Revision Summary without re-entering class, subject, board, book, chapter, topic, objectives, or academic calendar context.
- Added daily planned-topic AI help generation with AI Teaching Credit deduction, teacher assignment validation, syllabus context metadata, and storage in the teaching-generation history.
- Added Supabase migration `20260716000200_ai_teaching_assistant_credits.sql` for teaching credit allocations, teaching credit transactions, generated teaching suggestions, and reusable library items with tenant-aware RLS and service-role controls.
- Updated Ask Synk AI knowledge so it can explain the AI Teaching Assistant, AI Teaching Credits, credit costs, School Super Admin allocation controls, and reuse-without-credit library behavior.
- Added Paid Pilot Subscription Benefit workflow: Company Super Admin can mark schools as Approved Pilot School with MOU reference/link, pilot dates, approved plan, monthly base subscription amount, GST, gateway/bank/other charges, total paid, GST treatment, eligibility status, and internal notes.
- Added school-side pilot benefit request controls in School Governance: School Super Admin can choose Continue Subscription and Claim Pilot Credit or Discontinue Subscription and Request Refund; refund requests require the original Razorpay payment ID.
- Added Company CRM Pilot Benefits tab for pending refund/credit approvals, MOU/payment visibility, server-side calculation review, secure admin-code approval, mandatory deduction reasons, reject/hold/return actions, credit ledger visibility, and Razorpay refund tracker.
- Added Supabase pilot workflow tables: `pilot_programs`, `pilot_benefit_requests`, `school_credit_ledger`, `refund_transactions`, and `credit_adjustments`, with tenant-aware RLS, service-role controls, permanent records, indexes, and audit-friendly metadata.
- Added server-side refund/credit calculations with configurable GST treatment, non-refundable gateway/bank/other deductions, Company Super Admin adjustment support, idempotent request keys, audit logs, school notifications, company notifications, Razorpay refund initiation, and future-invoice credit ledger support.
- Updated Ask Synk AI knowledge so it explains paid pilot subscription benefits accurately and avoids calling the two-month pilot a free trial.
- Reversed the Google Workspace / Google Drive storage direction and restored AWS S3 as the primary storage provider for school files; removed the Google-specific provider registry migration, Company CRM storage-provider panel, provider-allocation dashboard, and Google storage messaging.
- Updated Ask Synk AI storage-pricing knowledge and added deterministic priority handling so storage price questions bypass AI-provider drift and always state exact additional storage add-on prices: 25 GB Rs. 250/month, 50 GB Rs. 500/month, 100 GB Rs. 900/month, 250 GB Rs. 2,000/month, 500 GB Rs. 3,500/month, and 1 TB+ custom enterprise pricing via support.
- Added Razorpay-first payment strategy for Indian operations while keeping provider-independent hooks for future Stripe/international gateways.
- Added automatic additional-storage allocation: verified Razorpay payment events now activate purchased storage packs for India, record CRM allocation events, notify School Super Admins, write audit logs, and create urgent Company CRM support tickets plus company notifications if allocation fails; Stripe hooks remain future-ready for international markets.
- Added Ask SynkAI Knowledge Base Auto-Update architecture: indexed knowledge sources, validation status, critical-update approval, sync-run history, Company Super Admin refresh/review/approve controls, and approved-index loading for assistant answers.
- Added Ask SynkAI unknown-question escalation: when the assistant lacks approved knowledge, it gives a passive non-guessing response and creates a Company CRM support-review ticket for support@syllabus-synk.in follow-up.
- Added School Data Privacy, Security & Confidentiality Framework covering school data ownership, tenant isolation, role-based access, company admin support access, encryption expectations, audit logging, backups, secure exports, and confidentiality commitments.
- Added school-facing privacy/security assurance content to Terms and School Governance.
- Added School Super Admin Storage Management controls: allocated/used/available storage metrics, largest files, file-type breakdown, category breakdown, user-wise usage, fair usage policy display, enterprise storage options, and academic-session archive controls.
- Added storage threshold handling for 80%, 90%, and 100% usage; uploads are blocked when quota is reached unless storage is freed, archived, or additional storage is purchased.
- Added Company Super Admin server support to allocate additional storage packs and extended storage metadata for archived academic-session records.
- Added Teacher Credit Distribution Recommendations in Academic Execution for School Super Admin review, including advisory workload scores, balanced/moderate/high-overload/underutilized indicators, and recommendation text.
- Added additional storage pricing policy: 25 GB, 50 GB, 100 GB, 250 GB, 500 GB monthly storage add-ons, 1 TB custom pricing, storage add-on checkout catalog entries, and organization-level `extra_storage_gb` quota support.
- Added daily syllabus progress exception reporting: assigned-vs-completed comparison, automatic exception reports, delay duration, syllabus target impact, corrective recommendations, pending-portion tracking, and in-app alerts for incomplete/rescheduled/not-started teacher updates.
- Fixed the `/auth` page tab wiring so Sign in and Create account are separate forms with the correct submit handlers; signup now has its own name, email, password, and acquisition-source fields.
- Added `ONE_PAGE_PRICING.md`, a concise one-page subscription pricing sheet aligned with the current plan catalog, storage quotas, add-ons, AI Future Force pricing, and paid services.
- Added a permanent Master Super Admin bootstrap for `rbinnovationllp@gmail.com` / Rajesh Kumar Khare, granting the global `super_admin` role whenever that Supabase Auth user exists or is created later.
- Updated the homepage floating Ask Synk AI launcher to display the name "Ask Synk AI" directly instead of showing only a chat symbol on small screens.
- Fixed public visitor counting by rendering `SiteVisitTracker` in the root application layout.
- Added a Supabase migration for `site_page_views` permissions, safe public insert policy, super-admin read policy, and security-definer aggregate/recording functions so visitor analytics can work without exposing raw page-view rows.
- Updated visitor analytics server functions to use controlled database RPCs first, with direct table access as a fallback for older deployments.
- Renamed the public floating assistant to "Ask Synk AI" across the visitor widget, greeting, prompts, and assistant system guidance.
- Confirmed and documented the web-based AI Future Force Curriculum Planner for age-appropriate Classes 1-12 AI education courses.
- Added a one-month AI Future Force demo-plan explanation on the homepage with once-a-week and twice-a-week delivery framing.
- Added a homepage demo request option: "Request a One-Month AI Future Force Course Demo Plan."
- Added conditional homepage fields for classes required, preferred frequency, available periods during the month, and contact person details; these are appended into the lead message for sales follow-up without requiring a database migration.
- Updated Ask Synk AI knowledge so it can explain Syllabus Synk features, AI Future Force, sample monthly plans, pricing, implementation without disrupting regular classes, dashboards, FAQs, and demo-plan requests.
- Added public-assistant guardrails: Ask Synk AI may explain internal dashboards, but authenticated curriculum monitoring, teacher tracking, progress analysis, and management reporting remain inside Syllabus Synk dashboards.
- Expanded teacher progress tracking statuses to Not Started, In Progress, Completed, Partially Completed, and Rescheduled while preserving legacy Not Covered records.
- Expanded teacher progress update fields to include portion completed, student participation, activity/assessment conducted, reason for delay, and next planned topic, stored in the existing remarks trail.
- Added principal/school-admin monitoring summary signals for delayed/rescheduled lessons, missed progress updates, monthly completion status, and AI-class schedule visibility placeholder.
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

## Ask Synk AI Knowledge Maintenance

Ask Synk AI now uses three knowledge layers:
- Static product knowledge in `src/lib/ai-help.functions.ts` for core workflows and safe local fallback answers.
- Managed approved knowledge index in `ask_synkai_knowledge_sources`, refreshed from project documentation, pricing, production-readiness notes, support policy, and school privacy/security framework.
- Fallback dynamic living project context from `PROJECT_STATUS.md` if approved indexed knowledge is not yet available.

Company Super Admin controls:
- Trigger manual Ask SynkAI knowledge refresh in Company CRM.
- Review indexed knowledge sources, validation status, critical flags, previews, and sync-run history.
- Approve critical or changed knowledge sources before they are published into assistant answers.
- Monitor pending critical knowledge and synchronization status.

Maintenance rule:
- After any minor or major feature change, update this file in the same work session.
- After updating this file or pricing/security/curriculum documents, Company Super Admin should run Ask SynkAI knowledge refresh and approve critical pending sources.
- If a feature is added, renamed, moved, gated by plan, or still prototype/partial, record that here.
- If pricing, plan limits, support policy, payment behavior, or AI Future Workforce curriculum details change, update both the relevant source file and this document.
- If a production blocker is completed or newly discovered, update both this file and `PRODUCTION_READINESS_REVIEW.md`.
- The assistant should clearly distinguish implemented features from prototypes, blocked areas, and planned work.
- If Ask SynkAI cannot answer from approved knowledge, it should avoid guessing and create a support-review ticket for the team at support@syllabus-synk.in.

## Module Status

### Public Website and Lead Capture

Status: Implemented with ongoing content refinement.

Working:
- Marketing homepage, feature sections, board/curriculum support messaging, testimonials, contact/demo form, public visitor counters, partner page, and AI Future Workforce homepage visibility.
- Lead capture saves school, contact, board, country, message, acquisition source, and partner/referral context.

Needs work:
- Final client-approved copy review.
- Apply the latest visitor analytics Supabase migration in production and verify that live visitor counters increase after deployment.
- Visual QA across mobile and desktop after every homepage amendment.

### Ask Synk AI

Status: Implemented and expanded.

Working:
- Floating visitor assistant on the homepage/root layout.
- Starter prompts, conversation history, local fallback answers, AI-provider answer path, safety rules, and support escalation.
- Knowledge now covers major product modules and AI Future Workforce.
- AI-provider answers load approved indexed knowledge first, with `PROJECT_STATUS.md` as fallback living context.
- Company CRM includes Ask SynkAI knowledge refresh, indexed-source review, critical approval, and sync-run monitoring.
- Unknown or out-of-knowledge questions create support-review tickets for support@syllabus-synk.in follow-up.
- Renamed to Ask Synk AI.
- Guides visitors to the one-month AI Future Force demo-plan request option.
- Explains internal dashboards without operating authenticated monitoring or reporting from public chat.
- Explains the School Data Privacy, Security & Confidentiality Framework in visitor-safe language.

Needs work:
- Add automated regression tests for common user questions.
- Add a scheduled/CI-triggered knowledge refresh job so production deployments can refresh the index automatically after approved releases.
- Ensure every future feature change amends this status file and gets refreshed/approved in the Ask SynkAI knowledge panel.
- If true lead capture inside the chat widget is required later, add a dedicated chat-to-lead submission flow with explicit consent.

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
- AI Teaching Assistant / Teacher Copilot with activity-based teaching suggestions, premium AI Teaching Credits, admin allocation controls, and reusable teaching library.
- AI Teaching Resource Studio / Content Studio with expanded resource types for chapter-list mapped teaching packs, worksheets, quizzes, activity packs, slide outlines, interactive templates, teacher micro-training modules, and AI Future Force lab activities.
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
- World-class AI Future Force Curriculum Planner positioning for Classes 1-12.
- One-month sample course-plan request path on the homepage.
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
- Teachers can mark lessons/sessions as Not Started, In Progress, Completed, Partially Completed, or Rescheduled.
- Teacher update details include topic taught, date/period, portion completed, student participation, activity/assessment, delay reason, and next planned topic.
- Principals and school admins can monitor class-wise, subject-wise, teacher-wise completion, delayed/rescheduled lessons, missed updates, and monthly completion status.
- Daily Syllabus Exception Reports compare assigned work with completed work, show pending portion, delay duration, syllabus completion impact, and corrective recommendation.
- Incomplete, not-started, rescheduled, or not-covered teacher updates create in-app alerts for school leadership roles using notification dedupe keys.
- Teacher Credit Distribution Recommendations give School Super Admins advisory workload scores based on assigned classes, subjects, weekly periods, responsibilities, duties, projects, and recent teaching activity.
- Workload indicators identify balanced, moderate overload, high overload, and underutilized teachers with recommendation text; final decisions remain with school management.
- School Super Admin declaration and member authority visibility.
- School Data Privacy, Security & Confidentiality Framework is documented in Terms, School Governance, Ask SynkAI knowledge, and database seed policy.
- Session registry foundation and recycle-bin governance display.

Needs work:
- Full AI-class schedule integration for "today's scheduled AI classes."
- Student assessment result integration in the execution dashboard.
- Timetable-driven cron alerts for completely missed teacher updates before any progress record exists.
- Forced logout/session management policy.
- Expand audit coverage for every sensitive export, permission change, company-admin support access event, and large-scale data transfer.
- Validate tenant isolation and role-based access through automated tests across all modules.
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
- School accounts, active subscriptions, support tickets, plan catalog, acquisition attribution, visitor conversion, storage automation reporting, and pipeline metrics.
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
- Razorpay-first subscription, recurring add-on, one-time add-on, and webhook status-update infrastructure for Indian operations.
- Stripe checkout/portal infrastructure retained for future international activation.
- UPI panel placeholder/path.
- Usage and AI credit reporting.

Needs work:
- Payment failure handling.
- Invoice storage and invoice UI.
- Renewal and failure audit trail.
- Webhook idempotency/replay tracking.
- End-to-end payment lifecycle tests across Razorpay, UPI fallback, add-ons, plan changes, and future Stripe international activation.

### Storage

Status: Implemented with Super Admin management controls; production storage operations still need hardening.

Working:
- AWS S3 signed upload/download flow.
- File metadata in Supabase.
- Quota display based on plan.
- Delete action.
- Allocated, used, and available storage dashboard.
- Largest files, category usage, file-type breakdown, and user-wise usage analytics.
- 80%, 90%, and 100% storage usage alerts through dashboard and notification records.
- Upload blocking when storage quota is reached.
- Add-on storage packs and Company Super Admin server function for manual storage allocation.
- Automatic storage allocation after verified Razorpay storage add-on payment for Indian operations, with provider-independent support retained for future international gateways.
- CRM storage automation reporting for recent upgrades, storage sold, storage revenue, school-wise usage, and failed/pending allocation events.
- Exception handling creates urgent Company CRM support tickets, company notifications, platform audit logs, and failed allocation events.
- Fair usage policy and enterprise dedicated storage options displayed.
- Academic session archive action marks previous-session records for archive/deep-archive storage class and updates session status.

Needs work:
- S3 CORS and production bucket validation.
- Actual background compression/lower-cost object-tier transition job for archived files.
- More complete file category/retention policies.
- Granular file permissions and audit trail.
- Automated tests for cross-school file isolation, quota enforcement, archive behavior, and storage permissions.
- End-to-end webhook tests for automatic storage add-on allocation, duplicate payment events, failed allocation recovery, and CRM reports.

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
- Razorpay integration still needs complete invoice records, renewals, replay-safe webhook auditing, and complete payment lifecycle tests.
- Assessment/question-paper generation is still a draft generator and does not yet enforce approved syllabus coverage.
- School Super Admin delegation is not granular module-wise and feature-wise.
- Full tenant-isolation, export-permission, company-admin support-access audit, and security/privacy regression tests are still required before presenting the framework as independently verified compliance.
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
- Focused syntax transpile passed for the visitor analytics server function and root layout after wiring `SiteVisitTracker` into the app.
- `git diff --check` passed after the visitor analytics permission and tracker updates.
- Focused syntax transpile passed for files edited on 2026-07-12: Ask Synk AI widget, assistant knowledge, homepage, academic execution UI, and academic execution server functions.
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
