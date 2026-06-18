# Referral Marketing Program — Build Plan

Pay 10% of every recurring subscription payment to the partner who brought the school in, for as long as the school stays subscribed — with super-admin enforcement powers to suspend or terminate partners who breach the agreement.

---

## 1. How attribution works (the rules)

- A **partner** is anyone with an account who joined the referral program. They get a unique link like `https://syllabus-sync-engine.lovable.app/?ref=ABC123`.
- When a visitor lands with `?ref=CODE`, we store the code in a first-party cookie + `localStorage` for **90 days**.
- When that visitor signs up, we stamp the partner code permanently onto their account (`profiles.referred_by_partner_id`).
- When the account's school (org) purchases a subscription, the org inherits the partner from its owner. Every successful payment on that subscription accrues 10% commission to that partner — **for the lifetime of the subscription, unless the partner is suspended or terminated** (see §10).
- One partner per org, set on first paid checkout. Self-referral is blocked.
- **House partner fallback**: if a school subscribes with no referral cookie and no `referred_by_partner_id` on the buyer, attribution defaults to the **house partner "Sushma Khare"** (seeded `referral_partners` row, code `HOUSE`, `is_house = true`, owned by the company). The 10% still accrues — it just goes to the house account so every paid subscription is attributed to someone. House partner cannot be suspended/terminated through the normal flow and is excluded from public leaderboards.

## 2. Database (one migration)

```text
referral_partners
  id, user_id (unique), code (unique, 8 chars), display_name, payout_method,
  payout_email, status (active/paused/under_review/suspended/terminated),
  status_reason, status_changed_at, status_changed_by,
  terms_accepted_at, nda_accepted_at, created_at

referral_attributions
  id, org_id (unique), partner_id, code_used, attributed_at, source_url

referral_commissions
  id, partner_id, org_id, stripe_invoice_id (unique), stripe_charge_id,
  gross_amount_cents, currency, commission_rate (default 0.10),
  commission_cents, status (accrued/approved/paid/reversed/forfeited),
  accrued_at, paid_at, payout_id, notes

referral_payouts
  id, partner_id, period_start, period_end, total_cents, currency,
  status (pending/sent/failed), provider, external_ref, paid_at

referral_enforcement_actions   (NEW — audit trail for super-admin actions)
  id, partner_id, action (show_cause_issued/response_received/
    suspended/reinstated/terminated/forfeited_commissions),
  reason_category (confidentiality_breach/competitor_engagement/
    fraud/spam/policy_violation/other),
  notice_text, evidence_url, response_text, response_due_at,
  responded_at, decided_by (super_admin user_id), decided_at,
  forfeited_amount_cents, created_at
```
RLS: partners read only their own rows; org admins see nothing; **only super-admins** read/write `referral_enforcement_actions` and can change `referral_partners.status` to suspended/terminated.

## 3. Capturing the click

Root-route effect: validate `?ref=CODE` format, store `cos_ref` cookie 90 days. On signup, server fn `claimReferral` reads cookie, writes `profiles.referred_by_partner_id`, clears cookie. Self-ref / unknown / suspended-partner code = no-op.

## 4. Locking attribution at first paid checkout

In Stripe checkout server fn (subscription mode): read buyer's `referred_by_partner_id`, **verify partner status is `active`**, and if org has no `referral_attributions` row, insert one. Stamp `metadata.partner_id` on Stripe Customer and Subscription.

## 5. Accruing commission on every payment

Stripe webhook on `invoice.payment_succeeded`:
1. Skip trial-create invoices (no money moved).
2. Resolve `partner_id` from subscription metadata → customer metadata → `referral_attributions`.
3. **Check `referral_partners.status`**:
   - `active` → insert commission row with `status = 'accrued'`.
   - `paused` → insert with `status = 'accrued'` (still earns, just no payout).
   - `under_review` → insert with `status = 'accrued'` but flag for hold.
   - `suspended` → insert with `status = 'forfeited'` (recorded for audit, never paid).
   - `terminated` → **no commission row created at all**.
4. `stripe_invoice_id` UNIQUE → idempotent on webhook retries.
5. On `charge.refunded` / `invoice.voided` → mark matching commission `reversed`.

## 6. Partner dashboard `/partner`

Public route gated by partner check. Sections:
- Link + QR + share presets (WhatsApp/email/LinkedIn).
- Lifetime stats: clicks, signups, paying orgs, lifetime earned, pending payout.
- Commission ledger (org anonymised as "School #1234"), payout history.
- Payout settings.
- **Compliance banner**: if status is `under_review` or `suspended`, show the show-cause notice, evidence summary, response deadline, and a text area to file a response.

