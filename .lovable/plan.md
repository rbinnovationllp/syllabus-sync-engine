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

## 14. Open questions (need your call before PR 1)

- **Commission base**: 10% of gross paid (Stripe collected, ex-tax) — confirm.
- **Minimum payout**: $50, rolling — confirm.
- **Payout method v1**: manual bank transfer + CSV export, or Stripe Connect Express from day one?
- **Show-cause response window**: 7 days default — confirm.
- **Public program name**: "School Partner Program", "Ambassador Program", or "Affiliate Program"?
- **Cookie window**: 90 days — confirm.