## 7. Super-admin enforcement console `/admin/referrals` (CRITICAL — §11 concern)

Super-admin only. Two tabs:

**Partners tab** — list every partner with status, lifetime earnings, pending balance, last activity. Per-partner actions:
- **Issue show-cause notice** → opens dialog: pick reason category, write notice text, attach evidence URL (Drive link / screenshots), set response deadline (default 7 days). On submit:
  - Insert `referral_enforcement_actions` row (`action = 'show_cause_issued'`).
  - Flip partner status to `under_review`.
  - Email the partner with the notice + deadline + response link.
  - **Pause all `accrued` commissions** for that partner (status → `approved` blocked until cleared).
- **Reinstate** → status back to `active`, log action, release held commissions.
- **Suspend** → status `suspended`, future commissions forfeit, but reasoned + logged + emailed.
- **Terminate** → status `terminated`, **forfeit all unpaid accrued commissions** (status → `forfeited`, sum recorded on the enforcement row as `forfeited_amount_cents`). No future accruals. Action requires typing the partner code to confirm.
- Every status change requires a reason category + free-text reason and is written to `referral_enforcement_actions` — **immutable audit trail**.

**Show-cause queue tab** — open notices awaiting response, response received notices awaiting decision, recent decisions.

## 8. Show-cause flow (the formal process)

1. Super-admin spots issue (confidentiality leak, working with competitor, fraud, spam).
2. Issues show-cause notice → partner status `under_review`, all commissions held, email sent with notice + deadline.
3. Partner sees compliance banner on `/partner`, files written response.
4. If no response by deadline → automatic escalation flag (still requires super-admin to act).
5. Super-admin reviews and decides: **Reinstate** (release holds), **Suspend** (forfeit future), or **Terminate** (forfeit all unpaid + future).
6. Decision emailed to partner with reasoning. Every step persists in `referral_enforcement_actions`.

## 9. Partner agreement (must accept before code is issued)

Terms include explicitly:
- 10% recurring, paid monthly net-30, $50 minimum.
- Refunds/chargebacks reverse commission.
- **Confidentiality**: do not share product internals, screenshots of admin views, AI prompts, or any non-public information.
- **Non-compete during partnership**: cannot simultaneously partner with, build, or actively promote any competing curriculum-planning product.
- **No misrepresentation**: cannot claim to be the product owner or hide that you are a paid referrer.
- **Show-cause clause**: CurriculumOS may issue a show-cause notice for any suspected breach; partner has 7 days to respond; CurriculumOS may suspend or terminate at its sole discretion; on termination all unpaid commissions are forfeited.
- Acceptance writes `terms_accepted_at` and `nda_accepted_at` timestamps — both required.

## 10. Become-a-partner flow `/partners` and `/partner/join`

Marketing page + signup CTA. On `/partner/join`, show terms (§9) with two separate checkboxes (terms + NDA), then create `referral_partners` row with generated 8-char code and `status = 'active'`.

## 11. Marketing surfaces

- Dashboard banner for paid customers: *"Earn 10% recurring — refer another school"*.
- Landing-page footer link.
- Email touchpoint at day 30 of subscription.
- `/partners` landing page: how it works, FAQ, link to full terms (§9).

## 12. Safeguards summary

- Self-referral blocked; org-swap blocked (UNIQUE on `referral_attributions.org_id`).
- Refunds/chargebacks → reverse commission.
- Partner status gates everything: only `active` partners attract new attributions and accrue payable commissions.
- **Suspension and termination are super-admin only** and require a reason category + audit row.
- **Termination forfeits all unpaid commissions** and is recorded with the forfeited amount.
- Click throttling per IP/UA to prevent inflated click counts.
- All enforcement actions immutable — append-only, no UPDATE/DELETE on `referral_enforcement_actions`.

## 13. Rollout order (4 PRs)

1. **Schema + click capture + attribution stamping** (no money flow yet).
2. **Webhook commission accrual + partner dashboard ledger**.
3. **Become-a-partner flow + marketing surfaces + terms with NDA**.
4. **Super-admin enforcement console + show-cause workflow + email notifications + forfeiture logic**.

## 14. Teacher curriculum edit + AI review workflow (NEW)

Lets the assigned subject teacher propose additions/deletions to the generated curriculum, runs an AI quality review, and only releases a downloadable final PDF after either (a) AI approves it as excellent, or (b) AI flags faults and the teacher explicitly acknowledges and still requests the amended version. Every step is recorded.

### Tables (one migration)

```text
curriculum_edit_proposals
  id, year_id, grade, subject, teacher_id (auth.uid),
  base_version_id (-> curriculum_versions.id),
  proposed_payload jsonb,           -- full edited curriculum
  diff_summary text,                -- additions/deletions list
  status (draft/under_ai_review/approved_excellent/flagged_low_quality/
          teacher_acknowledged/finalized/rejected),
  ai_score numeric(3,2),            -- 0.00–1.00
  ai_verdict text,                  -- excellent / acceptable / low_quality
  ai_fault_lines jsonb,             -- [{area, severity, explanation, suggestion}]
  ai_report text,                   -- full markdown review
  teacher_ack_at timestamptz,       -- when teacher accepted faults & still proceeded
  teacher_ack_text text,            -- their written acknowledgement
  final_pdf_url text,               -- storage path once released
  finalized_at timestamptz,
  created_at, updated_at
```

RLS: teacher reads/writes own proposals for subjects they're assigned to (via `teacher_assignments`); school admin reads all in their org; super-admin reads all. Append-only audit on status changes via trigger into `admin_audit_log`.

### Flow

1. **Edit** — On `/curriculum/$yearId` the assigned teacher gets an "Propose changes" button. Opens an editor pre-filled with the latest `curriculum_versions` payload for their grade+subject. They add/remove chapters, reorder, adjust periods. Saves as `status = draft`.
2. **Submit for review** — Teacher clicks "Submit for AI review" → server fn `submitProposalForReview` flips status to `under_ai_review`, calls Lovable AI (Gemini) with the base curriculum + proposed payload + the school's academic capacity (available teaching days, periods/week, board, textbook list) and a strict rubric:
   - Syllabus coverage vs board requirement
   - Chapter sequencing / cognitive load
   - Fit within available teaching days (capacity engine numbers)
   - Assessment readiness windows (§9 of master PRD: 30/45/60-day completion buffers)
   - Difficulty clustering rule
3. **AI verdict**:
   - `ai_score >= 0.85` → `approved_excellent`. System generates final PDF, stores in `curriculum-finals` bucket, sets `final_pdf_url`, status `finalized`. Teacher sees green banner + Download button.
   - `ai_score < 0.85` → `flagged_low_quality`. Teacher sees the `ai_fault_lines` (red-flag list with severity + suggested fix) and two options:
     - **Revise** → back to `draft`.
     - **Proceed anyway** → opens acknowledgement dialog: teacher must type "I accept the noted faults and request the amended version" + free-text reason. On submit → status `teacher_acknowledged`, `teacher_ack_at`/`teacher_ack_text` filled, system generates the PDF with a watermark page *"Released over AI quality warning — see fault report"*, status `finalized`.
4. **Final PDF** — `generateProposalPdf` server fn renders chapters, weekly breakdown, AI report appendix, and (if acknowledged) the fault report + acknowledgement statement. Stored in private storage bucket; signed URL on demand.
5. **Record** — Every transition writes to `admin_audit_log` (actor, before/after status, AI score). Super-admin can list all `teacher_acknowledged` proposals on `/admin/curriculum-reviews` for oversight.

### UI

- `/curriculum/$yearId/propose` — editor + submit.
- `/curriculum/$yearId/proposals/$proposalId` — status, AI report, download (if finalized), acknowledge-and-proceed dialog.
- `/admin/curriculum-reviews` — super-admin queue: filter by status, see fault lines + ack reason, download finals.

### Guardrails

- Teacher can only propose for grade+subject in their `teacher_assignments`.
- One open (`draft`/`under_ai_review`/`flagged_low_quality`) proposal per teacher+grade+subject at a time.
- AI review costs are charged against the school's `ai_credit_grants` quota (same engine as `consume_ai_credits`).
- Acknowledgement text is permanent — no edits, no deletes; only super-admin can mark a finalized proposal `rejected` post-hoc with a reason.

---

## 15. Open questions (need your call before PR 1)

- **Commission base**: 10% of gross paid (Stripe collected, ex-tax) — confirm.
- **Minimum payout**: $50, rolling — confirm. (House partner: no minimum, internal accounting only.)
- **Payout method v1**: manual bank transfer + CSV export, or Stripe Connect Express from day one?
- **Show-cause response window**: 7 days default — confirm.
- **Public program name**: "School Partner Program", "Ambassador Program", or "Affiliate Program"?
- **Cookie window**: 90 days — confirm.
- **AI excellence threshold**: 0.85 default — confirm or set your own cutoff.
- **House partner email** for Sushma Khare's seeded `referral_partners` row.

